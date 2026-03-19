import { readSession } from './_lib/auth.js';
import { getProviderApiKey } from './_lib/store.js';
import { PNG } from 'pngjs';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const BRIA_REMOVE_BG_URL = 'https://engine.prod.bria-api.com/v2/image/edit/remove_background';
const OUTLINE_RADIUS = 6;
const OUTLINE_ALPHA_THRESHOLD = 16;

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

function normalizeBriaImageInput(source) {
  if (!source) {
    return null;
  }

  const dataUrl = parseImageDataUrl(source);
  if (dataUrl) {
    return dataUrl.data;
  }

  if (/^https?:\/\//.test(source)) {
    return source;
  }

  return null;
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

function buildOutlineOffsets(radius) {
  const offsets = [];
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) {
        offsets.push([x, y]);
      }
    }
  }
  return offsets;
}

function addPaddingToPng(image, padding) {
  if (padding <= 0) {
    return image;
  }

  const paddedWidth = image.width + padding * 2;
  const paddedHeight = image.height + padding * 2;
  const paddedData = Buffer.alloc(paddedWidth * paddedHeight * 4, 0);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceOffset = (y * image.width + x) * 4;
      const targetOffset = ((y + padding) * paddedWidth + (x + padding)) * 4;
      paddedData[targetOffset] = image.data[sourceOffset];
      paddedData[targetOffset + 1] = image.data[sourceOffset + 1];
      paddedData[targetOffset + 2] = image.data[sourceOffset + 2];
      paddedData[targetOffset + 3] = image.data[sourceOffset + 3];
    }
  }

  return new PNG({
    width: paddedWidth,
    height: paddedHeight,
    data: paddedData,
  });
}

function buildExternalBackgroundMask(solidMask, width, height) {
  const externalMask = new Uint8Array(width * height);
  const queue = [];
  let queueIndex = 0;

  function enqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const index = y * width + x;
    if (solidMask[index] === 1 || externalMask[index] === 1) {
      return;
    }

    externalMask[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueIndex < queue.length) {
    const index = queue[queueIndex];
    queueIndex += 1;

    const x = index % width;
    const y = Math.floor(index / width);

    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return externalMask;
}

function addWhiteOutlineToPng(buffer, radius = OUTLINE_RADIUS) {
  const originalImage = PNG.sync.read(buffer);
  const paddedImage = addPaddingToPng(originalImage, radius);
  const { width, height, data } = paddedImage;
  const pixelCount = width * height;
  const solidMask = new Uint8Array(pixelCount);

  for (let index = 0; index < pixelCount; index += 1) {
    if (data[index * 4 + 3] >= OUTLINE_ALPHA_THRESHOLD) {
      solidMask[index] = 1;
    }
  }

  const externalMask = buildExternalBackgroundMask(solidMask, width, height);
  const outlineMask = new Uint8Array(pixelCount);
  const offsets = buildOutlineOffsets(radius);

  for (let index = 0; index < pixelCount; index += 1) {
    if (solidMask[index] !== 1) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);

    for (const [offsetX, offsetY] of offsets) {
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;

      if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
        continue;
      }

      const neighborIndex = neighborY * width + neighborX;
      if (externalMask[neighborIndex] === 1) {
        outlineMask[neighborIndex] = 1;
      }
    }
  }

  const outlinedData = Buffer.from(data);

  for (let index = 0; index < pixelCount; index += 1) {
    if (outlineMask[index] !== 1 || solidMask[index] === 1) {
      continue;
    }

    const offset = index * 4;
    outlinedData[offset] = 255;
    outlinedData[offset + 1] = 255;
    outlinedData[offset + 2] = 255;
    outlinedData[offset + 3] = 255;
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    if (data[offset + 3] === 0) {
      continue;
    }

    outlinedData[offset] = data[offset];
    outlinedData[offset + 1] = data[offset + 1];
    outlinedData[offset + 2] = data[offset + 2];
    outlinedData[offset + 3] = data[offset + 3];
  }

  return PNG.sync.write(
    new PNG({
      width,
      height,
      data: outlinedData,
    }),
  );
}

async function fetchImageAsDataUrl(source) {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error('Failed to download Bria background-removal result.');
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const originalBuffer = Buffer.from(await response.arrayBuffer());
  const processedBuffer =
    contentType.startsWith('image/png') ? addWhiteOutlineToPng(originalBuffer) : originalBuffer;

  return toDataUrl(contentType, processedBuffer.toString('base64'));
}

async function removeBackgroundWithBria(source) {
  const apiToken = process.env.BRIA_API_TOKEN?.trim();
  const image = normalizeBriaImageInput(source);

  if (!apiToken || !image) {
    return source;
  }

  const response = await fetch(BRIA_REMOVE_BG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_token: apiToken,
    },
    body: JSON.stringify({
      image,
      preserve_alpha: true,
      sync: true,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || 'Bria background removal failed.');
  }

  const imageUrl = payload.result?.image_url;
  if (!imageUrl) {
    throw new Error('Bria returned no processed image URL.');
  }

  return fetchImageAsDataUrl(imageUrl);
}

async function postProcessOutputImage(execution) {
  if (!execution?.outputImage) {
    return execution;
  }

  try {
    const cleanedImage = await removeBackgroundWithBria(execution.outputImage);
    return {
      ...execution,
      outputImage: cleanedImage || execution.outputImage,
    };
  } catch (error) {
    console.error('Background removal failed.', error);
    return execution;
  }
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

async function callOpenAI({ prompt, userInput, asset, model, apiKey }) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Add it in the Models view before running a batch test.');
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
  const instructionLines = [
    prompt.systemPrompt.trim(),
    `User task:\n${userInput}`,
    imageData ? 'Reference image attached below.' : undefined,
    !imageData ? `Asset context:\n${buildAssetContext(asset) || 'None provided.'}` : undefined,
  ].filter(Boolean);
  const userParts = [{ text: instructionLines.join('\n\n') }];

  if (imageData) {
    userParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    });
  }

  const started = Date.now();
  const response = await fetch(`${GEMINI_URL}/${model.apiModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
      Authorization: `Bearer ${apiKey}`,
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

    if (!prompt?.systemPrompt || !Array.isArray(models) || models.length === 0 || !userInput) {
      return json(res, 400, { error: 'Missing prompt, models, or userInput in request body.' });
    }

    const executions = await Promise.all(
      models.map(async (model) => {
        try {
          let execution;
          const apiKey = await getProviderApiKey(user, model.provider);
          if (model.provider === 'openai') {
            execution = await callOpenAI({ prompt, userInput, asset, model, apiKey });
          } else if (model.provider === 'gemini') {
            execution = await callGemini({ prompt, userInput, asset, model, apiKey });
          } else {
            execution = await callXAI({ prompt, userInput, asset, model, apiKey });
          }

          execution = await postProcessOutputImage(execution);

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
