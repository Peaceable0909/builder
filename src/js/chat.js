const STORAGE_KEY = 'peaceable-chat-state-v2';

const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 15Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a3.5 3.5 0 0 1-2.8-2.8l8.5-8.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};

const MODEL_CATALOG = [
  { id: 'claude-sonnet-4-5', name: 'Peaceable Sonnet', provider: 'puter', category: 'Balanced coding', description: 'Claude Sonnet through Puter' },
  { id: 'claude-opus-4-1', name: 'Peaceable Opus', provider: 'puter', category: 'Deep reasoning', description: 'Claude Opus through Puter' },
  { id: 'claude-haiku-4-5', name: 'Peaceable Haiku', provider: 'puter', category: 'Fast coding', description: 'Claude Haiku through Puter' },
  { id: 'gpt-5-nano', name: 'Puter GPT Nano', provider: 'puter', category: 'Fast coding', description: 'Fast general model through Puter' },
  { id: 'gemini-2.5-flash', name: 'Puter Gemini Flash', provider: 'puter', category: 'Fast coding', description: 'Fast multimodal model through Puter' },
  { id: 'custom', name: 'Custom provider', provider: 'custom', category: 'Your APIs', description: 'Choose an API in Settings' },
];

const starterChats = [{ id: 'welcome', title: 'Welcome to Peaceable', messages: [{ role: 'assistant', content: 'Hello — I’m Peaceable. I can help you design, write, debug, and ship software. Ask me to create a file, explain code, or build an HTML artifact.' }] }];
let state = loadState();
let selectedModel = state.selectedModel || 'Peaceable Sonnet';
let attachedFile = null;
let activePanel = null;
let modelFilter = '';
let puterModels = [];
let modelDiscoveryAttempts = 0;
const artifactSources = new Map();
let liveConfig = { live: false, provider: null };
const CODING_SYSTEM_PROMPT = `You are Peaceable, a thoughtful Claude-like coding assistant. Help the user design, write, debug, and improve software. Give direct, practical answers. When code is requested, provide complete runnable code in fenced code blocks with the correct language. Explain important choices briefly, call out assumptions, and prefer secure, accessible, maintainable solutions. If the user asks for an HTML artifact, return a complete self-contained HTML document so it can be previewed.`;

