# PromptLab — Development Context & Guardrails

## Core Project Stack
- **Framework:** React 19 + Vite 6 + React Router v7 (TypeScript 5.8, strict-ish via `tsc -b`)
- **Runtime:** Express (Node ESM) — [server.js](server.js) serves the built SPA and mounts the `api/*.js` handlers, Postgres via `pg`, Lark / Feishu OAuth for sign-in
- **Target:** Web app on Cloud Run (`promptlab`, project `tiktok-im`, region `asia-southeast1`); client persists state in `localStorage`, server-of-truth in Postgres

## Repository Layout
- [src/](src/) — SPA source
  - [src/App.tsx](src/App.tsx) — router + auth gate; routes mount under `<AppLayout>`
  - [src/pages/](src/pages/) — top-level routed pages (`prompts`, `assets`, `models`, `batch-test`)
  - [src/components/](src/components/) — `app-layout.tsx`, `login-screen.tsx`, `modal.tsx`, `multi-select-dropdown.tsx`, `icons.tsx`
  - [src/context/](src/context/) — `AppProvider` (workspace state, keyed per-user) and `AuthProvider` (Lark session)
  - [src/lib/](src/lib/) — `types.ts` (shared data shapes), `auth.ts`, `model-brand.ts`, `image-source.ts` (image-store URLs: predicates + upload / inline helpers)
  - [src/data/seed.ts](src/data/seed.ts) — default seed data for a fresh workspace
  - [src/styles.css](src/styles.css) — single global stylesheet + design tokens (`--bg-elev-*`, `--hairline*`, …)
- [api/](api/) — HTTP handlers (one file per route)
  - [api/batch-run.js](api/batch-run.js) — fans out to OpenAI Responses / Gemini Generate Content / Anthropic Messages / xAI Chat Completions
  - [api/provider-keys.js](api/provider-keys.js), [api/user-state.js](api/user-state.js), [api/images.js](api/images.js)
  - [api/auth/](api/auth/) — `lark/login.js`, `lark/callback.js`, `session.js`, `logout.js`
  - [api/_lib/](api/_lib/) — shared helpers: `auth.js` (session cookie + email allowlist), `store.js` (Postgres + AES-256-GCM key encryption)
- [tools/](tools/) — `bg-server.py`, the CPU background-removal sidecar (see Background Removal)
- [public/](public/) — static assets served as-is
- [server.js](server.js) — Cloud Run entrypoint: route table, static `dist/`, SPA fallback
- [Dockerfile](Dockerfile) — two-stage build: Vite build → slim runtime (`--omit=dev`) plus Python, onnxruntime and the baked cutout model
- [docker-entrypoint.sh](docker-entrypoint.sh) — starts the Python sidecar, then `exec`s Node as PID 1
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — deploys to Cloud Run on push to `main`

## Local Conventions (project-specific)
- **Design tokens live in [src/styles.css](src/styles.css)** as CSS custom properties. Extend tokens instead of introducing new color literals.
- **Icons** come from [src/components/icons.tsx](src/components/icons.tsx) — prefer it over `lucide-react`, which is only for glyphs the set doesn't have (download, close, alert, history). Every icon sits in the shared `IconBox` from the same file so glyphs share one optical box; don't re-declare that wrapper per page and don't hand-roll SVG inline.
- **Modals** route through [src/components/modal.tsx](src/components/modal.tsx); **dropdowns** through [src/components/multi-select-dropdown.tsx](src/components/multi-select-dropdown.tsx). Don't reinvent the chrome.
- **Shared types** for prompts / assets / models / batch scenarios live in [src/lib/types.ts](src/lib/types.ts). New persisted shapes go there, not next to the consumer.
- **Provider thinking-effort knob** is the union `ThinkingLevel` in [src/lib/types.ts](src/lib/types.ts:63). Map per-provider quirks at the API layer, not in the UI.
- **API handlers** in `api/` are self-contained; share code only via [api/_lib/](api/_lib/). Each file exports a default `(req, res) => …` handler taking `req.query` / `req.body` pre-parsed, which is what Express supplies. **A new file under `api/` is not routed until it's added to the `ROUTES` table in [server.js](server.js).**
- **Workspace state** is keyed per-user via `AppProvider`'s `storageKey={\`promptlab-state-user:${user.id}\`}` ([src/App.tsx:19](src/App.tsx#L19)) — never reach across users.

