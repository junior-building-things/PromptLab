import { readSession } from './_lib/auth.js';
import { getProviderApiKey } from './_lib/store.js';

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

  const sourcePreview =
    asset.kind === 'image-reference' && /^data:image\//.test(asset.source)
      ? 'Uploaded image reference attached below.'
      : asset.source;

  return [`Asset name: ${asset.name}`, `Asset type: ${asset.kind}`, `Asset source: ${sourcePreview}`]
    .filter(Boolean)
    .join('\n');
}

function parseImageDataUrl(source) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(source || '');
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function scoreOutput(text) {
  const lengthScore = Math.min(24, Math.round(text.length / 36));
  return Math.max(72, Math.min(98, 72 + lengthScore));
}

function toDataUrl(mimeType, data) {
  if (!mimeType || !data) {
    return undefined;
  }

  return `data:${mimeType};base64,${data}`;
}

function collectCandidateImage(value) {
  if (!value) return undefined;

  if (typeof value === 'string') {
    if (/^data:image\//.test(value) || /^https?:\/\//.test(value)) {
      return value;
    }
    return undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  if (value.type === 'image_generation_call' && typeof value.result === 'string') {
    return toDataUrl(value.mime_type || value.mimeType || 'image/png', value.result);
  }

  if (value.inlineData?.mimeType?.startsWith('image/') && value.inlineData?.data) {
    return toDataUrl(value.inlineData.mimeType, value.inlineData.data);
  }

  if (value.fileData?.mimeType?.startsWith('image/') && value.fileData?.fileUri) {
    return value.fileData.fileUri;
  }

  if (value.image_url?.url) {
    return value.image_url.url;
  }

  if (value.image_url) {
    return collectCandidateImage(value.image_url);
  }

  if (value.imageUrl) {
    return collectCandidateImage(value.imageUrl);
  }

  if (value.file_uri) {
    return value.file_uri;
  }

  if (value.url && /^https?:\/\//.test(value.url)) {
    return value.url;
  }

  if (value.result) {
    return collectCandidateImage(value.result);
  }

  if (value.b64_json) {
    return toDataUrl(value.mime_type || value.mimeType || 'image/png', value.b64_json);
  }

  if (Array.isArray(value.content)) {
    for (const entry of value.content) {
      const candidate = collectCandidateImage(entry);
      if (candidate) return candidate;
    }
  }

  if (Array.isArray(value.output)) {
    for (const entry of value.output) {
      const candidate = collectCandidateImage(entry);
      if (candidate) return candidate;
    }
  }

  return undefined;
}

function normalizeUserInput(userInput) {
  return typeof userInput === 'string' ? userInput.trim() : '';
}

function canAttachImageReference(asset) {
  return Boolean(
    asset?.kind === 'image-reference' && /^(https?:\/\/|data:image\/)/.test(asset.source),
  );
}

function buildUserText({ userInput, asset }) {
  const sections = [];
  const normalizedUserInput = normalizeUserInput(userInput);

  if (normalizedUserInput) {
    sections.push(`User task:\n${normalizedUserInput}`);
  }

  if (asset && asset.kind !== 'image-reference') {
    sections.push(`Asset context:\n${buildAssetContext(asset)}`);
  }

  return sections.join('\n\n');
}

async function callOpenAI({ prompt, userInput, asset, model, apiKey }) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Add it in the Models view before running a batch test.');
  }

  const content = [];
  const imageReferenceAttached = canAttachImageReference(asset);
  const userText = buildUserText({ userInput, asset: imageReferenceAttached ? undefined : asset });

  if (imageReferenceAttached) {
    content.unshift({
      type: 'input_image',
      image_url: asset.source,
    });
  } else if (asset) {
    const assetContext = buildAssetContext(asset);
    if (assetContext && !userText) {
      content.push({
        type: 'input_text',
        text: `Asset context:\n${assetContext}`,
      });
    }
  }

  if (userText) {
    content.push({
      type: 'input_text',
      text: userText,
    });
  }

  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: prompt.systemPrompt }],
    },
  ];

  if (content.length > 0) {
    input.push({
      role: 'user',
      content,
    });
  }

  const started = Date.now();
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.apiModel,
      tools: [
        {
          type: 'image_generation',
          action: 'generate',
          size: '1024x1024',
          quality: 'high',
        },
      ],
      tool_choice: { type: 'image_generation' },
      input,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI request failed.');
  }

  const outputImage = collectCandidateImage(payload);
  const output = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('\n').trim();
  return {
    output: output || (outputImage ? 'OpenAI returned image output.' : 'OpenAI returned no text output.'),
    outputImage,
    latencyMs: Date.now() - started,
  };
}