function defaultSettings() { return { providers: [], activeProviderId: '', puterStorage: true }; }
function normalizeState(saved) {
  return { chats: saved?.chats?.length ? saved.chats : starterChats, activeId: saved?.activeId || (saved?.chats?.[0]?.id || 'welcome'), dark: !!saved?.dark, files: Array.isArray(saved?.files) ? saved.files : [], settings: { ...defaultSettings(), ...(saved?.settings || {}) }, selectedModel: saved?.selectedModel || 'Peaceable Sonnet' };
}
function loadState() { try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch (error) { console.warn('Could not restore Peaceable state', error); return normalizeState(null); } }
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { console.warn('Could not save Peaceable state', error); } }
function activeChat() { return state.chats.find(chat => chat.id === state.activeId) || state.chats[0]; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function chatTitle(chat) { return chat.title || chat.messages.find(message => message.role === 'user')?.content?.slice(0, 34) || 'New conversation'; }
function selectedModelInfo() { return allModels().find(model => model.name === selectedModel) || MODEL_CATALOG[0]; }
function allModels() { return [...MODEL_CATALOG.filter(model => model.provider !== 'custom'), ...puterModels, ...state.settings.providers.map(provider => ({ id: provider.model, name: provider.name || provider.model, provider: 'custom', category: 'Your APIs', description: `${provider.type} · ${provider.baseUrl}` }))].filter((model, index, models) => models.findIndex(candidate => candidate.id === model.id) === index); }
async function discoverPuterModels() {
  if (!window.puter?.ai?.listModels) {
    if (modelDiscoveryAttempts++ < 3) setTimeout(discoverPuterModels, 1000);
    return;
  }
  try {
    const models = await window.puter.ai.listModels();
    if (Array.isArray(models)) {
      puterModels = models.filter(model => model?.id).slice(0, 120).map(model => ({ id: model.id, name: model.name || model.id, provider: 'puter', category: /claude|gpt|gemini|qwen|deepseek|coder|code/i.test(`${model.name} ${model.id}`) ? 'Coding models' : 'Other Puter models', description: `${model.provider || 'Puter'}${model.context ? ` · ${Number(model.context).toLocaleString()} context` : ''}` }));
      if (activePanel === 'models') render();
    }
  } catch (error) { console.warn('Could not discover Puter models', error); }
}

function renderMarkdown(text) {
  const blocks = [];
  const withPlaceholders = String(text ?? '').replace(/```\s*([\w+-]*)\s*\n?([\s\S]*?)```/g, (_, language, code) => { const id = `code-${artifactSources.size}-${Math.random().toString(36).slice(2, 8)}`; const lang = (language || 'text').toLowerCase(); artifactSources.set(id, { code, language: lang, name: `peaceable-${artifactSources.size + 1}.${window.PeaceableExport?.extensionForLanguage(lang) || 'txt'}` }); blocks.push({ id, lang, code }); return `\n@@CODE_BLOCK_${blocks.length - 1}@@\n`; });
  let html = escapeHtml(withPlaceholders).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/\n/g, '<br>');
  blocks.forEach((block, index) => { const source = artifactSources.get(block.id); const language = escapeHtml(block.lang); const highlighted = escapeHtml(block.code); const artifact = block.lang === 'html' || block.lang === 'htm' ? `<div class="artifact-panel" data-artifact="${block.id}"><div class="artifact-toolbar"><strong>Live code artifact</strong><span>HTML</span><button type="button" data-artifact-action="refresh" data-artifact-id="${block.id}">Refresh</button></div><iframe title="Artifact preview" sandbox="allow-scripts"></iframe></div>` : ''; html = html.replace(`@@CODE_BLOCK_${index}@@`, `<div class="code-shell"><div class="code-toolbar"><span>${language}</span><button type="button" data-copy-code="${block.id}">Copy</button><button type="button" data-download-code="${block.id}">Download</button><button type="button" data-save-code="${block.id}">Save file</button></div><pre><code id="${block.id}" class="language-${language}">${highlighted}</code></pre></div>${artifact}`); });
  return html;
}

