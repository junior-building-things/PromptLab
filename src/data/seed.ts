import type { AssetRecord, BatchRun, ModelRecord, PromptProject, PromptVersion } from '../lib/types';

export const initialPromptProjects: PromptProject[] = [
  {
    id: 'project-ugc-sticker-tagging',
    name: 'UGC sticker tagging',
    createdAt: '2026-08-13T21:18:26.740Z',
    updatedAt: '2026-08-14T00:03:21.121Z',
  },
  {
    id: 'project-sa-duo',
    name: 'SA Duo',
    createdAt: '2026-05-22T03:29:32.228Z',
    updatedAt: '2026-05-22T03:29:32.228Z',
  },
];

export const initialPromptVersions: PromptVersion[] = [
  {
    id: 'prompt-ugc-sticker-tagging-v1',
    projectId: 'project-ugc-sticker-tagging',
    version: 1,
    title: 'Prompt v1',
    summary: '',
    systemPrompt: `You are an expert of internet culture, specializing in the meaning and use of memes and online stickers. Analyze the provided sticker video and generate a set of tags that may trigger the video during typing of online chat. These tags can be words or a short phrases.

They should cover the following aspects: 
Description: List at least 3 strings describing the emotions, 
Expression
actions by the main subject focused in the video.
Assuming you are the main subject presented in the video/image, what is the expression you want to say. 
IP: Identify any celebrity, fictional character, movie, video game, famous painting or other famous intellectual property (IP) that the subject most closely resembles or is related to. If there is no obvious or strong resemblance, respond with “None”. 
OCR: A single string containing the exact text from the video. If no text is present, state "None".
InternetSlang: List relevant internet slang that could be associated with the video.
Emoji: List relevant emojis that could be associated with the video.
Other: Identify OTHER words that could be associated with the video. If there is no OTHER obvious words, respond with “None”.

Return your answers in STRICT JSON format where the keys are: "Description", "IP", "OCR", "InternetSlang", "Emoji", "Other".
Do NOT include any introductory text, reasoning or other explanations apart from your answers.`,
    tags: [],
    updatedAt: '2026-08-14T00:03:21.121Z',
    runCount: 0,
  },
  {
    id: 'prompt-ugc-sticker-tagging-v2',
    projectId: 'project-ugc-sticker-tagging',
    version: 2,
    title: 'Prompt v2',
    summary: '',
    systemPrompt: `You are an expert of internet culture, specializing in the meaning and use of memes and online stickers. Analyze the provided sticker — which may be a static image or an animated clip — and generate a set of tags that may trigger it during typing of online chat. These tags can be words or short phrases.

Return your answers in STRICT JSON format matching this exact structure:

{
  "Description": {
    "visual": [],
    "emotion": []
  },
  "IP": {
    "character": [],
    "franchise": [],
    "meme_format": []
  },
  "OCR": [],
  "Expression": {
    "intent": [],
    "slang": [],
    "emoji": []
  },
  "Other": []
}

Detailed Field Guidelines:

Across all categories, each entry must be a single self-contained phrase. Always return both the complete phrase and any shorter form of it that stands on its own (e.g. "bombastic side eye" -> "side eye"). This does not apply to OCR, which must reproduce the text exactly as shown. Return an empty array for any field that does not apply — never invent a tag to avoid leaving a field empty.

- Description: What the sticker itself shows — the observable content and the mood it conveys.
  - "visual": What is actually observable — facial expression, pose, body position, and for animated clips, any movement or action.
  - "emotion": The core emotions or moods conveyed by the sticker.
- IP: The recognizable source the sticker comes from — who is in it and where it originates. Shorter forms must still identify the subject on their own — "JK" for "Jungkook" is useful, a bare common first name is not. Only name a source you actually recognize; leave the arrays empty rather than guessing at a plausible-sounding character or franchise.
  - "character": Named individuals or characters featured, including animals with a recognized identity (e.g. "Doge", "Grumpy Cat"). Use the character name for scripted content and the real name for unscripted content, interviews, and performances. Include the full canonical name plus common alternate forms — stage names, nicknames, initials, and standard alternate romanizations.
  - "franchise": Groups, series, shows, films, games, or brands the content originates from (e.g. "BTS", "Pokémon"). Include widely used abbreviations and alternate names.
  - "meme_format": Recognizable meme templates or edit styles applied (e.g. "distracted boyfriend", "deep-fried"). Include common alternate phrasings.
- OCR: The exact text visible in the sticker, as a list of strings — one entry per distinct text element.
- Expression: Ways a user would express what this sticker conveys.
  - "intent": First-person expressions or conversational responses a user would want to say by sending this sticker (e.g. "agreed", "not my problem", "sounds good"). Include both first-person restatements of the mood ("I'm confused") and distinct conversational moves that go beyond it ("wait what"), plus common spelling variants of each.
  - "slang": Internet slang associated with the sticker. Include common abbreviation and spelling forms of each term (e.g. "smh" and "shaking my head").
  - "emoji": Emojis that mean the same thing as this sticker — covering both what is depicted (expression, gesture, object) and the mood conveyed. Return the emoji characters themselves, not names or shortcodes.
- Other: Words that don't fit the categories above but could still be associated with the sticker.

Do NOT include any introductory text, reasoning, explanations, or markdown code fences — output only the JSON object.`,
    tags: [],
    updatedAt: '2026-08-14T00:03:21.121Z',
    runCount: 0,
  },
  {
    id: 'prompt-sa-duo-v1',
    projectId: 'project-sa-duo',
    version: 1,
    title: 'Prompt v1',
    summary: '',
    systemPrompt: `Generate a high-quality 3D full-body rendered composite image featuring a full-body interaction scenario between two characters, based on the provided avatars and input text, white background.

# IMMUTABLE CONSTRAINTS:
- Identity Lock: The face, facial features, hairstyle, skin tone, body type, and 3D art style of the avatars must be completely identical to the input images.
- Visual Style: The entire image must be uniformly rendered in a high-quality, full-body 3D cartoon art style.
- Two-Character Composition: Only two characters are permitted in the frame. 
- Fixed Proportions: Strictly maintain consistent height and body type proportions for both characters.

# EXPRESSION RULES:
- Make the expression dynamic with clear facial features and body pose based on the input text.

# OUTFIT RULES:
- Update the avatar’s outfit to match the input text if the text specifies a particular activity, role, or environment; otherwise, keep the original outfit(No nudity).

# ACTION RULES:
- Express the text content through rich, dynamic interactive actions.

# TEXT RENDERING RULES:
- If the input is an emoji, first analyze the emoji to generate a theme (e.g., 🚀 represents spacesuits, 🍩 represents donuts, 🍴 represents Western dining, 😎 represents wearing sunglasses with a smirk).


# BACKGROUND AND COMPOSITION RULES:
- Background: The background must be a seamless, solid pure white, white covering the entire image canvas completely.
- full-body composition.
- Do not add confetti or motion lines.
- No speech bubbles.`,
    tags: [],
    updatedAt: '2026-05-22T03:29:32.228Z',
    runCount: 0,
  },
];

