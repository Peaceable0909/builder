/* Offline-first file exporters used by Peaceable. */
(function () {
  function safeName(value, fallback = 'peaceable-file') {
    return String(value || fallback).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 96) || fallback;
  }

  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadText(name, content, type = 'text/plain;charset=utf-8') {
    downloadBlob(safeName(name), new Blob([String(content ?? '')], { type }));
  }

  function xmlEscape(value) {
    return String(value ?? '').replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
  }

  function wordXmlParagraphs(text) {
    return String(text ?? '').split(/\r?\n/).map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line || ' ')}</w:t></w:r></w:p>`).join('');
  }

  async function exportDocx(name, title, text) {
    if (!window.JSZip) {
      downloadText(name.replace(/\.docx?$/i, '') + '.doc', `<html><head><meta charset="utf-8"><title>${xmlEscape(title)}</title></head><body><h1>${xmlEscape(title)}</h1><pre>${xmlEscape(text)}</pre></body></html>`, 'application/msword');
      return;
    }
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.folder('word').folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
    zip.folder('word').file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style></w:styles>`);
    zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${xmlEscape(title)}</w:t></w:r></w:p>${wordXmlParagraphs(text)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
    const bytes = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadBlob(safeName(name.endsWith('.docx') ? name : `${name}.docx`), bytes);
  }

  function pdfEscape(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '?');
  }

  function exportPdf(name, title, text) {
    const lines = [`${title}`, '', ...String(text ?? '').split(/\r?\n/)].flatMap(line => {
      const value = String(line);
      const chunks = [];
      for (let i = 0; i < value.length; i += 92) chunks.push(value.slice(i, i + 92));
      return chunks.length ? chunks : [''];
    });
    const pageLines = 48;
    const pages = [];
    for (let i = 0; i < lines.length; i += pageLines) pages.push(lines.slice(i, i + pageLines));
    const objects = [];
    const add = body => { objects.push(body); return objects.length; };
    const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageIds = [];
    pages.forEach(page => {
      const stream = ['BT', '/F1 10 Tf', '50 760 Td', ...page.map((line, index) => `${index ? '0 -15 Td\n' : ''}(${pdfEscape(line)}) Tj`), 'ET'].join('\n');
      const streamId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent PAGES /Resources << /Font << /F1 ${font} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${streamId} 0 R >>`));
    });
    const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    pageIds.forEach(id => { objects[id - 1] = objects[id - 1].replace('PAGES', `${pagesId} 0 R`); });
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    downloadText(safeName(name.endsWith('.pdf') ? name : `${name}.pdf`), pdf, 'application/pdf');
  }

  function extensionForLanguage(language) {
    const map = { html: 'html', htm: 'html', css: 'css', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', jsx: 'jsx', tsx: 'tsx', json: 'json', markdown: 'md', md: 'md', python: 'py', py: 'py', java: 'java', c: 'c', cpp: 'cpp', sql: 'sql', sh: 'sh', bash: 'sh', yaml: 'yml', yml: 'yml', text: 'txt', txt: 'txt' };
    return map[String(language || 'text').toLowerCase()] || 'txt';
  }

  async function exportZip(name, files) {
    if (!window.JSZip) return;
    const zip = new JSZip();
    Object.entries(files || {}).forEach(([fileName, content]) => zip.file(fileName, String(content ?? '')));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
    downloadBlob(safeName(name.endsWith('.zip') ? name : `${name}.zip`), blob);
  }

  window.PeaceableExport = { downloadBlob, downloadText, exportDocx, exportPdf, exportZip, extensionForLanguage, safeName };
})();
