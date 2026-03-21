export type Provider = 'openai' | 'gemini' | 'xai';

export type ProviderKeyStatus = {
  hasKey: boolean;
  updatedAt?: string | null;
};

export type ProviderKeyMap = Record<Provider, ProviderKeyStatus>;

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

export type AssetKind = 'text-inputs' | 'image-reference';

export type AssetRecord = {
  id: string;
  name: string;
  kind: AssetKind;
  source: string;
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
  promptIds?: string[];
  assetIds?: string[];
  userInputAssetIds?: string[];
  assetId?: string;
  modelIds: string[];
  userInput?: string;
};

export type TestResult = {
  id: string;
  promptId: string;
  modelId: string;
  assetId?: string;
  userInput?: string;
  output: string;
  outputImage?: string;
  latencyMs: number;
  score: number;
};

export type BatchRunStatus = 'running' | 'completed' | 'failed';

export type BatchRun = {
  id: string;
  name: string;
  createdAt: string;
  status: BatchRunStatus;
  errorMessage?: string;
  scenario: BatchScenario;
  results: TestResult[];
};

export type AppStatePayload = {
  promptProjects: PromptProject[];
  promptVersions: PromptVersion[];
  assets: AssetRecord[];
  models: ModelRecord[];
  history: BatchRun[];
};