function panelMarkup() {
  if (!activePanel) return '';
  if (activePanel === 'models') {
    const filtered = allModels().filter(model => `${model.name} ${model.category} ${model.description}`.toLowerCase().includes(modelFilter.toLowerCase()));
    const groups = [...new Set(filtered.map(model => model.category))];
    return `<div class="panel-backdrop" data-action="close-panel"><section class="workspace-panel" data-panel-content><header><div><p class="eyebrow">Model control</p><h2>Models</h2><p class="panel-subtitle">Choose the model for your next request.</p></div><button class="icon-btn" data-action="close-panel" aria-label="Close">${icons.close}</button></header><input class="panel-search" id="model-search" value="${escapeHtml(modelFilter)}" placeholder="Search models…" aria-label="Search models" />${groups.map(group => `<div class="model-group"><h3>${escapeHtml(group)}</h3>${filtered.filter(model => model.category === group).map(model => `<button class="model-card ${selectedModel === model.name ? 'selected' : ''}" data-select-model="${escapeHtml(model.name)}"><span class="model-card-icon">${model.provider === 'custom' ? 'API' : 'AI'}</span><span><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.description)}</small></span><em>${selectedModel === model.name ? 'Selected' : ''}</em></button>`).join('')}</div>`).join('')}</section></div>`;
  }
  if (activePanel === 'files') {
    return `<div class="panel-backdrop" data-action="close-panel"><section class="workspace-panel" data-panel-content><header><div><p class="eyebrow">Workspace files</p><h2>Files & exports</h2><p class="panel-subtitle">Everything here works locally, even without AI.</p></div><button class="icon-btn" data-action="close-panel" aria-label="Close">${icons.close}</button></header><div class="export-grid"><button data-action="export-chat-txt">Download chat .txt</button><button data-action="export-chat-docx">Export chat Word</button><button data-action="export-chat-pdf">Export chat PDF</button><button data-action="export-project">Export project ZIP</button></div><div class="saved-files">${state.files.length ? state.files.map((file, index) => `<div class="saved-file"><span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.language || 'text')} · ${Math.ceil(String(file.content).length / 1024)} KB</small></span><button data-download-saved="${index}">Download</button></div>`).join('') : '<p class="empty-state">Saved code files will appear here.</p>'}</div></section></div>`;
  }
  const providers = state.settings.providers;
  return `<div class="panel-backdrop" data-action="close-panel"><section class="workspace-panel settings-panel" data-panel-content><header><div><p class="eyebrow">Peaceable settings</p><h2>Settings</h2><p class="panel-subtitle">Add a compatible API or save files to your Puter account.</p></div><button class="icon-btn" data-action="close-panel" aria-label="Close">${icons.close}</button></header><label class="toggle-row"><span><strong>Optional Puter storage</strong><small>Save project files to your signed-in Puter account when available.</small></span><input id="puter-storage" type="checkbox" ${state.settings.puterStorage ? 'checked' : ''}></label><h3>Custom API providers</h3><p class="settings-note">Keys are stored only in this browser and sent only to the provider you configure. Use a compatible OpenAI or Anthropic endpoint.</p><div class="provider-list">${providers.map((provider, index) => `<div class="provider-card"><div><strong>${escapeHtml(provider.name || provider.model)}</strong><small>${escapeHtml(provider.type)} · ${escapeHtml(provider.model)}${state.settings.activeProviderId === provider.id ? ' · Active' : ''}</small></div><div><button data-use-provider="${index}">Use</button><button data-delete-provider="${index}">Delete</button></div></div>`).join('') || '<p class="empty-state">No custom providers yet.</p>'}</div><form id="provider-form" class="provider-form"><input name="name" placeholder="Name, e.g. Local Qwen" required><select name="type"><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic-compatible</option></select><input name="baseUrl" placeholder="https://api.example.com/v1" required><input name="model" placeholder="qwen2.5-coder" required><input name="apiKey" type="password" placeholder="API key (optional for local APIs)"><button type="submit">Add provider</button></form><div class="settings-actions"><button data-action="save-puter">Save project to Puter</button><button data-action="clear-settings">Reset custom providers</button></div></section></div>`;
}

