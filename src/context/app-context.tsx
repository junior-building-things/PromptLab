import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { initialAssets, initialHistory, initialModels, initialPrompts } from '../data/seed';
import type { AssetRecord, BatchRun, ModelRecord, PromptRecord } from '../lib/types';

const STORAGE_KEY = 'promptlab-state-v1';

type PromptDraft = Omit<PromptRecord, 'id' | 'updatedAt' | 'runCount'>;
type AssetDraft = Omit<AssetRecord, 'id' | 'updatedAt'>;
type ModelDraft = Omit<ModelRecord, 'id'>;

type AppState = {
  prompts: PromptRecord[];
  assets: AssetRecord[];
  models: ModelRecord[];
  history: BatchRun[];
};

type AppContextValue = AppState & {
  createPrompt: (draft: PromptDraft) => void;
  updatePrompt: (id: string, draft: PromptDraft) => void;
  createAsset: (draft: AssetDraft) => void;
  updateAsset: (id: string, draft: AssetDraft) => void;
  updateModel: (id: string, draft: Partial<ModelDraft>) => void;
  createRun: (run: Omit<BatchRun, 'id' | 'createdAt'>) => BatchRun;
};

const AppContext = createContext<AppContextValue | null>(null);

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const defaultState: AppState = {
  prompts: initialPrompts,
  assets: initialAssets,
  models: initialModels,
  history: initialHistory,
};

function loadState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaultState;
  }

  try {
    return JSON.parse(stored) as AppState;
  } catch {
    return defaultState;
  }
}

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const createPrompt = useCallback((draft: PromptDraft) => {
    setState((current) => ({
      ...current,
      prompts: [
        {
          id: makeId('prompt'),
          updatedAt: new Date().toISOString(),
          runCount: 0,
          ...draft,
        },
        ...current.prompts,
      ],
    }));
  }, []);

  const updatePrompt = useCallback((id: string, draft: PromptDraft) => {
    setState((current) => ({
      ...current,
      prompts: current.prompts.map((prompt) =>
        prompt.id === id
          ? { ...prompt, ...draft, updatedAt: new Date().toISOString() }
          : prompt,
      ),
    }));
  }, []);

  const createAsset = useCallback((draft: AssetDraft) => {
    setState((current) => ({
      ...current,
      assets: [
        {
          id: makeId('asset'),
          updatedAt: new Date().toISOString(),
          ...draft,
        },
        ...current.assets,
      ],
    }));
  }, []);

  const updateAsset = useCallback((id: string, draft: AssetDraft) => {
    setState((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === id ? { ...asset, ...draft, updatedAt: new Date().toISOString() } : asset,
      ),
    }));
  }, []);

  const updateModel = useCallback((id: string, draft: Partial<ModelDraft>) => {
    setState((current) => ({
      ...current,
      models: current.models.map((model) => (model.id === id ? { ...model, ...draft } : model)),
    }));
  }, []);

  const createRun = useCallback((run: Omit<BatchRun, 'id' | 'createdAt'>) => {
    const createdRun: BatchRun = {
      ...run,
      id: makeId('run'),
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      history: [createdRun, ...current.history],
      prompts: current.prompts.map((prompt) =>
        prompt.id === createdRun.scenario.promptId
          ? { ...prompt, runCount: prompt.runCount + 1, updatedAt: new Date().toISOString() }
          : prompt,
      ),
    }));

    return createdRun;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      createPrompt,
      updatePrompt,
      createAsset,
      updateAsset,
      updateModel,
      createRun,
    }),
    [createAsset, createPrompt, createRun, state, updateAsset, updateModel, updatePrompt],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }

  return context;
}