## Auth
Lark / Feishu OAuth (mirrors Hamlet's pattern). Flow lives in [api/auth/lark/](api/auth/lark/). **There is no per-address allowlist** — the Lark app is internal to the ByteDance tenant, so anyone who can complete the OAuth flow is a colleague and gets a session. Each user lands in their own workspace (state, images and provider keys are all keyed by user id), so opening access shares the tool, not the data. Session cookie is `promptlab-session`, signed HMAC-SHA256 with `SESSION_SECRET`.

The Lark app is **`cli_a911076bd5f8dbde`, shared with sa-outfit** — rotating its secret means updating both `promptlab-lark-app-secret` and `sa-outfit-lark-secret`. Its redirect allowlist must contain `https://promptlab-416594255546.asia-southeast1.run.app/api/auth/lark/callback`; without it the callback bounces and sign-in fails.

## Provider Execution
Batch tests POST to [api/batch-run.js](api/batch-run.js). Provider API keys are stored encrypted at rest (AES-256-GCM via `ENCRYPTION_SECRET`) in Postgres through [api/_lib/store.js](api/_lib/store.js) and never round-trip through the frontend.

## Image Persistence
Postgres holds two tables, both created on demand by `ensureSchema` in [api/_lib/store.js](api/_lib/store.js) — `promptlab_users` (workspace JSON + encrypted provider keys) and `promptlab_images`. There is no migration tool; adding a column means editing that one `create table if not exists` block.

Binary payloads never live in the workspace JSON — base64 data URLs there blow past the browser's localStorage quota and bloat every save (the request cap is `express.json({ limit: '12mb' })`). Generated outputs and uploaded image references are stored as rows in `promptlab_images` (Postgres `bytea`, keyed per user) and the state only carries a `/api/images?id=…` reference. [api/batch-run.js](api/batch-run.js) parks outputs on the way out and resolves reference images back to data URLs on the way in (providers can't fetch a session-gated URL). Client-side helpers — the `isRenderableImage` predicate, `uploadImage`, and the `toDataUrl` inliner used by the downloadable HTML report — live in [src/lib/image-source.ts](src/lib/image-source.ts). Legacy inline images are lifted into the store by a one-time pass in [AppProvider](src/context/app-context.tsx) after hydration.

An image-reference asset can hold a **set** (a named bulk upload): `sources: string[]` with `source` always mirroring `sources[0]`, so single-image assets and every stored run keep resolving unchanged. A batch expands a set into one row per image via `expandImageAsset` in [src/lib/asset-images.ts](src/lib/asset-images.ts), giving each image the synthetic id `${assetId}#${index}`; `resolveAssetEntry` turns those ids back into something renderable for row labels, thumbnails and the report. Nothing else in the pipeline special-cases grouped assets.

The seeded sticker assets in [src/data/seed.ts](src/data/seed.ts) reference rows owned by `SEED_IMAGE_OWNER` (`__seed__`) in [api/_lib/store.js](api/_lib/store.js) — one shared copy every workspace points at, rather than 1 MB of images in the repo or a per-user duplicate. `readImage` therefore matches the caller's own rows **or** the seed owner's; nothing else is readable. Adding a seed image means inserting a `promptlab_images` row under that owner and pointing an asset at it — there is no upload path for seed images.

## Environment Variables
See [.env.example](.env.example) for the full list. Required: `LARK_APP_ID`, `LARK_APP_SECRET`, `SESSION_SECRET`, `DATABASE_URL`. Recommended in prod: `ENCRYPTION_SECRET` (separate from `SESSION_SECRET`). Optional: `LARK_BASE_URL`, `APP_URL`, `LARK_REDIRECT_URI`, `BG_SERVER_PORT`. `PORT` is supplied by Cloud Run (8080 locally).