export const initialAssets: AssetRecord[] = [
  {
    id: 'asset-release-notes',
    name: 'Q2 Release Notes',
    kind: 'text-inputs',
    source: 'headline refresh, onboarding email subject line, release announcement banner, launch tweet draft',
    updatedAt: '2026-03-08T15:20:00.000Z',
  },
  {
    id: 'asset-dashboard',
    name: 'Analytics Dashboard Screenshot',
    kind: 'image-reference',
    source: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    updatedAt: '2026-03-07T12:00:00.000Z',
  },
  {
    id: 'asset-ticket',
    name: 'Escalation Ticket Transcript',
    kind: 'text-inputs',
    source: 'refund request, billing mismatch after upgrade, customer asks for timeline, tone should stay calm',
    updatedAt: '2026-03-09T02:10:00.000Z',
  },
];

export const initialModels: ModelRecord[] = [
  // --- OpenAI Models ---
  // TEXT
  {
    id: 'model-openai-gpt-5-4',
    name: 'gpt-5.4',
    provider: 'openai',
    apiModel: 'gpt-5.4',
    endpoint: 'Responses API',
    temperature: 0.4,
    maxTokens: 1200,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-openai-gpt-5-4-mini',
    name: 'gpt-5.4-mini',
    provider: 'openai',
    apiModel: 'gpt-5.4-mini',
    endpoint: 'Responses API',
    temperature: 0.4,
    maxTokens: 1200,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-openai-gpt-5-4-pro',
    name: 'gpt-5.4-pro',
    provider: 'openai',
    apiModel: 'gpt-5.4-pro',
    endpoint: 'Responses API',
    temperature: 0.4,
    maxTokens: 1200,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-openai-gpt-5-5',
    name: 'gpt-5.5',
    provider: 'openai',
    apiModel: 'gpt-5.5',
    endpoint: 'Responses API',
    temperature: 0.4,
    maxTokens: 1200,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  // IMAGE
  {
    id: 'model-openai-gpt-image-1',
    name: 'gpt-image-1',
    provider: 'openai',
    apiModel: 'gpt-image-1',
    endpoint: 'Image API',
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-openai-gpt-image-1-5',
    name: 'gpt-image-1.5',
    provider: 'openai',
    apiModel: 'gpt-image-1.5',
    endpoint: 'Image API',
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  // VIDEO
  {
    id: 'model-openai-sora-2',
    name: 'sora-2',
    provider: 'openai',
    apiModel: 'sora-2',
    endpoint: 'Video API',
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-openai-sora-2-pro',
    name: 'sora-2-pro',
    provider: 'openai',
    apiModel: 'sora-2-pro',
    endpoint: 'Video API',
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },

  // --- Google Models ---
  // TEXT
  {
    id: 'model-gemini-gemini-3-7-flash',
    name: 'gemini-3.7-flash',
    provider: 'gemini',
    apiModel: 'gemini-3.7-flash',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-6-flash',
    name: 'gemini-3.6-flash',
    provider: 'gemini',
    apiModel: 'gemini-3.6-flash',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-5-flash',
    name: 'gemini-3.5-flash',
    provider: 'gemini',
    apiModel: 'gemini-3.5-flash',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-1-flash-lite',
    name: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    apiModel: 'gemini-3.1-flash-lite',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1400,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-1-pro-preview',
    name: 'gemini-3.1-pro-preview',
    provider: 'gemini',
    apiModel: 'gemini-3.1-pro-preview',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-2-5-pro',
    name: 'gemini-2.5-pro',
    provider: 'gemini',
    apiModel: 'gemini-2.5-pro',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  // IMAGE
  {
    id: 'model-gemini-gemini-2-5-flash-image',
    name: 'gemini-2.5-flash-image',
    provider: 'gemini',
    apiModel: 'gemini-2.5-flash-image',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1400,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-1-flash-image-preview',
    name: 'gemini-3.1-flash-image-preview',
    provider: 'gemini',
    apiModel: 'gemini-3.1-flash-image-preview',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-pro-image-preview',
    name: 'gemini-3-pro-image-preview',
    provider: 'gemini',
    apiModel: 'gemini-3-pro-image-preview',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-gemini-3-6-flash-image',
    name: 'gemini-3.6-flash-image',
    provider: 'gemini',
    apiModel: 'gemini-3.6-flash-image',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  // VIDEO
  {
    id: 'model-gemini-veo-3-1-lite-generate-preview',
    name: 'veo-3.1-lite-generate-preview',
    provider: 'gemini',
    apiModel: 'veo-3.1-lite-generate-preview',
    endpoint: 'Generate Content API',
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-veo-3-1-generate-preview',
    name: 'veo-3.1-generate-preview',
    provider: 'gemini',
    apiModel: 'veo-3.1-generate-preview',
    endpoint: 'Generate Content API',
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },

  // --- xAI Models ---
  // TEXT
  {
    id: 'model-xai-grok-4-3',
    name: 'grok-4.3',
    provider: 'xai',
    apiModel: 'grok-4.3',
    endpoint: 'Chat Completions API',
    temperature: 0.4,
    maxTokens: 1400,
    status: 'ready',
    envVar: 'VITE_XAI_API_KEY',
  },
  // IMAGE
  {
    id: 'model-xai-grok-imagine-image-quality',
    name: 'grok-imagine-image-quality',
    provider: 'xai',
    apiModel: 'grok-imagine-image-quality',
    endpoint: 'Chat Completions API',
    status: 'ready',
    envVar: 'VITE_XAI_API_KEY',
  },
  // VIDEO
  {
    id: 'model-xai-grok-imagine-video',
    name: 'grok-imagine-video',
    provider: 'xai',
    apiModel: 'grok-imagine-video',
    endpoint: 'Chat Completions API',
    status: 'ready',
    envVar: 'VITE_XAI_API_KEY',
  },
];

/** No seeded run history — a fresh workspace starts with the two prompt
 * projects above and an empty Batch Test tab. */
export const initialHistory: BatchRun[] = [];
