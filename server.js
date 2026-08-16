import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import batchRun from './api/batch-run.js';
import images from './api/images.js';
import providerKeys from './api/provider-keys.js';
import userState from './api/user-state.js';
import larkCallback from './api/auth/lark/callback.js';
import larkLogin from './api/auth/lark/login.js';
import logout from './api/auth/logout.js';
import session from './api/auth/session.js';

/**
 * Cloud Run entrypoint. The `api/` handlers take `(req, res)` with
 * `req.query` / `req.body` already parsed, which is what Express hands
 * them; the routing table lives here rather than being inferred from
 * the filesystem. Static SPA files come out of `dist/`, and everything
 * unmatched falls through to `index.html` so client-side deep links
 * resolve.
 */

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const ROUTES = {
  '/api/batch-run': batchRun,
  '/api/images': images,
  '/api/provider-keys': providerKeys,
  '/api/user-state': userState,
  '/api/auth/session': session,
  '/api/auth/logout': logout,
  '/api/auth/lark/login': larkLogin,
  '/api/auth/lark/callback': larkCallback,
};

const app = express();

// Images no longer ride inside the workspace JSON (see the image store
// in api/_lib/store.js), but a single upload still has to fit, so keep
// real headroom.
app.use(express.json({ limit: '12mb' }));

for (const [route, handler] of Object.entries(ROUTES)) {
  app.all(route, (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error(`[${route}]`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Request failed unexpectedly.' });
      }
    });
  });
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(distDir, { index: false }));

app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The SPA shell is the only unhashed asset — never let it stick.
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`PromptLab listening on ${port}`);
});