function render() {
  document.documentElement.dataset.theme = state.dark ? 'dark' : 'light';
  const chat = activeChat();
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="sidebar-top"><button class="brand" data-action="home" aria-label="Peaceable home"><span class="brand-mark">${icons.spark}</span><span>Peaceable</span></button><button class="icon-btn mobile-only" data-action="close-sidebar" aria-label="Close sidebar">×</button></div><button class="new-chat" data-action="new-chat">${icons.plus}<span>New conversation</span><kbd>⌘ K</kbd></button><div class="sidebar-label">Your conversations</div><nav class="chat-list">${state.chats.map(item => `<button class="chat-item ${item.id === state.activeId ? 'selected' : ''}" data-chat-id="${item.id}"><span>${escapeHtml(chatTitle(item))}</span><span class="chat-dot"></span></button>`).join('')}</nav><div class="sidebar-bottom"><button class="sidebar-link" data-action="files">▣<span>Files & exports</span></button><button class="sidebar-link" data-action="settings">⚙<span>Settings</span></button><button class="sidebar-link" data-action="theme">${state.dark ? icons.sun : icons.moon}<span>${state.dark ? 'Light mode' : 'Dark mode'}</span></button><div class="profile"><div class="avatar">P</div><div><strong>Your workspace</strong><small>${state.settings.activeProviderId ? 'Custom API active' : 'Puter AI + offline'}</small></div><span class="status-dot"></span></div></div></aside><main class="main-panel"><header class="topbar"><button class="icon-btn menu-btn" data-action="toggle-sidebar" aria-label="Open sidebar">${icons.menu}</button><div class="model-picker"><button class="model-button" data-action="models">${escapeHtml(selectedModel)}<span class="chevron">⌄</span></button></div><div class="topbar-actions"><button class="icon-btn desktop-theme" data-action="theme" aria-label="Toggle theme">${state.dark ? icons.sun : icons.moon}</button><button class="user-chip" data-action="settings">P</button></div></header><section class="conversation" id="conversation"><div class="conversation-inner"><div class="welcome"><div class="welcome-mark">${icons.spark}</div><p class="eyebrow">Good to see you</p><h1>What’s on your mind?</h1><p class="welcome-copy">Code, create, and export files locally or with your chosen model.</p><div class="suggestions"><button data-suggestion="Build a responsive HTML landing page and include the complete index.html">Build a website <span>→</span></button><button data-suggestion="Debug this code and explain the fix">Debug code <span>→</span></button><button data-suggestion="Create a Python script and save it as a file">Create a file <span>→</span></button><button data-suggestion="Explain this topic to me simply">Learn something <span>→</span></button></div></div><div class="messages">${chat.messages.map((message, index) => message.role === 'user' ? `<article class="message user-message"><div class="message-bubble">${renderMarkdown(message.content)}${message.attachment ? `<div class="attachment-pill">${icons.paperclip}<span>${escapeHtml(message.attachment)}</span></div>` : ''}</div></article>` : `<article class="message assistant-message"><div class="assistant-avatar">${icons.spark}</div><div class="assistant-body"><div class="message-meta"><strong>Peaceable</strong><span>now</span></div><div class="message-text">${renderMarkdown(message.content)}</div><div class="message-tools"><button data-copy="${index}" aria-label="Copy response">${icons.copy}</button></div></div></article>`).join('')}</div><div class="typing" id="typing"><span></span><span></span><span></span><em>Peaceable is thinking</em></div></div></section><footer class="composer-wrap"><form class="composer" id="composer" onsubmit="return false;"><div class="attachment-preview" id="attachment-preview"></div><textarea id="prompt" rows="1" placeholder="Ask Peaceable to code something…" aria-label="Message Peaceable"></textarea><div class="composer-bottom"><div class="composer-actions"><button type="button" class="composer-icon" data-action="attach" aria-label="Attach file">${icons.paperclip}</button><input id="file-input" type="file" hidden /><span class="hint">Exports work offline · AI can make mistakes.</span></div><button class="send-btn" type="submit" aria-label="Send message">${icons.arrow}</button></div></form></footer></main></div>${panelMarkup()}`;
  bindEvents();
  if (window.hljs) document.querySelectorAll('.code-shell code').forEach(node => window.hljs.highlightElement(node));
  document.querySelectorAll('[data-artifact]').forEach(panel => { const source = artifactSources.get(panel.dataset.artifact); const frame = panel.querySelector('iframe'); if (source && frame) frame.srcdoc = source.code; });
  document.querySelector('#prompt')?.focus();
  requestAnimationFrame(() => document.querySelector('#conversation')?.scrollTo(0, 99999));
}

function bindEvents() {
  document.querySelectorAll('[data-chat-id]').forEach(button => button.addEventListener('click', () => { state.activeId = button.dataset.chatId; saveState(); activePanel = null; render(); }));
  document.querySelectorAll('[data-suggestion]').forEach(button => button.addEventListener('click', () => { document.querySelector('#prompt').value = button.dataset.suggestion; document.querySelector('#prompt').focus(); }));
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', event => { if (button.dataset.action === 'close-panel' && event.target.closest('[data-panel-content]') && !event.target.closest('button[data-action="close-panel"]')) return; handleAction(button.dataset.action); }));
  document.querySelectorAll('[data-select-model]').forEach(button => button.addEventListener('click', () => { selectedModel = button.dataset.selectModel; state.selectedModel = selectedModel; saveState(); activePanel = null; render(); }));
  document.querySelector('#model-search')?.addEventListener('input', event => { modelFilter = event.target.value; render(); document.querySelector('#model-search')?.focus(); });
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => { const message = activeChat().messages[Number(button.dataset.copy)]; await navigator.clipboard?.writeText(message.content); button.classList.add('copied'); setTimeout(() => button.classList.remove('copied'), 900); }));
  document.querySelectorAll('[data-copy-code]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard?.writeText(artifactSources.get(button.dataset.copyCode)?.code || ''); button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 900); }));
  document.querySelectorAll('[data-download-code]').forEach(button => button.addEventListener('click', () => { const source = artifactSources.get(button.dataset.downloadCode); if (source) window.PeaceableExport?.downloadText(source.name, source.code, source.language === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8'); }));
  document.querySelectorAll('[data-save-code]').forEach(button => button.addEventListener('click', () => { const source = artifactSources.get(button.dataset.saveCode); if (!source) return; state.files = [...state.files.filter(file => file.name !== source.name), { name: source.name, language: source.language, content: source.code }]; saveState(); button.textContent = 'Saved'; setTimeout(() => { button.textContent = 'Save file'; }, 900); }));
  document.querySelectorAll('[data-download-saved]').forEach(button => button.addEventListener('click', () => { const file = state.files[Number(button.dataset.downloadSaved)]; if (file) window.PeaceableExport?.downloadText(file.name, file.content); }));
  document.querySelectorAll('[data-artifact-action="refresh"]').forEach(button => button.addEventListener('click', () => { const panel = document.querySelector(`[data-artifact="${button.dataset.artifactId}"]`); const source = artifactSources.get(button.dataset.artifactId); if (panel && source) panel.querySelector('iframe').srcdoc = source.code; }));
  document.querySelector('#composer')?.addEventListener('submit', sendMessage);
  const prompt = document.querySelector('#prompt'); prompt?.addEventListener('input', () => { prompt.style.height = 'auto'; prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`; }); prompt?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); document.querySelector('#composer').requestSubmit(); } });
  document.querySelector('#file-input')?.addEventListener('change', event => { attachedFile = event.target.files[0]; document.querySelector('#attachment-preview').innerHTML = attachedFile ? `<span>${icons.paperclip}${escapeHtml(attachedFile.name)}</span>` : ''; });
  document.querySelector('#provider-form')?.addEventListener('submit', addProvider);
  document.querySelector('#puter-storage')?.addEventListener('change', event => { state.settings.puterStorage = event.target.checked; saveState(); });
  document.querySelectorAll('[data-use-provider]').forEach(button => button.addEventListener('click', () => { state.settings.activeProviderId = state.settings.providers[Number(button.dataset.useProvider)]?.id || ''; selectedModel = state.settings.providers[Number(button.dataset.useProvider)]?.name || selectedModel; state.selectedModel = selectedModel; saveState(); render(); }));
  document.querySelectorAll('[data-delete-provider]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.deleteProvider); const removed = state.settings.providers.splice(index, 1)[0]; if (removed?.id === state.settings.activeProviderId) state.settings.activeProviderId = ''; saveState(); render(); }));
}

