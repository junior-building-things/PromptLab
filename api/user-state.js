import { readSession } from './_lib/auth.js';
import { getUserWorkspace, saveUserWorkspace } from './_lib/store.js';

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
      return json(res, 200, workspace);
    }

    if (req.method === 'PUT') {
      const body = normalizeBody(req);
      if (!body?.state) {
        return json(res, 400, { error: 'Missing state payload.' });
      }

      await saveUserWorkspace(user, body.state);
      const workspace = await getUserWorkspace(user);
      return json(res, 200, workspace);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Workspace request failed unexpectedly.',
    });
  }
}
