import type { AssetRecord, BatchRun, ModelRecord, PromptProject, PromptVersion } from '../lib/types';

export const initialPromptProjects: PromptProject[] = [
  {
    id: 'project-onboarding',
    name: 'Onboarding Explainer',
    createdAt: '2026-03-02T08:00:00.000Z',
    updatedAt: '2026-03-08T16:10:00.000Z',
  },
  {
    id: 'project-support',
    name: 'Support Draft Triage',
    createdAt: '2026-03-03T09:00:00.000Z',
    updatedAt: '2026-03-09T01:05:00.000Z',
  },
  {
    id: 'project-vision',
    name: 'Vision Prompt Critique',
    createdAt: '2026-03-04T10:00:00.000Z',
    updatedAt: '2026-03-07T13:45:00.000Z',
  },
];

export const initialPromptVersions: PromptVersion[] = [
  {
    id: 'prompt-onboarding-v1',
    projectId: 'project-onboarding',
    version: 1,
    title: 'Initial framing draft',
    summary: 'First pass for explaining a new feature clearly without sounding robotic.',
    systemPrompt:
      'You are a product copywriter. Explain the feature and benefits clearly, avoid hype, and keep the structure easy to scan.',
    tags: ['launch', 'copy'],
    updatedAt: '2026-03-05T14:00:00.000Z',
    runCount: 4,
  },
  {
    id: 'prompt-onboarding-v2',
    projectId: 'project-onboarding',
    version: 2,
    title: 'Launch-message refinement',
    summary: 'Tightened benefits language and clearer framing for in-app surfaces.',
    systemPrompt:
      'You are a product copywriter. Turn product context into concise launch messaging with clear benefits, no hype, and concrete user outcomes. Prefer short sentences and scannable structure.',
    tags: ['launch', 'copy', 'product'],
    updatedAt: '2026-03-07T11:20:00.000Z',
    runCount: 6,
  },
  {
    id: 'prompt-onboarding-v3',
    projectId: 'project-onboarding',
    version: 3,
    title: 'Current production candidate',
    summary: 'Latest launch explainer tuned for product announcements and app copy.',
    systemPrompt:
      'You are a product copywriter. Turn product context into concise launch messaging with clear benefits, no hype, and concrete user outcomes.',
    tags: ['launch', 'copy', 'product'],
    updatedAt: '2026-03-08T16:10:00.000Z',
    runCount: 8,
  },
  {
    id: 'prompt-support-v1',
    projectId: 'project-support',
    version: 1,
    title: 'Support issue classifier',
    summary: 'Categorize inbound support issues and draft a calm first response.',
    systemPrompt:
      'You are a support operations assistant. Classify the issue, identify urgency, and draft a response that is calm, direct, and policy-safe.',
    tags: ['support', 'ops'],
    updatedAt: '2026-03-09T01:05:00.000Z',
    runCount: 11,
  },
  {
    id: 'prompt-vision-v1',
    projectId: 'project-vision',
    version: 1,
    title: 'Multimodal prompt QA',
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
  {
    id: 'model-openai-gpt-image',
    name: 'gpt-image-1.5 (GPT-4o)',
    provider: 'openai',
    apiModel: 'gpt-4o',
    endpoint: 'Responses API',
    temperature: 0.4,
    maxTokens: 1200,
    status: 'ready',
    envVar: 'VITE_OPENAI_API_KEY',
  },
  {
    id: 'model-gemini-nano-banana',
    name: 'Nano Banana (gemini-2.5-flash)',
    provider: 'gemini',
    apiModel: 'gemini-2.5-flash',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1400,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
  {
    id: 'model-gemini-nano-banana-pro',
    name: 'Nano Banana Pro (gemini-3-pro)',
    provider: 'gemini',
    apiModel: 'gemini-3-pro',
    endpoint: 'Generate Content API',
    temperature: 0.5,
    maxTokens: 1600,
    status: 'ready',
    envVar: 'VITE_GEMINI_API_KEY',
  },
];

export const initialHistory: BatchRun[] = [
  {
    id: 'run-launch-001',
    name: 'Launch Copy Regression Check',
    createdAt: '2026-03-08T17:45:00.000Z',
    scenario: {
      promptId: 'prompt-onboarding-v3',
      assetIds: ['asset-release-notes'],
      userInputAssetIds: ['asset-release-notes'],
      assetId: 'asset-release-notes',
      modelIds: ['model-openai-gpt-image', 'model-gemini-nano-banana'],
      userInput: 'Summarize what shipped and draft a friendly in-app announcement.',
    },
    results: [
      {
        id: 'result-launch-openai',
        promptId: 'prompt-onboarding-v3',
        modelId: 'model-openai-gpt-image',
        assetId: 'asset-release-notes',
        userInput: 'Summarize what shipped and draft a friendly in-app announcement.',
        latencyMs: 1820,
        score: 92,
        output:
          'The release introduces faster review routing, cleaner analytics, and fewer setup steps. Draft: “New in PromptLab: faster experiment tracking, cleaner signal on prompt performance, and a simpler setup flow for your team.”',
      },
      {
        id: 'result-launch-gemini',
        promptId: 'prompt-onboarding-v3',
        modelId: 'model-gemini-nano-banana',
        assetId: 'asset-release-notes',
        userInput: 'Summarize what shipped and draft a friendly in-app announcement.',
        latencyMs: 2240,
        score: 88,
        output:
          'This update focuses on reducing time-to-insight with a simpler dashboard and smoother run setup. Draft: “PromptLab now helps teams compare prompt runs faster, with less setup overhead and clearer results.”',
      },
    ],
  },
];
