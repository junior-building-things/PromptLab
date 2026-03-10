import { createOAuthState, getLarkConfig, hasRequiredAuthConfig, redirect, setStateCookie } from '../../_lib/auth.js';

function buildAuthorizeUrl(req) {
  const config = getLarkConfig(req);
  const state = createOAuthState();
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.appId || '');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (config.scope) {
    url.searchParams.set('scope', config.scope);
  }
  return { state, url: url.toString() };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  if (!hasRequiredAuthConfig(req)) {
    redirect(res, '/?auth_error=missing_config');
    return;
  }

  const { state, url } = buildAuthorizeUrl(req);
  setStateCookie(res, state);
  redirect(res, url);
}
