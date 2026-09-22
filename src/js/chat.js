const STORAGE_KEY = 'aster-chat-state-v1';

const icons = {
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>'
};

const starterChats = [
  { id: 'welcome', title: 'Welcome to Aster', messages: [{ role: 'assistant', content: 'Hello — I’m Aster. I can help you think through a problem, write and edit, learn something new, or turn a rough idea into a clear plan. What would you like to work on?' }] }
];

let state = loadState();
let selectedModel = 'Aster Sonnet';
let attachedFile = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.chats?.length) return { chats: saved.chats, activeId: saved.activeId || saved.chats[0].id, dark: !!saved.dark };
  } catch (error) { console.warn('Could not restore chat state', error); }
  return { chats: starterChats, activeId: 'welcome', dark: false };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function activeChat() { return state.chats.find(chat => chat.id === state.activeId) || state.chats[0]; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }
function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/\n/g, '<br>');
  return html;
}
function chatTitle(chat) { return chat.title || chat.messages.find(m => m.role === 'user')?.content?.slice(0, 34) || 'New conversation'; }

function render() {
  document.documentElement.dataset.theme = state.dark ? 'dark' : 'light';
  const chat = activeChat();
  document.querySelector('#app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-top">
          <button class="brand" data-action="home" aria-label="Aster home"><span class="brand-mark">${icons.spark}</span><span>Aster</span></button>
          <button class="icon-btn mobile-only" data-action="close-sidebar" aria-label="Close sidebar">×</button>
        </div>
        <button class="new-chat" data-action="new-chat">${icons.plus}<span>New conversation</span><kbd>⌘ K</kbd></button>
        <div class="sidebar-label">Your conversations</div>
        <nav class="chat-list">${state.chats.map(item => `<button class="chat-item ${item.id === state.activeId ? 'selected' : ''}" data-chat-id="${item.id}"><span>${escapeHtml(chatTitle(item))}</span><span class="chat-dot"></span></button>`).join('')}</nav>
        <div class="sidebar-bottom">
          <button class="sidebar-link" data-action="theme">${state.dark ? icons.sun : icons.moon}<span>${state.dark ? 'Light mode' : 'Dark mode'}</span></button>
          <div class="profile"><div class="avatar">Y</div><div><strong>Your workspace</strong><small>Local session</small></div><span class="status-dot"></span></div>
        </div>
      </aside>
      <main class="main-panel">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-action="toggle-sidebar" aria-label="Open sidebar">${icons.menu}</button>
          <div class="model-picker"><button class="model-button" data-action="model">${selectedModel}<span class="chevron">⌄</span></button><div class="model-menu" id="model-menu"><button data-model="Aster Sonnet"><strong>Aster Sonnet</strong><small>Balanced and thoughtful</small></button><button data-model="Aster Opus"><strong>Aster Opus</strong><small>Deepest reasoning</small></button><button data-model="Aster Haiku"><strong>Aster Haiku</strong><small>Fast and focused</small></button></div></div>
          <div class="topbar-actions"><button class="icon-btn desktop-theme" data-action="theme" aria-label="Toggle theme">${state.dark ? icons.sun : icons.moon}</button><button class="user-chip">Y</button></div>
        </header>
        <section class="conversation" id="conversation"><div class="conversation-inner">
          ${chat.messages.length <= 1 ? `<div class="welcome"><div class="welcome-mark">${icons.spark}</div><p class="eyebrow">Good to see you</p><h1>What’s on your mind?</h1><p class="welcome-copy">A calm space for thinking, creating, and getting things done.</p><div class="suggestions"><button data-suggestion="Help me plan a project from scratch">Plan a project <span>→</span></button><button data-suggestion="Explain this topic to me simply">Learn something <span>→</span></button><button data-suggestion="Help me improve this piece of writing">Improve my writing <span>→</span></button><button data-suggestion="Help me think through a difficult decision">Think it through <span>→</span></button></div></div>` : ''}
          <div class="messages">${chat.messages.map((message, index) => message.role === 'user' ? `<article class="message user-message"><div class="message-bubble">${renderMarkdown(message.content)}${message.attachment ? `<div class="attachment-pill">${icons.paperclip}<span>${escapeHtml(message.attachment)}</span></div>` : ''}</div></article>` : `<article class="message assistant-message"><div class="assistant-avatar">${icons.spark}</div><div class="assistant-body"><div class="message-meta"><strong>Aster</strong><span>now</span></div><div class="message-text">${renderMarkdown(message.content)}</div><div class="message-tools"><button data-copy="${index}" aria-label="Copy response">${icons.copy}</button><button aria-label="Good response">◯</button><button aria-label="Bad response">◌</button></div></div></article>`).join('')}</div>
          <div class="typing" id="typing"><span></span><span></span><span></span><em>Aster is thinking</em></div>
        </div></section>
        <footer class="composer-wrap"><form class="composer" id="composer"><div class="attachment-preview" id="attachment-preview"></div><textarea id="prompt" rows="1" placeholder="Message Aster..." aria-label="Message Aster"></textarea><div class="composer-bottom"><div class="composer-actions"><button type="button" class="composer-icon" data-action="attach" aria-label="Attach file">${icons.paperclip}</button><input id="file-input" type="file" hidden /><span class="hint">Aster can make mistakes. Check important info.</span></div><button class="send-btn" type="submit" aria-label="Send message">${icons.arrow}</button></div></form></footer>
      </main>
    </div>`;
  bindEvents();
  document.querySelector('#prompt')?.focus();
  requestAnimationFrame(() => document.querySelector('#conversation')?.scrollTo(0, 99999));
}

function bindEvents() {
  document.querySelectorAll('[data-chat-id]').forEach(button => button.addEventListener('click', () => { state.activeId = button.dataset.chatId; saveState(); render(); document.querySelector('#sidebar')?.classList.remove('open'); }));
  document.querySelectorAll('[data-suggestion]').forEach(button => button.addEventListener('click', () => { document.querySelector('#prompt').value = button.dataset.suggestion; document.querySelector('#prompt').focus(); }));
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action)));
  document.querySelectorAll('[data-model]').forEach(button => button.addEventListener('click', () => { selectedModel = button.dataset.model; document.querySelector('#model-menu').classList.remove('open'); render(); }));
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => { const message = activeChat().messages[Number(button.dataset.copy)]; await navigator.clipboard?.writeText(message.content); button.classList.add('copied'); setTimeout(() => button.classList.remove('copied'), 900); }));
  document.querySelector('#composer')?.addEventListener('submit', sendMessage);
  const prompt = document.querySelector('#prompt');
  prompt?.addEventListener('input', () => { prompt.style.height = 'auto'; prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`; });
  prompt?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); document.querySelector('#composer').requestSubmit(); } });
  document.querySelector('#file-input')?.addEventListener('change', event => { attachedFile = event.target.files[0]; updateAttachment(); });
}
function updateAttachment() { const preview = document.querySelector('#attachment-preview'); if (preview) preview.innerHTML = attachedFile ? `<span>${icons.paperclip}${escapeHtml(attachedFile.name)}</span><button type="button" data-action="remove-attachment">×</button>` : ''; document.querySelector('[data-action="remove-attachment"]')?.addEventListener('click', () => { attachedFile = null; updateAttachment(); }); }
function handleAction(action) {
  if (action === 'new-chat') { const id = `chat-${Date.now()}`; state.chats.unshift({ id, title: 'New conversation', messages: [] }); state.activeId = id; saveState(); render(); }
  if (action === 'theme') { state.dark = !state.dark; saveState(); render(); }
  if (action === 'toggle-sidebar') document.querySelector('#sidebar')?.classList.toggle('open');
  if (action === 'close-sidebar') document.querySelector('#sidebar')?.classList.remove('open');
  if (action === 'model') document.querySelector('#model-menu')?.classList.toggle('open');
  if (action === 'attach') document.querySelector('#file-input')?.click();
  if (action === 'home') { state.activeId = state.chats[0].id; saveState(); render(); }
}
async function sendMessage(event) {
  event.preventDefault(); const input = document.querySelector('#prompt'); const text = input.value.trim(); if (!text || document.querySelector('#typing').classList.contains('visible')) return;
  const chat = activeChat(); chat.messages.push({ role: 'user', content: text, attachment: attachedFile?.name }); if (chat.title === 'New conversation') chat.title = text.slice(0, 34); attachedFile = null; saveState(); render();
  const typing = document.querySelector('#typing'); typing.classList.add('visible'); document.querySelector('#prompt').disabled = true;
  const response = await getResponse(text);
  chat.messages.push({ role: 'assistant', content: response }); saveState(); render();
}
async function getResponse(text) {
  if (window.puter?.ai?.chat) {
    try { const result = await window.puter.ai.chat(text, { model: selectedModel.toLowerCase().replace('aster ', 'claude-'), stream: false }); return typeof result === 'string' ? result : result?.message?.content || result?.text || 'I’m ready to help. What should we explore next?'; } catch (error) { console.warn('Puter AI unavailable, using demo response', error); }
  }
  await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 700));
  const lower = text.toLowerCase();
  if (lower.includes('plan') || lower.includes('project')) return `Absolutely. Let’s make this concrete.\n\n**A simple way to start:**\n1. Define the outcome you want.\n2. Break it into the smallest useful milestones.\n3. Pick the first step you can finish in 30 minutes.\n\nTell me a little more about the project and I’ll help shape the plan around your constraints.`;
  if (lower.includes('write') || lower.includes('writing')) return `I’d be happy to help improve it. Paste the draft here and tell me what you want to optimize for — clarity, warmth, persuasion, brevity, or a specific audience.`;
  if (lower.includes('explain') || lower.includes('learn')) return `Let’s take it one layer at a time. Share the topic, and I’ll explain it in plain language first, then add an example and the deeper details if they’re useful.`;
  return `That’s an interesting place to begin. I can help you reason through it, explore options, or turn it into an actionable next step. What matters most about this for you?`;
}

window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); handleAction('new-chat'); } if (event.key === 'Escape') document.querySelector('#model-menu')?.classList.remove('open'); });
render();
