import {
  createOAuthState,
  getGoogleConfig,
  hasRequiredAuthConfig,
  redirect,
  setStateCookie,
} from '../../_lib/auth.js';

function buildAuthorizeUrl(req) {
  const config = getGoogleConfig(req);
  const state = createOAuthState();
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId || '');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'select_account');
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
