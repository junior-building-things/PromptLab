const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const XAI_URL = 'https://api.x.ai/v1/chat/completions';

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

function buildAssetContext(asset) {
  if (!asset) return '';

  return [`Asset name: ${asset.name}`, `Asset type: ${asset.kind}`, `Asset source: ${asset.source}`]
    .filter(Boolean)
    .join('\n');
}

function scoreOutput(text) {
  const lengthScore = Math.min(24, Math.round(text.length / 36));
  return Math.max(72, Math.min(98, 72 + lengthScore));
}

async function callOpenAI({ prompt, userInput, asset, model }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY for OpenAI model execution.');
  }

  const content = [
    {
      type: 'input_text',
      text: `User task:\n${userInput}\n\nAsset context:\n${buildAssetContext(asset) || 'None provided.'}`,
    },
  ];

  if (asset?.kind === 'image-reference' && /^(https?:\/\/|data:image\/)/.test(asset.source)) {
    content.unshift({
      type: 'input_image',
      image_url: asset.source,
    });
  }

  const started = Date.now();
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: model.apiModel,
      temperature: model.temperature,
      max_output_tokens: model.maxTokens,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: prompt.systemPrompt }],
        },
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI request failed.');
  }

  const output = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('\n').trim();
  return {
    output: output || 'OpenAI returned no text output.',
    latencyMs: Date.now() - started,
  };
}

async function callGemini({ prompt, userInput, asset, model }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY for Gemini model execution.');
  }

  const started = Date.now();
  const response = await fetch(`${GEMINI_URL}/${model.apiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: prompt.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `User task:\n${userInput}\n\nAsset context:\n${buildAssetContext(asset) || 'None provided.'}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: model.temperature,
        maxOutputTokens: model.maxTokens,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Gemini request failed.');
  }

  const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  return {
    output: output || 'Gemini returned no text output.',
    latencyMs: Date.now() - started,
  };
}

async function callXAI({ prompt, userInput, asset, model }) {
  if (!process.env.XAI_API_KEY) {
    throw new Error('Missing XAI_API_KEY for xAI model execution.');
  }

  const content = [
    {
      type: 'text',
      text: `User task:\n${userInput}\n\nAsset context:\n${buildAssetContext(asset) || 'None provided.'}`,
    },
  ];

  if (asset?.kind === 'image-reference' && /^(https?:\/\/|data:image\/)/.test(asset.source)) {
    content.unshift({
      type: 'image_url',
      image_url: {
        url: asset.source,
      },
    });
  }

  const started = Date.now();
  const response = await fetch(XAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: model.apiModel,
      temperature: model.temperature,
      max_tokens: model.maxTokens,
      messages: [
        {
          role: 'system',
          content: prompt.systemPrompt,
        },
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'xAI request failed.');
  }

  const output = payload.choices?.[0]?.message?.content?.trim();
  return {
    output: output || 'xAI returned no text output.',
    latencyMs: Date.now() - started,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = normalizeBody(req);
    const { prompt, asset, models, userInput } = body || {};

    if (!prompt?.systemPrompt || !Array.isArray(models) || models.length === 0 || !userInput) {
      return json(res, 400, { error: 'Missing prompt, models, or userInput in request body.' });
    }

    const results = await Promise.all(
      models.map(async (model) => {
        let execution;
        if (model.provider === 'openai') {
          execution = await callOpenAI({ prompt, userInput, asset, model });
        } else if (model.provider === 'gemini') {
          execution = await callGemini({ prompt, userInput, asset, model });
        } else {
          execution = await callXAI({ prompt, userInput, asset, model });
        }

        return {
          modelId: model.id,
          output: execution.output,
          latencyMs: execution.latencyMs,
          score: scoreOutput(execution.output),
        };
      }),
    );

    return json(res, 200, { results });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Batch run failed unexpectedly.',
    });
  }
}
