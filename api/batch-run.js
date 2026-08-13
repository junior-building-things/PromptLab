import { PNG } from 'pngjs';
import { readSession } from './_lib/auth.js';
import {
  getProviderApiKey,
  isStoredImageUrl,
  readImageAsDataUrl,
  saveImage,
} from './_lib/store.js';

// OpenAI image generation via the Responses API regularly takes 30-90s
// at quality:'high'. Vercel's default function timeout is 10s on the
// Hobby plan and 60s on Pro; raise the ceiling so a slow provider has
// a real chance to finish before the function is killed. Hobby plans
// silently cap this at 60s — Pro / Enterprise honor up to 300s.
export const config = {
  maxDuration: 300,
};

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const BRIA_REMOVE_BG_URL = 'https://engine.prod.bria-api.com/v2/image/edit/remove_background';
const OUTLINE_RADIUS = 20;
const OUTLINE_ALPHA_THRESHOLD = 16;
const EDGE_WHITE_ALPHA_LIMIT = 252;

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

/**
 * Translate the cross-provider thinking-level enum into the field each
 * provider's API actually accepts. Returns `null` when no override
 * should be applied (the caller spreads the result into the request
 * body, so null means "skip this field entirely").
 *
 *   level=='dynamic' / undefined → null (use provider's silent default)
 *   level=='minimal' → OpenAI/xAI 'minimal' (omitted for xAI since
 *     `minimal` isn't a documented value there); Gemini thinkingBudget 0
 *     (disable thinking)
 *   level=='low'/'medium'/'high' → straight passthrough where the
 *     provider has matching vocabulary; mapped to Gemini token presets.
 */
function openAiReasoning(level) {
  if (!level || level === 'dynamic') return null;
  // OpenAI Responses API documents 'minimal' | 'low' | 'medium' | 'high'.
  return { effort: level };
}

function geminiThinkingConfig(level) {
  if (!level || level === 'dynamic') return null;
  // Gemini expects an integer `thinkingBudget` in tokens. Map levels to
  // sensible presets; 0 disables thinking entirely.
  const budgetByLevel = {
    minimal: 0,
    low: 512,
    medium: 4096,
    high: 16384,
  };
  const thinkingBudget = budgetByLevel[level];
  if (thinkingBudget === undefined) return null;
  return { thinkingBudget };
}

function xaiReasoningEffort(level) {
  if (!level || level === 'dynamic') return null;
  // xAI documents low / medium / high. Coerce 'minimal' to 'low' so
  // user intent ("least thinking") still produces the closest available
  // setting rather than silently dropping the override.
  if (level === 'minimal') return 'low';
  if (['low', 'medium', 'high'].includes(level)) return level;
  return null;
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

function createPngWithData(width, height, pixelData) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(pixelData);
  return png;
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

  return createPngWithData(paddedWidth, paddedHeight, paddedData);
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

function buildExteriorEdgeMask(pixelData, externalMask, width, height) {
  const edgeMask = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const alpha = pixelData[index * 4 + 3];
    if (alpha <= 0 || alpha >= EDGE_WHITE_ALPHA_LIMIT) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    let touchesExternalBackground = false;

    for (let offsetY = -1; offsetY <= 1 && !touchesExternalBackground; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) {
          continue;
        }

        const neighborX = x + offsetX;
        const neighborY = y + offsetY;
        if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
          continue;
        }

        const neighborIndex = neighborY * width + neighborX;
        if (externalMask[neighborIndex] === 1) {
          touchesExternalBackground = true;
          break;
        }
      }
    }

    if (touchesExternalBackground) {
      edgeMask[index] = 1;
    }
  }

  return edgeMask;
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
  const exteriorEdgeMask = buildExteriorEdgeMask(data, externalMask, width, height);
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

  const softenedData = Buffer.from(data);
  for (let index = 0; index < pixelCount; index += 1) {
    if (exteriorEdgeMask[index] !== 1) {
      continue;
    }

    const offset = index * 4;
    softenedData[offset] = 255;
    softenedData[offset + 1] = 255;
    softenedData[offset + 2] = 255;
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
    if (softenedData[offset + 3] === 0) {
      continue;
    }

    outlinedData[offset] = softenedData[offset];
    outlinedData[offset + 1] = softenedData[offset + 1];
    outlinedData[offset + 2] = softenedData[offset + 2];
    outlinedData[offset + 3] = softenedData[offset + 3];
  }

  return PNG.sync.write(createPngWithData(width, height, outlinedData));
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