async function callGemini({ prompt, userInput, asset, model, apiKey }) {
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add it in the Models view before running a batch test.');
  }

  const imageData = asset?.kind === 'image-reference' ? parseImageDataUrl(asset.source) : null;
  const userText = buildUserText({ userInput, asset: imageData ? undefined : asset });
  const userParts = [];

  if (userText) {
    userParts.push({ text: userText });
  }

  if (imageData) {
    userParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    });
  }

  if (userParts.length === 0) {
    // Gemini requires at least one content part even when the system prompt carries the full task.
    userParts.push({ text: ' ' });
  }

  const started = Date.now();
  const response = await fetch(`${GEMINI_URL}/${model.apiModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: prompt.systemPrompt.trim() }],
      },
      contents: [
        {
          parts: userParts,
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Gemini request failed.');
  }

  const parts = payload.candidates?.[0]?.content?.parts || [];
  const outputImage = parts.map((part) => collectCandidateImage(part)).find(Boolean);
  const output = parts.map((part) => part.text || '').join('\n').trim();
  const returnedImage = parts.some((part) => part.inlineData || part.fileData);
  return {
    output: output || (returnedImage ? 'Gemini returned image output.' : 'Gemini returned no text output.'),
    outputImage,
    latencyMs: Date.now() - started,
  };
}

async function callXAI({ prompt, userInput, asset, model, apiKey }) {
  if (!apiKey) {
    throw new Error('Missing xAI API key. Add it in the Models view before running a batch test.');
  }

  const content = [];
  const imageReferenceAttached = canAttachImageReference(asset);
  const userText = buildUserText({ userInput, asset: imageReferenceAttached ? undefined : asset });

  if (imageReferenceAttached) {
    content.unshift({
      type: 'image_url',
      image_url: {
        url: asset.source,
      },
    });
  } else if (asset) {
    const assetContext = buildAssetContext(asset);
    if (assetContext && !userText) {
      content.push({
        type: 'text',
        text: `Asset context:\n${assetContext}`,
      });
    }
  }

  if (userText) {
    content.push({
      type: 'text',
      text: userText,
    });
  }

  const messages = [
    {
      role: 'system',
      content: prompt.systemPrompt,
    },
  ];

  if (content.length > 0) {
    messages.push({
      role: 'user',
      content,
    });
  }

  const started = Date.now();
  const response = await fetch(XAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.apiModel,
      temperature: model.temperature,
      max_tokens: model.maxTokens,
      messages,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'xAI request failed.');
  }

  const output = payload.choices?.[0]?.message?.content?.trim();
  const outputImage = collectCandidateImage(payload.choices?.[0]?.message?.content);
  return {
    output: output || 'xAI returned no text output.',
    outputImage,
    latencyMs: Date.now() - started,
  };
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
    const { prompt, asset, models, userInput } = body || {};
    const normalizedUserInput = normalizeUserInput(userInput);

    if (!prompt?.systemPrompt || !Array.isArray(models) || models.length === 0) {
      return json(res, 400, { error: 'Missing prompt or models in request body.' });
    }

    const executions = await Promise.all(
      models.map(async (model) => {
        try {
          let execution;
          const apiKey = await getProviderApiKey(user, model.provider);
          if (model.provider === 'openai') {
            execution = await callOpenAI({ prompt, userInput: normalizedUserInput, asset, model, apiKey });
          } else if (model.provider === 'gemini') {
            execution = await callGemini({ prompt, userInput: normalizedUserInput, asset, model, apiKey });
          } else {
            execution = await callXAI({ prompt, userInput: normalizedUserInput, asset, model, apiKey });
          }

          return {
            ok: true,
            result: {
              modelId: model.id,
              output: execution.output,
              outputImage: execution.outputImage,
              latencyMs: execution.latencyMs,
              score: scoreOutput(execution.output),
            },
          };
        } catch (error) {
          return {
            ok: false,
            error: {
              modelId: model.id,
              message:
                error instanceof Error ? error.message : 'Model request failed unexpectedly.',
            },
          };
        }
      }),
    );

    const results = executions.filter((entry) => entry.ok).map((entry) => entry.result);
    const errors = executions.filter((entry) => !entry.ok).map((entry) => entry.error);

    if (results.length === 0 && errors.length > 0) {
      return json(res, 200, { results: [], errors });
    }

    return json(res, 200, { results, errors });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Batch run failed unexpectedly.',
    });
  }
}
