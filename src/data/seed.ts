import type { AssetRecord, BatchRun, ModelRecord, PromptRecord } from '../lib/types';

export const initialPrompts: PromptRecord[] = [
  {
    id: 'prompt-onboarding',
    title: 'Onboarding Explainer',
    summary: 'Explain a new feature clearly without sounding robotic.',
    systemPrompt:
      'You are a product copywriter. Turn product context into concise launch messaging with clear benefits, no hype, and concrete user outcomes.',
    tags: ['launch', 'copy', 'product'],
    updatedAt: '2026-03-08T16:10:00.000Z',
    runCount: 18,
  },
  {
    id: 'prompt-support',
    title: 'Support Draft Triage',
    summary: 'Categorize inbound support issues and draft a first response.',
    systemPrompt:
      'You are a support operations assistant. Classify the issue, identify urgency, and draft a response that is calm, direct, and policy-safe.',
    tags: ['support', 'ops'],
    updatedAt: '2026-03-09T01:05:00.000Z',
    runCount: 11,
  },
  {
    id: 'prompt-vision',
    title: 'Vision Prompt Critique',
    summary: 'Review prompt quality for multimodal generation jobs.',
    systemPrompt:
      'You are a prompt engineer. Evaluate prompt clarity, missing constraints, and likely failure modes when used with image-capable foundation models.',
    tags: ['evaluation', 'multimodal'],
    updatedAt: '2026-03-07T13:45:00.000Z',
    runCount: 7,
  },
];

export const initialAssets: AssetRecord[] = [
  {
    id: 'asset-release-notes',
    name: 'Q2 Release Notes',
    kind: 'document',
    source: 'https://example.com/release-notes.pdf',
    note: 'Reference doc for launch-writing and support flows.',
    updatedAt: '2026-03-08T15:20:00.000Z',
  },
  {
    id: 'asset-dashboard',
    name: 'Analytics Dashboard Screenshot',
    kind: 'image',
    source: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    note: 'Used for multimodal testing against OpenAI and Gemini image-capable models.',
    updatedAt: '2026-03-07T12:00:00.000Z',
  },
  {
    id: 'asset-ticket',
    name: 'Escalation Ticket Transcript',
    kind: 'text',
    source: 'Customer reports billing mismatch after plan upgrade and asks for a refund timeline.',
    note: 'Raw text asset for support draft evaluation.',
    updatedAt: '2026-03-09T02:10:00.000Z',
  },
];

export const initialModels: ModelRecord[] = [
  {
    id: 'model-openai-4o',
    name: 'GPT-4o',
    provider: 'openai',
    apiModel: 'gpt-4o',
    endpoint: 'Responses API',
    temperature: 0.4,
    maxTokens: 1200,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-openai-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    apiModel: 'gpt-4.1-mini',
    endpoint: 'Responses API',
    temperature: 0.2,
    maxTokens: 900,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    apiModel: 'gemini-2.5-pro',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1400,
    status: 'draft',
    envVar: 'VITE_GEMINI_API_KEY',
  },
];

export const initialHistory: BatchRun[] = [
  {
    id: 'run-launch-001',
    name: 'Launch Copy Regression Check',
    createdAt: '2026-03-08T17:45:00.000Z',
    scenario: {
      promptId: 'prompt-onboarding',
      assetId: 'asset-release-notes',
      modelIds: ['model-openai-4o', 'model-gemini-2.5-pro'],
      userInput: 'Summarize what shipped and draft a friendly in-app announcement.',
    },
    results: [
      {
        id: 'result-launch-openai',
        promptId: 'prompt-onboarding',
        modelId: 'model-openai-4o',
        assetId: 'asset-release-notes',
        latencyMs: 1820,
        score: 92,
        output:
          'The release introduces faster review routing, cleaner analytics, and fewer setup steps. Draft: “New in PromptLab: faster experiment tracking, cleaner signal on prompt performance, and a simpler setup flow for your team.”',
      },
      {
        id: 'result-launch-gemini',
        promptId: 'prompt-onboarding',
        modelId: 'model-gemini-2.5-pro',
        assetId: 'asset-release-notes',
        latencyMs: 2240,
        score: 88,
        output:
          'This update focuses on reducing time-to-insight with a simpler dashboard and smoother run setup. Draft: “PromptLab now helps teams compare prompt runs faster, with less setup overhead and clearer results.”',
      },
    ],
  },
];
