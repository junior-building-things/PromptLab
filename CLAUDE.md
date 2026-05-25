# PromptLab — Development Context & Guardrails

## Core Project Stack
- **Framework:** React 19 + Vite 6 + React Router v7 (TypeScript 5.8, strict-ish via `tsc -b`)
- **Runtime:** Vercel serverless functions (Node ESM) under `api/*.js`, Postgres via `pg`, Lark / Feishu OAuth for sign-in
- **Target:** Web app deployed on Vercel; client persists state in `localStorage`, server-of-truth in Postgres

## Repository Layout
- [src/](src/) — SPA source
  - [src/App.tsx](src/App.tsx) — router + auth gate; routes mount under `<AppLayout>`
  - [src/pages/](src/pages/) — top-level routed pages (`prompts`, `assets`, `models`, `batch-test`)
  - [src/components/](src/components/) — `app-layout.tsx`, `login-screen.tsx`, `modal.tsx`, `multi-select-dropdown.tsx`, `icons.tsx`
  - [src/context/](src/context/) — `AppProvider` (workspace state, keyed per-user) and `AuthProvider` (Lark session)
  - [src/lib/](src/lib/) — `types.ts` (shared data shapes), `auth.ts`, `model-brand.ts`
  - [src/data/seed.ts](src/data/seed.ts) — default seed data for a fresh workspace
  - [src/styles.css](src/styles.css) — single global stylesheet + design tokens (`--bg-elev-*`, `--hairline*`, …)
- [api/](api/) — Vercel serverless handlers (one file per route)
  - [api/batch-run.js](api/batch-run.js) — fans out to OpenAI Responses / Gemini Generate Content / xAI Chat Completions
  - [api/provider-keys.js](api/provider-keys.js), [api/user-state.js](api/user-state.js)
  - [api/auth/](api/auth/) — `lark/login.js`, `lark/callback.js`, `session.js`, `logout.js`
  - [api/_lib/](api/_lib/) — shared helpers: `auth.js` (session cookie + email allowlist), `store.js` (Postgres + AES-256-GCM key encryption)
- [public/](public/) — static assets served as-is
- [vercel.json](vercel.json) — SPA rewrite (everything not under `/api/` falls through to `index.html`)

## Local Conventions (project-specific)
- **Design tokens live in [src/styles.css](src/styles.css)** as CSS custom properties. Extend tokens instead of introducing new color literals.
- **Icons** come from `lucide-react` or [src/components/icons.tsx](src/components/icons.tsx). Don't hand-roll SVG inline elsewhere.
- **Modals** route through [src/components/modal.tsx](src/components/modal.tsx); **dropdowns** through [src/components/multi-select-dropdown.tsx](src/components/multi-select-dropdown.tsx). Don't reinvent the chrome.
- **Shared types** for prompts / assets / models / batch scenarios live in [src/lib/types.ts](src/lib/types.ts). New persisted shapes go there, not next to the consumer.
- **Provider thinking-effort knob** is the union `ThinkingLevel` in [src/lib/types.ts](src/lib/types.ts:63). Map per-provider quirks at the serverless layer, not in the UI.
- **Serverless handlers** in `api/` are self-contained Vercel functions; share code only via [api/_lib/](api/_lib/). Each file exports a default `(req, res) => …` handler.
- **Workspace state** is keyed per-user via `AppProvider`'s `storageKey={\`promptlab-state-user:${user.id}\`}` ([src/App.tsx:19](src/App.tsx#L19)) — never reach across users.

