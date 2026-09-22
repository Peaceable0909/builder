function providerName() {
  return (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
}

export default {
  fetch(request) {
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { allow: 'GET' } });
    const provider = providerName();
    const live = provider === 'openai' ? Boolean(process.env.OPENAI_API_KEY) : Boolean(process.env.ANTHROPIC_API_KEY);
    return Response.json({ provider: live ? provider : null, live }, { headers: { 'cache-control': 'no-store' } });
  },
};
