import { readSession } from './_lib/auth.js';
import { getUserWorkspace, saveProviderKey } from './_lib/store.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function normalizeBody(req) {
  if (!req.body) return null;
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  return req.body;
}

export default async function handler(req, res) {
  const user = readSession(req);
  if (!user) {
    return json(res, 401, { error: 'Authentication required.' });
  }

  try {
    if (req.method === 'GET') {
      const workspace = await getUserWorkspace(user);
      return json(res, 200, { providerKeys: workspace.providerKeys });
    }

    if (req.method === 'PUT') {
      const body = normalizeBody(req);
      const provider = body?.provider;
      const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';

      if (!provider || !['openai', 'gemini', 'xai'].includes(provider)) {
        return json(res, 400, { error: 'Missing or invalid provider.' });
      }

      const workspace = await saveProviderKey(user, provider, apiKey.trim());
      return json(res, 200, { providerKeys: workspace.providerKeys });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Provider key request failed unexpectedly.',
    });
  }
}