async function sendMessage(event) {
  event.preventDefault();
  const input = document.querySelector('#prompt');
  const text = input?.value.trim();
  if (!text || document.querySelector('#typing')?.classList.contains('visible')) return;
  const chat = activeChat();
  chat.messages.push({ role: 'user', content: text, attachment: attachedFile?.name });
  if (chat.title === 'New conversation') chat.title = text.slice(0, 34);
  attachedFile = null;
  saveState();
  render();
  document.querySelector('#typing')?.classList.add('visible');
  document.querySelector('#prompt')?.setAttribute('disabled', 'disabled');
  const assistant = { role: 'assistant', content: '' };
  chat.messages.push(assistant);
  saveState();
  render();
  try {
    const response = await getResponse(chat, chunk => { assistant.content += chunk; saveState(); render(); });
    if (response && !assistant.content) assistant.content = response;
  } catch (error) {
    console.error('Peaceable failed to answer the message.', error);
    assistant.content = 'I could not complete that request. Check your AI provider connection and try again.';
  } finally {
    saveState();
    render();
  }
}

function handleAction(action) { if (action === 'new-chat') { const id = `chat-${Date.now()}`; state.chats.unshift({ id, title: 'New conversation', messages: [] }); state.activeId = id; saveState(); render(); } else if (action === 'theme') { state.dark = !state.dark; saveState(); render(); } else if (action === 'toggle-sidebar') document.querySelector('#sidebar')?.classList.toggle('open'); else if (action === 'close-sidebar') document.querySelector('#sidebar')?.classList.remove('open'); else if (action === 'models') { activePanel = 'models'; render(); } else if (action === 'settings') { activePanel = 'settings'; render(); } else if (action === 'files') { activePanel = 'files'; render(); } else if (action === 'close-panel') { activePanel = null; render(); } else if (action === 'export-chat-txt') exportChat('txt'); else if (action === 'export-chat-docx') exportChat('docx'); else if (action === 'export-chat-pdf') exportChat('pdf'); else if (action === 'export-project') exportProject(); else if (action === 'save-puter') saveToPuter(); else if (action === 'clear-settings') { state.settings.providers = []; state.settings.activeProviderId = ''; saveState(); render(); } else if (action === 'home') { state.activeId = state.chats[0].id; activePanel = null; saveState(); render(); } }

