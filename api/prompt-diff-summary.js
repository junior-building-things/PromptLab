import { readSession } from './_lib/auth.js';
import { getProviderApiKey } from './_lib/store.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-3.1-flash';
const OPENAI_MODEL = 'gpt-5-mini';

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

function normalizeComparisons(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      versionId: typeof entry?.versionId === 'string' ? entry.versionId : '',
      currentPrompt: typeof entry?.currentPrompt === 'string' ? entry.currentPrompt.trim() : '',
      previousPrompt: typeof entry?.previousPrompt === 'string' ? entry.previousPrompt.trim() : '',
    }))
    .filter((entry) => entry.versionId && entry.currentPrompt && entry.previousPrompt);
}

function buildSummaryPrompt(previousPrompt, currentPrompt) {
  return [
    'Compare the CURRENT prompt version against the PREVIOUS prompt version.',
    'Summarize the key changes from PREVIOUS to CURRENT.',
    'Return only concise bullet points that each start with "- ".',
    'Focus on meaningful additions, removals, tightened constraints, or clarified instructions.',
    'Use 2 to 4 bullets when possible.',
    'If there are no meaningful changes, return exactly: "- No major prompt changes identified."',
    '',
    'PREVIOUS PROMPT:',
    previousPrompt,
    '',
    'CURRENT PROMPT:',
    currentPrompt,
  ].join('\n');
}

function normalizeBulletLines(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((line) => `- ${line}`);

  if (bullets.length > 0) {
    return bullets;
  }

  return ['- No major prompt changes identified.'];
}

async function summarizeWithGemini(apiKey, previousPrompt, currentPrompt) {
  const response = await fetch(`${GEMINI_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildSummaryPrompt(previousPrompt, currentPrompt) }],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Gemini summary request failed.');
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  return normalizeBulletLines(text);
}

async function summarizeWithOpenAI(apiKey, previousPrompt, currentPrompt) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: buildSummaryPrompt(previousPrompt, currentPrompt) }],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI summary request failed.');
  }

  return normalizeBulletLines(payload.output_text || '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const user = readSession(req);
  if (!user) {
    return json(res, 401, { error: 'Authentication required.' });
  }

  try {
    const body = normalizeBody(req);
    const comparisons = normalizeComparisons(body?.comparisons).slice(0, 24);

    if (comparisons.length === 0) {
      return json(res, 200, { provider: null, summaries: [] });
    }

    const geminiApiKey = await getProviderApiKey(user, 'gemini');
    const openaiApiKey = geminiApiKey ? null : await getProviderApiKey(user, 'openai');

    if (!geminiApiKey && !openaiApiKey) {
      return json(res, 200, { provider: null, summaries: [] });
    }

    const provider = geminiApiKey ? 'gemini' : 'openai';
    const summarize = geminiApiKey
      ? (comparison) => summarizeWithGemini(geminiApiKey, comparison.previousPrompt, comparison.currentPrompt)
      : (comparison) => summarizeWithOpenAI(openaiApiKey, comparison.previousPrompt, comparison.currentPrompt);

    const summaries = await Promise.all(
      comparisons.map(async (comparison) => ({
        versionId: comparison.versionId,
        bullets: await summarize(comparison),
      })),
    );

    return json(res, 200, { provider, summaries });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Prompt diff summary request failed unexpectedly.',
    });
  }
}
