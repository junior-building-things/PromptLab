export type Provider = 'openai' | 'gemini';

export type PromptProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptVersion = {
  id: string;
  projectId: string;
  version: number;
  title: string;
  summary: string;
  systemPrompt: string;
  tags: string[];
  updatedAt: string;
  runCount: number;
};

export type AssetKind = 'image' | 'document' | 'text';

export type AssetRecord = {
  id: string;
  name: string;
  kind: AssetKind;
  source: string;
  note: string;
  updatedAt: string;
};

export type ModelRecord = {
  id: string;
  name: string;
  provider: Provider;
  apiModel: string;
  endpoint: string;
  temperature: number;
  maxTokens: number;
  status: 'ready' | 'draft';
  envVar: string;
};

export type BatchScenario = {
  promptId: string;
  assetId?: string;
  modelIds: string[];
  userInput: string;
};

export type TestResult = {
  id: string;
  promptId: string;
  modelId: string;
  assetId?: string;
  output: string;
  latencyMs: number;
  score: number;
};

export type BatchRun = {
  id: string;
  name: string;
  createdAt: string;
  scenario: BatchScenario;
  results: TestResult[];
};