async function postProcessOutputImage(execution, { stickerize } = { stickerize: true }) {
  if (!stickerize || !execution?.outputImage) {
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

function normalizeUserInput(userInput) {
  return typeof userInput === 'string' ? userInput.trim() : '';
}

function resolveGenerationTask(prompt, userInput) {
  const normalizedUserInput = normalizeUserInput(userInput);
  if (normalizedUserInput) {
    return normalizedUserInput;
  }

  return typeof prompt?.systemPrompt === 'string' ? prompt.systemPrompt.trim() : '';
}

function canAttachImageReference(asset) {
  return Boolean(
    asset?.kind === 'image-reference' && /^(https?:\/\/|data:image\/)/.test(asset.source),
  );
}

function buildUserText({ prompt, userInput, asset }) {
  const sections = [];
  const generationTask = resolveGenerationTask(prompt, userInput);

  if (generationTask) {
    sections.push(`User task:\n${generationTask}`);
  }

  if (asset && asset.kind !== 'image-reference') {
    sections.push(`Asset context:\n${buildAssetContext(asset)}`);
  }

  return sections.join('\n\n');
}

async function callOpenAI({ prompt, userInput, asset, model, apiKey, thinkingLevel }) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Add it in the Models view before running a batch test.');
  }

  const content = [];
  const imageReferenceAttached = canAttachImageReference(asset);
  const userText = buildUserText({ prompt, userInput, asset: imageReferenceAttached ? undefined : asset });

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

  // Only force the image_generation tool for image-capable models.
  // Text-only models like gpt-5 / gpt-4o handled the forced tool call
  // by running an internal image-gen pass that took 60-120s and often
  // hit the function timeout. apiModel matches "image" or "gpt-image-1"
  // for the dedicated image families; everything else stays text-only.
  const apiModel = model.apiModel.toLowerCase();
  const isImageModel = apiModel.includes('image');
  const imageGenTools = isImageModel
    ? {
        tools: [
          {
            type: 'image_generation',
            action: 'generate',
            size: '1024x1024',
            quality: 'high',
          },
        ],
        tool_choice: { type: 'image_generation' },
      }
    : {};

  const started = Date.now();
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.apiModel,
      ...imageGenTools,
      input,
      // Reasoning effort knob, conditionally included. Spreading a
      // null-returning helper into the object is a no-op, so
      // 'dynamic' / unset → unchanged request body.
      ...(openAiReasoning(thinkingLevel) ? { reasoning: openAiReasoning(thinkingLevel) } : {}),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI request failed.');
  }

  const outputImage = collectCandidateImage(payload);
  const output =
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text || '')
      .join('\n')
      .trim();
  return {
    output: output || (outputImage ? 'OpenAI returned image output.' : 'OpenAI returned no text output.'),
    outputImage,
    latencyMs: Date.now() - started,
  };
}

async function callGemini({ prompt, userInput, asset, model, apiKey, thinkingLevel }) {
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add it in the Models view before running a batch test.');
  }

  const imageData = asset?.kind === 'image-reference' ? parseImageDataUrl(asset.source) : null;
  const userText = buildUserText({ prompt, userInput, asset: imageData ? undefined : asset });
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
      // Map our cross-provider level into Gemini's numeric thinking
      // budget (lives on generationConfig). null = no override.
      ...(geminiThinkingConfig(thinkingLevel)
        ? { generationConfig: { thinkingConfig: geminiThinkingConfig(thinkingLevel) } }
        : {}),
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

async function callXAI({ prompt, userInput, asset, model, apiKey, thinkingLevel }) {
  if (!apiKey) {
    throw new Error('Missing xAI API key. Add it in the Models view before running a batch test.');
  }

  const content = [];
  const imageReferenceAttached = canAttachImageReference(asset);
  const userText = buildUserText({ prompt, userInput, asset: imageReferenceAttached ? undefined : asset });

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
      // xAI grok 4.3+ exposes reasoning_effort in the Chat Completions
      // shape (low/medium/high). null = no override.
      ...(xaiReasoningEffort(thinkingLevel)
        ? { reasoning_effort: xaiReasoningEffort(thinkingLevel) }
        : {}),
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

/** Reference images live in the image store, not in the workspace
 * JSON, so their `source` is a session-gated URL that no provider can
 * fetch. Pull the bytes back inline before building the request. */
async function resolveAssetImage(user, asset) {
  if (!asset || !isStoredImageUrl(asset.source)) {
    return asset;
  }

  const dataUrl = await readImageAsDataUrl(user, asset.source);
  return dataUrl ? { ...asset, source: dataUrl } : asset;
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
    const stickerize = body?.stickerize !== false;
    // Thinking-effort knob set by the user in the New Batch Test modal.
    // Forwarded to each provider's reasoning field by the call site
    // below; "dynamic" (or omitted) means we don't set anything and
    // let the provider's silent default kick in.
    const thinkingLevel = body?.thinkingLevel || undefined;

    if (!prompt?.systemPrompt || !Array.isArray(models) || models.length === 0) {
      return json(res, 400, { error: 'Missing prompt or models in request body.' });
    }

    const resolvedAsset = await resolveAssetImage(user, asset);

    const executions = await Promise.all(
      models.map(async (model) => {
        try {
          let execution;
          const apiKey = await getProviderApiKey(user, model.provider);
          if (model.provider === 'openai') {
            execution = await callOpenAI({ prompt, userInput: normalizedUserInput, asset: resolvedAsset, model, apiKey, thinkingLevel });
          } else if (model.provider === 'gemini') {
            execution = await callGemini({ prompt, userInput: normalizedUserInput, asset: resolvedAsset, model, apiKey, thinkingLevel });
          } else {
            execution = await callXAI({ prompt, userInput: normalizedUserInput, asset: resolvedAsset, model, apiKey, thinkingLevel });
          }

          execution = await postProcessOutputImage(execution, { stickerize });
          // Park the bytes in the image store and hand back a reference
          // instead — a base64 data URL here would end up inlined in the
          // workspace JSON on every save.
          const storedImage = execution.outputImage
            ? await saveImage(user, execution.outputImage)
            : null;

          return {
            ok: true,
            result: {
              modelId: model.id,
              output: execution.output,
              outputImage: storedImage || execution.outputImage,
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
