<h3 align="center"><img width="100" alt="Build logo" src="./icon-256.png"></h3>
<h3 align="center">Aster — a calm, capable AI chat workspace</h3>

<p align="center">
    <a href="https://builder.puter.com/"><strong>« LIVE DEMO »</strong></a>
    <br />
    <br />
    <a href="https://builder.puter.com">Official Site</a>
    ·
    <a href="https://puter.com">Puter.com</a>
    ·
    <a href="https://developer.puter.com/">Developers</a>
    ·
    <a href="https://twitter.com/HeyPuter">X</a>
</p>

<h3 align="center"><img style="border-radius:5px;" alt="screenshot" src="./src/screenshots/gh.png"></h3>

<br>

## Aster Chat

This fork turns the Puter builder shell into Aster, a Claude-inspired chat workspace. It includes local conversation history, model selection, attachments, code syntax highlighting, and sandboxed HTML artifact previews. It can run in demo mode without a key or connect to Anthropic Claude or OpenAI through the server-side proxy in `server.mjs`.

Responses from configured providers stream into the conversation in real time over Server-Sent Events. If no provider key is configured, the site remains usable: it uses local demo responses and simulates the same streaming behavior without making any external API request.

AI Builder uses <a href="https://developer.puter.com/">Puter.js</a> to provide everything your projects might need; from authentication, storage, and database to serverless functions, hosting, and real-time capabilities, all seamlessly integrated without requiring any additional setup.

<br>

## Features

Go from an idea to a working website or application in your browser. AI Builder brings creation, editing, and publishing together in one place.

- **Build with AI:** Describe what you want in plain language and turn it into a website or application, without coding or any technical knowledge.
- **Secure and scalable apps:** Built on <a href="https://github.com/HeyPuter/puter">Puter's Open-source Internet OS</a> technology, your apps will run securely and scale effortlessly without requiring you to manage infrastructure or API keys.
- **Batteries included:** Authentication, storage, databases, AI, networking, realtime capabilities, and serverless functions, all handled seamlessly by Puter.js.
- **Publish and share:** Publish your project to a public URL when you're ready to share it with the world.
- **Live preview:** See your project take shape and try it out as you make changes.
- **Chat and visual editing:** Ask for changes in chat or select an element in the preview to tell the AI exactly what to update.
- **Version history:** Revisit saved versions and restore an earlier state as you experiment with your project.

Follow the steps below to start building your first website or app.

<br>

## Getting Started

### Installation

```bash
git clone https://github.com/Peaceable0909/builder
cd builder
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://localhost:5173` after starting the server.

### Configure Anthropic Claude

Create an API key at [Anthropic Console](https://console.anthropic.com/settings/keys), then add it to `.env`:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

### Configure OpenAI

Create an API key at [OpenAI Platform](https://platform.openai.com/api-keys), then use:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

The browser only calls the same-origin `/api/chat` endpoint. **Never put either API key in `src/`, `dist/`, or a `VITE_*` variable**; the server reads the key from its environment and forwards requests to the provider. Restart `pnpm dev` after changing `.env`.

### Production

Build the frontend and run the same server in production mode:

```bash
pnpm build
NODE_ENV=production pnpm preview
```

Set the environment variables in your hosting provider's secret settings rather than committing `.env`.

### Deploy to Vercel

This repository includes `vercel.json` and native Vercel Functions under `api/`, so Vercel serves the Vite output from `dist/` and exposes the secure endpoints at `/api/config` and `/api/chat`. The long-running `server.mjs` remains useful for local development and non-Vercel hosts; it is not required on Vercel.

The Git workflow is the simplest deployment path:

1. Import `https://github.com/Peaceable0909/builder` into a new Vercel project.
2. Keep the detected Vite settings, or set **Build Command** to `pnpm exec vite build` and **Output Directory** to `dist`.
3. In **Project Settings → Environment Variables**, add `LLM_PROVIDER` and either the Anthropic or OpenAI variables for the **Production** environment. Do not prefix provider keys with `VITE_`.
4. Deploy `main`. A later change to an environment variable applies to new deployments, so redeploy after rotating a key.

For CLI deployment:

```bash
npm install --global vercel
vercel login
vercel link
vercel env add LLM_PROVIDER production
vercel env add ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_MODEL production
vercel --prod
```

For OpenAI, replace the Anthropic variables with `OPENAI_API_KEY` and `OPENAI_MODEL`. Verify the deployment by opening the site and sending a message; the browser should call the same-origin `/api/chat` route rather than a provider URL directly.

<br>

### 🌐 Live Demo

Check out the live demo of AI Builder at [https://builder.puter.com/](https://builder.puter.com/).

<br>


## Support

Connect with the maintainers and community through these channels:

- Bug report or feature request? Please [open an issue](https://github.com/HeyPuter/builder/issues/new/choose).
- X (Twitter): [x.com/HeyPuter](https://x.com/HeyPuter)
- Security issues or abuse reports? [security@puter.com](mailto:security@puter.com)
- Email maintainers at [hi@puter.com](mailto:hi@puter.com)

We are always happy to help you with any questions you may have. Don't hesitate to ask!

<br/>

## License

This repository, including all its contents, sub-projects, modules, and components, is licensed under [Apache License 2.0](LICENSE) unless explicitly stated otherwise. Bundled third-party libraries and fonts retain their own licenses; see [Third-party notices](THIRD_PARTY_NOTICES.md).

<br/>
