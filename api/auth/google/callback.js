import {
  clearStateCookie,
  getGoogleConfig,
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

async function exchangeCode(req, code) {
  const config = getGoogleConfig(req);
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId || '',
      client_secret: config.clientSecret || '',
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed.');
  }

  return payload;
}

async function fetchUserInfo(req, accessToken) {
  const config = getGoogleConfig(req);
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Failed to fetch Google user info.');
  }

  return payload;
}

function normalizeUser(userInfo) {
  const id = userInfo?.sub;

  if (!id) {
    throw new Error('Google user identity was missing from the callback payload.');
  }

  return {
    id,
    name: userInfo.name || userInfo.email || 'Google User',
    email: userInfo.email,
    avatarUrl: userInfo.picture,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  if (!hasRequiredAuthConfig(req)) {
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

  try {
    const tokenData = await exchangeCode(req, code);
    const accessToken = tokenData?.access_token;

    if (!accessToken) {
      throw new Error('Google token exchange did not return an access token.');
    }

    const userInfo = await fetchUserInfo(req, accessToken);
    const user = normalizeUser(userInfo);

    setSessionCookie(res, user);
    clearStateCookie(res);
    redirect(res, '/');
  } catch {
    redirectWithError(res, 'oauth_failed');
  }
}
