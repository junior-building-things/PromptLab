# PromptLab

PromptLab is a Vite + React web app for managing prompts, assets, model presets, and batch comparison runs across OpenAI, Google Gemini, and xAI workflows.

## Features

- Prompt library with editable system prompts and tags
- Asset management for documents, images, and raw text context
- Model preset management for OpenAI, Gemini, and xAI endpoints
- Batch testing workspace with persisted history
- Local persistence via `localStorage`, server-of-truth in Postgres
- Lark sign-in (gated on an email allowlist)

## Local development

```bash
cp .env.example .env.local
# Fill in LARK_APP_ID / LARK_APP_SECRET / SESSION_SECRET / DATABASE_URL …
npm install
npm run dev
```

## Auth — Lark / Feishu

Sign-in goes through Lark OAuth (mirroring the pattern used by Hamlet). The flow:

1. Front-end hits `/api/auth/lark/login` → 302 to Lark's `authen/v1/authorize` with a CSRF state cookie.
2. Lark redirects back to `/api/auth/lark/callback?code=…&state=…`.
3. Callback mints an `app_access_token`, exchanges the user `code` for an `access_token`, fetches the user profile, checks the email allowlist, and sets a signed session cookie (`promptlab-session`, HMAC-SHA256).
4. Session cookie is read by `/api/auth/session` to gate the SPA.

Required env vars:

- `LARK_APP_ID` — Lark app credentials, Lark admin console.
- `LARK_APP_SECRET`
- `SESSION_SECRET` — 32+ random bytes; rotates all sessions when changed.

Optional:

- `LARK_BASE_URL` — defaults to `https://open.larkoffice.com`.
- `APP_URL` — explicit canonical origin for the callback URL (defaults to inferring from request headers).
- `LARK_REDIRECT_URI` — full override of the callback URL (useful with ngrok in dev).

The allowlist lives in `api/_lib/auth.js` (`ALLOWED_EMAILS`). Add yourself there before the first sign-in.

## Provider execution

Batch tests post to `/api/batch-run`, a Vercel serverless function that fans out requests to OpenAI Responses, Gemini Generate Content, or xAI Chat Completions using the selected model presets.

Provider API keys are stored encrypted at rest in Postgres (`api/_lib/store.js`), keyed off `ENCRYPTION_SECRET`. They never round-trip through the frontend.

Expected env vars (in addition to auth):

- `DATABASE_URL` — Postgres
- `ENCRYPTION_SECRET` — AES-256-GCM key for provider-API-key encryption
- `BRIA_API_TOKEN` — image background-removal for the sticker flow