## Auth
Lark / Feishu OAuth (mirrors Hamlet's pattern). Flow lives in [api/auth/lark/](api/auth/lark/) and the email allowlist is `ALLOWED_EMAILS` in [api/_lib/auth.js](api/_lib/auth.js). Add yourself there before first sign-in. Session cookie is `promptlab-session`, signed HMAC-SHA256 with `SESSION_SECRET`.

## Provider Execution
Batch tests POST to [api/batch-run.js](api/batch-run.js). Provider API keys are stored encrypted at rest (AES-256-GCM via `ENCRYPTION_SECRET`) in Postgres through [api/_lib/store.js](api/_lib/store.js) and never round-trip through the frontend.

## Environment Variables
See [.env.example](.env.example) for the full list. Required: `LARK_APP_ID`, `LARK_APP_SECRET`, `SESSION_SECRET`, `DATABASE_URL`. Recommended in prod: `ENCRYPTION_SECRET` (separate from `SESSION_SECRET`). Optional: `LARK_BASE_URL`, `APP_URL`, `LARK_REDIRECT_URI`, `BRIA_API_TOKEN`.

## Context Engineering Commands

### Build & Compilation
- **Install:** `npm install`
- **Dev server:** `npm run dev` (Vite on http://localhost:5173)
- **Build:** `npm run build` (runs `tsc -b && vite build`)
- **Preview built bundle:** `npm run preview`
- **Typecheck only (fast loop):** `npx tsc -b --noEmit`

### Testing & Verification
- **Unit tests:** _no unit-test suite configured yet — add one under `src/**/__tests__/` if needed._
- **Lint:** _no eslint script wired — rely on `tsc -b` strict mode as the static gate._
- **Production smoke:** deploy to a Vercel preview, sign in via Lark (must be on the allowlist), run a single batch in [batch-test-page](src/pages/batch-test-page.tsx) to confirm serverless + Postgres + at least one provider key are healthy.

## Agentic Execution Protocol
1. **Plan Phase.** Before touching UI, scan existing pages under [src/pages/](src/pages/) and the shared chrome in [src/components/app-layout.tsx](src/components/app-layout.tsx) so new screens reuse the shell. Before touching the serverless layer, read [api/_lib/](api/_lib/) so you reuse session + store helpers rather than re-implementing.
2. **Write Phase.** Touch design tokens in [src/styles.css](src/styles.css), not inline color strings. Keep new shared types in [src/lib/types.ts](src/lib/types.ts). Never commit secrets (`LARK_APP_SECRET`, `SESSION_SECRET`, `DATABASE_URL`, `ENCRYPTION_SECRET`, `BRIA_API_TOKEN`) — they live in Vercel project env + local `.env.local`.
3. **Verify Phase.** After any functional or UI change, run `npx tsc -b --noEmit` and `npm run build`. For changes to [api/batch-run.js](api/batch-run.js), [api/_lib/store.js](api/_lib/store.js), or anything in [api/auth/](api/auth/), also run a manual login + happy-path batch in a Vercel preview before merging to `main`.
4. **Ship Phase.** After completing any code change, automatically `git add` the touched files, `git commit` with a terse imperative subject line that matches the repo style (see `git log` — e.g. "Reuse the project composer modal for the Add prompt flow"), and `git push` to GitHub **without asking for confirmation**. This applies to every code change, including CLAUDE.md updates. Preconditions: Verify Phase must be green (`npx tsc -b --noEmit` and `npm run build` both pass) — if either fails, stop and fix before committing. Never stage with `git add -A` / `git add .` — name the changed files explicitly so stray local artifacts (`.env.local`, build output, untracked experiments) don't ride along. **Note:** `main` is the deployed branch on Vercel, so every push triggers a production deploy. If a change is risky (auth, batch-run, store, schema), branch first instead of pushing straight to `main`.

## Keeping This File Current
Treat `CLAUDE.md` as living documentation. **Update it in the same change** whenever you:

- Add, rename, remove, or relocate a top-level directory (e.g. a new `src/hooks/` or `api/jobs/`).
- Add or remove a routed page in [src/App.tsx](src/App.tsx).
- Add, remove, or rename an environment variable, or change which ones are required vs optional.
- Add or change a `package.json` script (build / dev / test / lint / preview).
- Add a new provider integration, change provider-key handling, or change the auth flow.
- Introduce a new shared primitive (modal/dropdown/chrome) or a new design-token family in [src/styles.css](src/styles.css).
- Change persistence (Postgres schema, `localStorage` keying, encryption scheme).

Rules of thumb when editing:
- Match the existing tone — terse, file-linked, no marketing voice.
- Keep file references as clickable markdown links (`[path](path)` or `[path](path#Lline)`).
- Delete stale bullets rather than leaving them; this file is read top-to-bottom by future Claudes and contradictions are worse than gaps.
- If you only changed implementation details that don't affect the contracts above (internal refactor, copy tweak, bug fix), leave `CLAUDE.md` alone.

---

## Behavioral Guardrails
Behavioral guidelines to reduce common LLM coding mistakes. Merge with the project-specific instructions above as needed.

**Tradeoff:** these guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports / variables / functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