function chatText() { return activeChat().messages.map(message => `${message.role.toUpperCase()}\n${message.content}`).join('\n\n'); }
function exportChat(kind) { const title = chatTitle(activeChat()); const text = chatText(); if (kind === 'txt') window.PeaceableExport?.downloadText(`${window.PeaceableExport.safeName(title)}.txt`, text); if (kind === 'docx') window.PeaceableExport?.exportDocx(title, title, text); if (kind === 'pdf') window.PeaceableExport?.exportPdf(title, title, text); }
async function exportProject() { const files = {}; state.files.forEach(file => { files[file.name] = file.content; }); files['peaceable-chat.txt'] = chatText(); if (!Object.keys(files).some(name => /\.(html?|css|js|ts|py|json)$/i.test(name))) files['README.txt'] = 'Generated with Peaceable. Ask Peaceable to create code files, then save them from each code artifact.'; await window.PeaceableExport?.exportZip('peaceable-project.zip', files); }
async function saveToPuter() { if (!window.puter?.fs?.write) { alert('Puter storage is not available yet. Sign in to Puter, then try again.'); return; } try { await window.puter.fs.write('peaceable/projects/latest.json', JSON.stringify({ chats: state.chats, files: state.files, savedAt: new Date().toISOString() })); alert('Project saved to your Puter account.'); } catch (error) { alert(`Could not save to Puter: ${error.message || error}`); } }
function addProvider(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const provider = { ...data, id: `provider-${Date.now()}` }; state.settings.providers.push(provider); state.settings.activeProviderId = provider.id; selectedModel = provider.name || provider.model; state.selectedModel = selectedModel; saveState(); render(); }

