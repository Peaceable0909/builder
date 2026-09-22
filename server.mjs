import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const isProduction = process.env.NODE_ENV === 'production';

try {
  const envFile = readFileSync(join(root, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env is optional; hosted environments provide process.env directly. */ }

const provider = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1_000_000) throw new Error('Request is too large');
  }
  return JSON.parse(data || '{}');
}

function configuredProvider() {
  if (provider === 'openai') return process.env.OPENAI_API_KEY ? 'openai' : null;
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
}

async function chat(body) {
  const activeProvider = configuredProvider();
  if (!activeProvider) {
    const name = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    const error = new Error(`Set ${name} on the server before using live chat.`);
    error.status = 503;
    throw error;
  }
  const messages = Array.isArray(body.messages) ? body.messages.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-40) : [];
  if (!messages.length) throw Object.assign(new Error('At least one message is required.'), { status: 400 });
  const system = typeof body.system === 'string' ? body.system.slice(0, 12_000) : undefined;
  const requestedModel = typeof body.model === 'string' ? body.model : '';
  if (activeProvider === 'anthropic') {
    const payload = { model: process.env.ANTHROPIC_MODEL || requestedModel || 'claude-sonnet-4-5', max_tokens: 4096, messages };
    if (system) payload.system = system;
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result?.error?.message || 'Anthropic request failed.'), { status: response.status });
    return { content: result.content?.filter(part => part.type === 'text').map(part => part.text).join('\n') || '', provider: 'anthropic', model: payload.model };
  }
  const payload = { model: process.env.OPENAI_MODEL || requestedModel || 'gpt-4o-mini', messages: system ? [{ role: 'system', content: system }, ...messages] : messages, temperature: 0.3 };
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result?.error?.message || 'OpenAI request failed.'), { status: response.status });
  return { content: result.choices?.[0]?.message?.content || '', provider: 'openai', model: payload.model };
}

async function streamChat(body, res) {
  const activeProvider = configuredProvider();
  if (!activeProvider) {
    const name = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    throw Object.assign(new Error(`Set ${name} on the server before using live chat.`), { status: 503 });
  }
  const messages = Array.isArray(body.messages) ? body.messages.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-40) : [];
  const system = typeof body.system === 'string' ? body.system.slice(0, 12_000) : undefined;
  const requestedModel = typeof body.model === 'string' ? body.model : '';
  const isAnthropic = activeProvider === 'anthropic';
  const payload = isAnthropic
    ? { model: process.env.ANTHROPIC_MODEL || requestedModel || 'claude-sonnet-4-5', max_tokens: 4096, messages, stream: true }
    : { model: process.env.OPENAI_MODEL || requestedModel || 'gpt-4o-mini', messages: system ? [{ role: 'system', content: system }, ...messages] : messages, temperature: 0.3, stream: true };
  if (isAnthropic && system) payload.system = system;
  const upstream = await fetch(isAnthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: isAnthropic ? { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } : { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(payload) });
  if (!upstream.ok) { const result = await upstream.json(); throw Object.assign(new Error(result?.error?.message || 'Provider request failed.'), { status: upstream.status }); }
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const event = JSON.parse(raw);
        const text = isAnthropic ? event.delta?.text || '' : event.choices?.[0]?.delta?.content || '';
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch { /* Ignore provider keep-alive or non-JSON lines. */ }
    }
  }
  res.end('data: [DONE]\n\n');
}

async function serveStatic(req, res) {
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const safePath = normalize(join(root, 'dist', requested));
  if (!safePath.startsWith(join(root, 'dist'))) return json(res, 403, { error: 'Forbidden' });
  try {
    const info = await stat(safePath);
    if (!info.isFile()) throw new Error('Not a file');
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'content-type': types[extname(safePath)] || 'application/octet-stream' });
    createReadStream(safePath).pipe(res);
  } catch { json(res, 404, { error: 'Not found' }); }
}

async function main() {
  const vite = isProduction ? null : await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/api/config') return json(res, 200, { provider: configuredProvider(), live: !!configuredProvider() });
      if (req.method === 'POST' && req.url === '/api/chat') { const body = await readBody(req); if (body.stream === true) return await streamChat(body, res); return json(res, 200, await chat(body)); }
      if (!isProduction) return vite.middlewares(req, res, () => {});
      return serveStatic(req, res);
    } catch (error) { json(res, error.status || 500, { error: error.message || 'Unexpected server error' }); }
  });
  server.listen(port, '0.0.0.0', () => console.log(`Peaceable running on http://localhost:${port} (${isProduction ? 'production' : 'development'})`));
}
main().catch(error => { console.error(error); process.exit(1); });
