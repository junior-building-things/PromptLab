import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'promptlab-session';
const STATE_COOKIE_NAME = 'promptlab-google-state';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const STATE_MAX_AGE_SECONDS = 60 * 10;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signValue(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  parts.push(`Path=${options.path || '/'}`);

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function appendCookieHeader(res, cookie) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, cookie]);
    return;
  }

  res.setHeader('Set-Cookie', [current, cookie]);
}

function buildCookieOptions(maxAge) {
  return {
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

function first(value) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getBaseUrl(req) {
  const protocolHeader = first(req.headers['x-forwarded-proto']);
  const hostHeader = first(req.headers['x-forwarded-host']) || first(req.headers.host);
  const protocol = protocolHeader || 'https';
  return `${protocol}://${hostHeader}`;
}

export function getGoogleConfig(req) {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/google/callback`,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  };
}

export function hasRequiredAuthConfig(req) {
  const config = getGoogleConfig(req);
  return Boolean(config.clientId && config.clientSecret && process.env.SESSION_SECRET);
}

function encodeSignedPayload(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('Missing SESSION_SECRET.');
  }

  const serialized = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(serialized, secret);
  return `${serialized}.${signature}`;
}

function decodeSignedPayload(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !value) {
    return null;
  }

  const [serialized, signature] = value.split('.');
  if (!serialized || !signature) {
    return null;
  }

  const expected = signValue(serialized, secret);
  if (!timingSafeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(serialized));
    if (payload?.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createOAuthState() {
  return crypto.randomBytes(18).toString('hex');
}

export function setStateCookie(res, value) {
  appendCookieHeader(
    res,
    serializeCookie(STATE_COOKIE_NAME, value, buildCookieOptions(STATE_MAX_AGE_SECONDS)),
  );
}

export function clearStateCookie(res) {
  appendCookieHeader(
    res,
    serializeCookie(STATE_COOKIE_NAME, '', {
      ...buildCookieOptions(0),
      expires: new Date(0),
    }),
  );
}

export function readStateCookie(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[STATE_COOKIE_NAME] || null;
}

export function setSessionCookie(res, user) {
  const payload = {
    user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  appendCookieHeader(
    res,
    serializeCookie(
      SESSION_COOKIE_NAME,
      encodeSignedPayload(payload),
      buildCookieOptions(SESSION_MAX_AGE_SECONDS),
    ),
  );
}

export function clearSessionCookie(res) {
  appendCookieHeader(
    res,
    serializeCookie(SESSION_COOKIE_NAME, '', {
      ...buildCookieOptions(0),
      expires: new Date(0),
    }),
  );
}

export function readSession(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const payload = decodeSignedPayload(cookies[SESSION_COOKIE_NAME]);
  return payload?.user || null;
}

export function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}
