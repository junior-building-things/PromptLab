import {
  clearStateCookie,
  getLarkConfig,
  hasRequiredAuthConfig,
  readStateCookie,
  redirect,
  setSessionCookie,
} from '../../_lib/auth.js';

function jsonOk(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data;
  }
  return payload;
}

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
  const config = getLarkConfig(req);
  const tenantResponse = await fetch(config.tenantTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });
  const tenantPayload = await tenantResponse.json();
  const tenantBody = jsonOk(tenantPayload);

  if (!tenantResponse.ok || tenantPayload?.code && tenantPayload.code !== 0) {
    throw new Error(tenantBody?.message || tenantPayload?.msg || 'Failed to get Lark tenant access token.');
  }

  const tenantAccessToken =
    tenantBody?.tenant_access_token || tenantPayload?.tenant_access_token || tenantBody?.access_token;

  if (!tenantAccessToken) {
    throw new Error('Lark tenant access token was missing from the response.');
  }

  const formBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(config.oidcTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${tenantAccessToken}`,
    },
    body: formBody,
  });

  const payload = await response.json();
  const tokenBody = jsonOk(payload);

  if (!response.ok || payload?.code && payload.code !== 0) {
    throw new Error(tokenBody?.message || payload?.msg || 'Lark token exchange failed.');
  }

  return tokenBody;
}

async function fetchUserInfo(req, accessToken) {
  const config = getLarkConfig(req);
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json();
  const body = jsonOk(payload);

  if (!response.ok || payload?.code && payload.code !== 0) {
    throw new Error(body?.message || payload?.msg || 'Failed to fetch Lark user info.');
  }

  return body;
}

function normalizeUser(info, tokenData) {
  const source = info && Object.keys(info).length > 0 ? info : tokenData;
  const id = source?.union_id || source?.open_id || source?.user_id || source?.sub;

  if (!id) {
    throw new Error('Lark user identity was missing from the callback payload.');
  }

  return {
    id,
    name: source?.name || source?.en_name || source?.display_name || source?.email || 'Lark User',
    email: source?.email,
    avatarUrl: source?.avatar_url || source?.avatarUrl || source?.picture,
    openId: source?.open_id,
    unionId: source?.union_id || source?.sub,
    userId: source?.user_id,
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
    const accessToken = tokenData?.access_token || tokenData?.accessToken;

    if (!accessToken) {
      throw new Error('Lark token exchange did not return an access token.');
    }

    const userInfo = await fetchUserInfo(req, accessToken);
    const user = normalizeUser(userInfo, tokenData);

    setSessionCookie(res, user);
    clearStateCookie(res);
    redirect(res, '/');
  } catch {
    redirectWithError(res, 'oauth_failed');
  }
}