## Deployment
Cloud Run service `promptlab` in project `tiktok-im`, region `asia-southeast1` — same pattern as Hamlet and sa-outfit. Push to `main` → [deploy.yml](.github/workflows/deploy.yml) → `gcloud run deploy --source .` (Cloud Build picks up the [Dockerfile](Dockerfile)).

A CI deploy takes **~30 minutes** — most of it baking the 455 MB model into the image on a small regional worker. It is not hung; watch it with `gcloud builds list --region asia-southeast1` (CI's builds are regional, so a plain `gcloud builds list` shows nothing and looks like a failure).

Service shape: `--allow-unauthenticated` (public URL; access control is Lark tenant sign-in, not IAM), **2 vCPU / 2 GiB**, request timeout 600s. The memory and CPU are sized for the resident cutout model, not the web app — don't trim them without reading Background Removal below. Note that CPU inference is real work on the instance, so several concurrent batches contend for those 2 vCPUs.

**This app was migrated off Vercel (2026-08-16); nothing runs there any more.** No `vercel.json`, no `vercel dev` — [server.js](server.js) is the only runtime. If you find yourself reaching for a platform-specific config file, you want the Dockerfile or the workflow instead.

Split of configuration:
- **Secrets** come from Secret Manager, wired in the workflow: `promptlab-database-url`, `promptlab-session-secret`, `promptlab-encryption-secret`, `promptlab-lark-app-secret`. Rotating a value only needs a redeploy — the workflow pins `:latest`.
- **Non-secret env** (`LARK_APP_ID`, `APP_URL`, optionally `LARK_BASE_URL`) is set once on the service and persists across deploys; it is deliberately not in the workflow so a redeploy can't drop it.

Service URL: **https://promptlab-416594255546.asia-southeast1.run.app**

`APP_URL` must match the service URL, and that same origin's `/api/auth/lark/callback` has to be on the Lark app's redirect allowlist or sign-in fails with `invalid_state`. GitHub Actions needs a `GCP_SA_KEY` repo secret (the same deployer service-account JSON Hamlet uses).

**Deploying from a laptop on the ByteDance network does not work.** `gcloud run deploy --source .` and `gcloud builds submit` both die uploading the source to `storage.googleapis.com` — `SSLV3_ALERT_HANDSHAKE_FAILURE`, or a stall that never returns. Small requests through the same gcloud are fine, and so is `curl`, so it is gcloud's bundled Python TLS stack that the network rejects, not GCP access. CI is unaffected. To deploy by hand anyway, keep the big transfer in `curl` and let the API calls do the rest:

```bash
git archive --format=tar.gz -o /tmp/src.tgz <branch> -- . ':!public/assets/app-icon.png'
TOK=$(gcloud auth print-access-token)
curl -X POST -H "Authorization: Bearer $TOK" -H 'Content-Type: application/gzip' --data-binary @/tmp/src.tgz \
  'https://storage.googleapis.com/upload/storage/v1/b/run-sources-tiktok-im-asia-southeast1/o?uploadType=media&name=promptlab/source.tgz'
gcloud builds submit gs://run-sources-tiktok-im-asia-southeast1/promptlab/source.tgz \
  --tag asia-southeast1-docker.pkg.dev/tiktok-im/cloud-run-source-deploy/promptlab:manual
gcloud run deploy promptlab --image asia-southeast1-docker.pkg.dev/tiktok-im/cloud-run-source-deploy/promptlab:manual \
  --region asia-southeast1
```

`public/assets/app-icon.png` is 9 MB, unreferenced, and excluded from build uploads via [.gcloudignore](.gcloudignore) — hence the pathspec above.

## Background Removal
The sticker flow's cutout step runs the **withoutbg open-weights ONNX model locally on CPU** — no SaaS call, no API key, no image leaving the container. [tools/bg-server.py](tools/bg-server.py) holds the model in memory behind a localhost-only HTTP server (`/remove`, `/health`); [api/batch-run.js](api/batch-run.js) posts the generated image to it and applies the white keyline to the returned cutout. [docker-entrypoint.sh](docker-entrypoint.sh) starts it alongside Node.

The 455 MB weights are baked into the image at build time from Hugging Face (`WITHOUTBG_MODEL_PATH`), so cold starts don't download them. The model loads **lazily on the first cutout**, not at boot — Cloud Run throttles CPU outside a request, so eager loading would crawl. The first sticker request after a cold start therefore pays for the weight load; that wait happens inside `/remove` and is bounded by the 600s request timeout. Node's own readiness poll (15s) only covers the sidecar binding its port, which happens at container start.

The Dockerfile runs a real cutout as a build step, so a bad model or a changed SDK call shape fails the build instead of production. End-to-end generation including background removal was verified on Cloud Run on 2026-08-16.

**Locally the sidecar is usually not running** — `npm start` only starts Node. Batches still work; the cutout step fails fast (~15s) and [postProcessOutputImage](api/batch-run.js) falls back to the un-stickerized image. To exercise it for real: `pip install withoutbg && python3 tools/bg-server.py` alongside the app, or just test the cutout in a Cloud Run revision.

## Context Engineering Commands

### Build & Compilation
- **Install:** `npm install`
- **Dev server:** `npm run dev` (Vite on http://localhost:5173)
- **Build:** `npm run build` (runs `tsc -b && vite build`)
- **Preview built bundle:** `npm run preview` (client only, no API)
- **Run the real server:** `npm start` (Express on http://localhost:8080 — serves `dist/`, so build first)
- **Typecheck only (fast loop):** `npx tsc -b --noEmit`

### Testing & Verification
- **Unit tests:** _no unit-test suite configured yet — add one under `src/**/__tests__/` if needed._
- **Lint:** _no eslint script wired — rely on `tsc -b` strict mode as the static gate._
- **Server smoke (local, no DB needed):** `npm run build && npm start`, then check `/` serves the shell, a deep link like `/batch-test` falls back to it, and `/api/user-state` 401s.
- **Production smoke:** deploy a revision with `--no-traffic --tag preview`, sign in via Lark (must be on the allowlist), run a single batch in [batch-test-page](src/pages/batch-test-page.tsx) to confirm Postgres + at least one provider key are healthy, then migrate traffic.

## Agentic Execution Protocol
1. **Plan Phase.** Before touching UI, scan existing pages under [src/pages/](src/pages/) and the shared chrome in [src/components/app-layout.tsx](src/components/app-layout.tsx) so new screens reuse the shell. Before touching the API layer, read [api/_lib/](api/_lib/) so you reuse session + store helpers rather than re-implementing.
2. **Write Phase.** Touch design tokens in [src/styles.css](src/styles.css), not inline color strings. Keep new shared types in [src/lib/types.ts](src/lib/types.ts). Never commit secrets (`LARK_APP_SECRET`, `SESSION_SECRET`, `DATABASE_URL`, `ENCRYPTION_SECRET`) — they live in Secret Manager (see Deployment) + local `.env.local`.
3. **Verify Phase.** After any functional or UI change, run `npx tsc -b --noEmit` and `npm run build`. For changes to [api/batch-run.js](api/batch-run.js), [api/_lib/store.js](api/_lib/store.js), or anything in [api/auth/](api/auth/), also run a manual login + happy-path batch against a tagged Cloud Run revision before merging to `main`.
4. **Ship Phase.** After completing any code change, automatically `git add` the touched files, `git commit` with a terse imperative subject line that matches the repo style (see `git log` — e.g. "Reuse the project composer modal for the Add prompt flow"), and `git push` to GitHub **without asking for confirmation**. This applies to every code change, including CLAUDE.md updates. Preconditions: Verify Phase must be green (`npx tsc -b --noEmit` and `npm run build` both pass) — if either fails, stop and fix before committing. Never stage with `git add -A` / `git add .` — name the changed files explicitly so stray local artifacts (`.env.local`, build output, untracked experiments) don't ride along. **Note:** `main` is the deployed branch — every push runs [deploy.yml](.github/workflows/deploy.yml) and ships to Cloud Run. If a change is risky (auth, batch-run, store, schema), branch first instead of pushing straight to `main`.

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

The general working rules — think before coding, simplicity first, surgical changes, goal-driven
execution — live in `~/.claude/CLAUDE.md` and apply here. They bias toward caution over speed; for
trivial tasks, use judgment. Everything above this line is what's specific to PromptLab.