async function customProviderResponse(provider, messages, onChunk) {
  const base = provider.baseUrl.replace(/\/$/, ''); const isAnthropic = provider.type === 'anthropic'; const url = isAnthropic ? `${base}/messages` : `${base}/chat/completions`; const headers = { 'content-type': 'application/json' }; if (isAnthropic) { headers['x-api-key'] = provider.apiKey; headers['anthropic-version'] = '2023-06-01'; } else if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`; const payload = isAnthropic ? { model: provider.model, max_tokens: 4096, messages: messages.filter(message => message.role !== 'system'), system: messages.find(message => message.role === 'system')?.content, stream: true } : { model: provider.model, messages, temperature: 0.2, stream: true }; const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) }); if (!response.ok) throw new Error((await response.text()).slice(0, 500) || `Provider returned ${response.status}`); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let full = ''; while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || ''; for (const event of events) { const raw = event.split('\n').find(line => line.startsWith('data:'))?.slice(5).trim(); if (!raw || raw === '[DONE]') continue; const chunk = JSON.parse(raw); const text = isAnthropic ? chunk.delta?.text || '' : chunk.choices?.[0]?.delta?.content || ''; if (text) { full += text; onChunk(text); } } } return full;
}

async function getResponse(chat, onChunk = () => {}) {
  const messages = [{ role: 'system', content: CODING_SYSTEM_PROMPT }, ...chat.messages.slice(0, -1).map(message => ({ role: message.role, content: message.content }))];
  const custom = state.settings.providers.find(provider => provider.id === state.settings.activeProviderId);
  if (custom) { try { return await customProviderResponse(custom, messages, onChunk); } catch (error) { console.warn('Custom provider unavailable, trying fallback', error); } }
  if (liveConfig.live) { try { const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: selectedModel, messages: chat.messages.slice(0, -1), system: CODING_SYSTEM_PROMPT, stream: true }) }); if (!response.ok) throw new Error((await response.json()).error || 'Live model request failed.'); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let full = ''; while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || ''; for (const event of events) { const raw = event.split('\n').find(line => line.startsWith('data:'))?.slice(5).trim(); if (!raw || raw === '[DONE]') continue; const chunk = JSON.parse(raw); if (chunk.text) { full += chunk.text; onChunk(chunk.text); } } } return full; } catch (error) { console.warn('Server provider unavailable, trying Puter', error); } }
  if (window.puter?.ai?.chat) { try { const response = await window.puter.ai.chat(messages, { model: selectedModelInfo().id, stream: true }); let full = ''; for await (const part of response) { const text = typeof part === 'string' ? part : part?.text || part?.delta?.text || part?.message?.content || ''; if (text) { full += text; onChunk(text); } } if (full) return full; } catch (error) { console.warn('Puter AI unavailable, using offline demo response', error); } }
  await new Promise(resolve => setTimeout(resolve, 350)); const text = [...chat.messages].reverse().find(message => message.role === 'user')?.content || ''; const lower = text.toLowerCase(); const demo = lower.includes('html') || lower.includes('website') ? 'I can create that offline too. Ask me for a complete HTML file, then use **Save file** and **Export project ZIP**.\n\n```html\n<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Peaceable starter</title></head>\n<body><main><h1>Hello from Peaceable</h1><p>Replace this with your idea.</p></main></body>\n</html>\n```' : lower.includes('debug') || lower.includes('code') ? 'Paste the code you want to work on and I’ll help structure the fix. When AI is connected, I can generate complete files and explain every change.' : lower.includes('plan') || lower.includes('project') ? 'Absolutely. Let’s make this concrete.\n\n**A simple way to start:**\n1. Define the outcome.\n2. Break it into small milestones.\n3. Create the first runnable file.\n\nAsk me to create an HTML, JavaScript, Python, Markdown, or JSON file.' : 'I’m ready to help you build, debug, and export files. Connect Puter AI or add a provider in Settings for full coding responses.'; for (const chunk of demo.match(/.{1,18}(?:\s+|$)/g) || [demo]) { onChunk(chunk); await new Promise(resolve => setTimeout(resolve, 20)); } return '';
}

function mountChat() { if (!document.querySelector('#app')) return; try { render(); } catch (error) { console.error('Peaceable failed to render; retrying after the document is ready.', error); } }
fetch('/api/config').then(response => response.ok ? response.json() : null).then(config => { if (config) liveConfig = config; }).catch(() => {});
discoverPuterModels();
window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); handleAction('new-chat'); } if (event.key === 'Escape' && activePanel) { activePanel = null; render(); } });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountChat, { once: true }); else mountChat();
