import { readSession } from './_lib/auth.js';
import { getUserWorkspace, saveProviderKey } from './_lib/store.js';

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const XAI_MODELS_URL = 'https://api.x.ai/v1/models';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

function parseResponseBody(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function readProviderErrorMessage(provider, payload) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  return `${provider} API key validation failed.`;
}

async function validateProviderApiKey(provider, apiKey) {
  if (!apiKey) {
    return;
  }

  const request =
    provider === 'openai'
      ? {
          url: OPENAI_MODELS_URL,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      : provider === 'gemini'
        ? {
            url: `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`,
            headers: {},
          }
        : {
            url: XAI_MODELS_URL,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          };

  const response = await fetch(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const raw = await response.text();
  const payload = parseResponseBody(raw);

  if (!response.ok) {
    throw new HttpError(400, readProviderErrorMessage(provider, payload));
  }
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

      const normalizedApiKey = apiKey.trim();
      await validateProviderApiKey(provider, normalizedApiKey);
      const workspace = await saveProviderKey(user, provider, normalizedApiKey);
      return json(res, 200, { providerKeys: workspace.providerKeys });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, error instanceof HttpError ? error.status : 500, {
      error: error instanceof Error ? error.message : 'Provider key request failed unexpectedly.',
    });
  }
}
