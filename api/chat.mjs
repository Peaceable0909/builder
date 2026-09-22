function providerName() {
  return (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
}

function configuredProvider() {
  if (providerName() === 'openai') return process.env.OPENAI_API_KEY ? 'openai' : null;
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
}

async function readBody(request) {
  const body = await request.json();
  return body && typeof body === 'object' ? body : {};
}

function textFromEvent(provider, line) {
  if (!line.startsWith('data:')) return '';
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return '';
  try {
    const event = JSON.parse(data);
    return provider === 'anthropic' ? event.delta?.text || '' : event.choices?.[0]?.delta?.content || '';
  } catch { return ''; }
}

function streamUpstream(upstream, provider) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  return new Response(new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of upstream.body) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const text = textFromEvent(provider, line.trim());
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Stream interrupted.' })}\n\n`));
        controller.close();
      }
    },
  }), { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' } });
}

async function createChat(body) {
  const activeProvider = configuredProvider();
  if (!activeProvider) {
    const name = providerName() === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    return Response.json({ error: `Set ${name} in Vercel Project Settings before using live chat.` }, { status: 503 });
  }
  const messages = Array.isArray(body.messages) ? body.messages.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-40) : [];
  if (!messages.length) return Response.json({ error: 'At least one message is required.' }, { status: 400 });
  const system = typeof body.system === 'string' ? body.system.slice(0, 12_000) : undefined;
  const requestedModel = typeof body.model === 'string' ? body.model : '';
  const wantsStream = body.stream === true;

  if (activeProvider === 'anthropic') {
    const payload = { model: process.env.ANTHROPIC_MODEL || requestedModel || 'claude-sonnet-4-5', max_tokens: 4096, messages, stream: wantsStream };
    if (system) payload.system = system;
    const upstream = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(payload) });
    if (!upstream.ok) { const result = await upstream.json(); return Response.json({ error: result?.error?.message || 'Anthropic request failed.' }, { status: upstream.status }); }
    if (wantsStream) return streamUpstream(upstream, 'anthropic');
    const result = await upstream.json();
    return Response.json({ content: result.content?.filter(part => part.type === 'text').map(part => part.text).join('\n') || '', provider: 'anthropic', model: payload.model }, { headers: { 'cache-control': 'no-store' } });
  }

  const payload = { model: process.env.OPENAI_MODEL || requestedModel || 'gpt-4o-mini', messages: system ? [{ role: 'system', content: system }, ...messages] : messages, temperature: 0.3, stream: wantsStream };
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(payload) });
  if (!upstream.ok) { const result = await upstream.json(); return Response.json({ error: result?.error?.message || 'OpenAI request failed.' }, { status: upstream.status }); }
  if (wantsStream) return streamUpstream(upstream, 'openai');
  const result = await upstream.json();
  return Response.json({ content: result.choices?.[0]?.message?.content || '', provider: 'openai', model: payload.model }, { headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { allow: 'POST' } });
    try { return await createChat(await readBody(request)); } catch (error) { return Response.json({ error: error.message || 'Unexpected provider error.' }, { status: 500 }); }
  },
};
