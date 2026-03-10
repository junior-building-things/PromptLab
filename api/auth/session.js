import { hasRequiredAuthConfig, readSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!hasRequiredAuthConfig(req)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        authenticated: false,
        error: 'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or SESSION_SECRET.',
      }),
    );
    return;
  }

  const user = readSession(req);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ authenticated: Boolean(user), user }));
}
