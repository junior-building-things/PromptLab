import {
  createOAuthState,
  getLarkConfig,
  hasRequiredAuthConfig,
  redirect,
  setStateCookie,
} from '../../_lib/auth.js';

/**
 * Front-channel kickoff. Mirrors Hamlet's `/api/auth/login`: mint a CSRF
 * state, stash it in a short-lived cookie, then 302 to Lark's authorize
 * endpoint. The callback at `/api/auth/lark/callback` will validate the
 * returned state against the cookie before doing anything irreversible.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  if (!hasRequiredAuthConfig()) {
    redirect(res, '/?auth_error=missing_config');
    return;
  }

  const config = getLarkConfig(req);
  const state = createOAuthState();
  setStateCookie(res, state);

  const url = new URL(config.authorizeUrl);
  url.searchParams.set('app_id', config.appId || '');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', config.scope);

  redirect(res, url.toString());
}
