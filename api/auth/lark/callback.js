import {
  clearStateCookie,
  getLarkConfig,
  hasRequiredAuthConfig,
  readStateCookie,
  redirect,
  setSessionCookie,
} from '../../_lib/auth.js';

function first(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function redirectWithError(res, code) {
  clearStateCookie(res);
  redirect(res, `/?auth_error=${encodeURIComponent(code)}`);
}

/**
 * Step 1 of the back-channel exchange — mint an `app_access_token` from
 * the static app credentials. Required as the auth header for the
 * `user/access_token` exchange below; Lark won't accept the user code
 * directly with just the app secret.
 */
async function fetchAppAccessToken(config) {
  const response = await fetch(config.appTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });
  const data = await response.json();
  if (data?.code !== 0 || !data?.app_access_token) {
    throw new Error(
      `Lark app_access_token failed: code=${data?.code} msg=${data?.msg || 'unknown'}`,
    );
  }
  return data.app_access_token;
}

/**
 * Step 2 — exchange the user-side OAuth code for a user access token.
 * The classic endpoint nests the result under `data`; newer endpoints
 * return it at the top level. We try `data` first, fall back to the
 * envelope root, to keep working if Lark flips response shape.
 */
async function fetchUserAccessToken(config, appAccessToken, code) {
  const response = await fetch(config.userTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_access_token: appAccessToken,
      grant_type: 'authorization_code',
      code,
    }),
  });
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Lark user access_token response was not JSON: ${raw.slice(0, 200)}`);
  }
  const inner = parsed?.data || parsed;
  const accessToken = inner?.access_token;
  if (!accessToken) {
    throw new Error(
      `Lark user access_token missing in response: ${JSON.stringify(parsed).slice(0, 400)}`,
    );
  }
  return accessToken;
}

async function fetchUserInfo(config, accessToken) {
  const response = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Lark user_info HTTP ${response.status}`);
  }
  const payload = await response.json();
  const user = payload?.data;
  if (!user) {
    throw new Error('Lark user_info response was missing the data block.');
  }
  return user;
}

function normalizeUser(userInfo) {
  const id = userInfo.user_id || userInfo.open_id;
  if (!id) {
    throw new Error('Lark user identity was missing from the user_info payload.');
  }
  return {
    id,
    name: userInfo.en_name || userInfo.name || 'Lark User',
    email: userInfo.enterprise_email || userInfo.email,
    avatarUrl: userInfo.avatar_url,
  };
}

/**
 * Callback handler. Mirrors Hamlet's `/api/auth/callback` end-to-end:
 *   1. Validate the CSRF state from cookie vs. query.
 *   2. Mint an app_access_token.
 *   3. Exchange the user code for an access_token.
 *   4. Fetch the user profile.
 *   5. Mint the session. There is no per-address gate: the Lark app is
 *      internal to the tenant, so completing this flow at all means the
 *      user is a signed-in colleague.
 *   6. Set the session cookie and 302 back to `/`.
 *
 * Any failure short-circuits to `/?auth_error=<code>`; the React layer
 * (`auth-context.tsx`) decodes that into a user-visible message.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  if (!hasRequiredAuthConfig()) {
    redirectWithError(res, 'missing_config');
    return;
  }

  const query = req.query || {};
  const code = first(query.code);
  const state = first(query.state);
  const error = first(query.error);
  const storedState = readStateCookie(req);

  if (error) {
    redirectWithError(res, 'access_denied');
    return;
  }

  if (!code || !state || !storedState || state !== storedState) {
    redirectWithError(res, 'invalid_state');
    return;
  }

  const config = getLarkConfig(req);

  try {
    const appAccessToken = await fetchAppAccessToken(config);
    const userAccessToken = await fetchUserAccessToken(config, appAccessToken, code);
    const userInfo = await fetchUserInfo(config, userAccessToken);
    const user = normalizeUser(userInfo);

    setSessionCookie(res, user);
    clearStateCookie(res);
    redirect(res, '/');
  } catch (err) {
    console.error('[auth/lark/callback]', err);
    redirectWithError(res, 'oauth_failed');
  }
}
