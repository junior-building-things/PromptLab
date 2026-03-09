import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  initialAssets,
  initialHistory,
  initialModels,
  initialPromptProjects,
  initialPromptVersions,
} from '../data/seed';
import type {
  AssetRecord,
  BatchRun,
  ModelRecord,
  PromptProject,
  PromptVersion,
} from '../lib/types';

const STORAGE_KEY = 'promptlab-state-v2';

type PromptProjectDraft = {
  name: string;
  systemPrompt: string;
};

type PromptVersionDraft = Omit<PromptVersion, 'id' | 'projectId' | 'version' | 'updatedAt' | 'runCount'>;
type AssetDraft = Omit<AssetRecord, 'id' | 'updatedAt'>;
type ModelDraft = Omit<ModelRecord, 'id'>;

type AppState = {
  promptProjects: PromptProject[];
  promptVersions: PromptVersion[];
  assets: AssetRecord[];
  models: ModelRecord[];
  history: BatchRun[];
};

type LegacyPromptRecord = {
  id: string;
  title: string;
  summary: string;
  systemPrompt: string;
  tags: string[];
  updatedAt: string;
  runCount: number;
};

type LegacyState = {
  prompts?: LegacyPromptRecord[];
  assets?: Array<AssetRecord & { note?: string; kind?: string }>;
  models?: ModelRecord[];
  history?: BatchRun[];
};

type AppContextValue = AppState & {
  createPromptProject: (draft?: Partial<PromptProjectDraft>) => { project: PromptProject; version: PromptVersion };
  createPromptVersion: (projectId: string, systemPrompt?: string) => PromptVersion | null;
  updatePromptProject: (projectId: string, updates: Partial<Pick<PromptProject, 'name'>>) => void;
  updatePromptVersion: (versionId: string, draft: PromptVersionDraft) => void;
  removePromptVersion: (versionId: string) => void;
  removePromptProject: (projectId: string) => void;
  createAsset: (draft: AssetDraft) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, draft: AssetDraft) => void;
  updateModel: (id: string, draft: Partial<ModelDraft>) => void;
  removeRun: (id: string) => void;
  createRun: (run: Omit<BatchRun, 'id' | 'createdAt'>) => BatchRun;
  updateRun: (
    id: string,
    updates: Partial<Pick<BatchRun, 'status' | 'errorMessage' | 'results' | 'scenario' | 'name'>>,
  ) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const defaultState: AppState = {
  promptProjects: initialPromptProjects,
  promptVersions: initialPromptVersions,
  assets: initialAssets,
  models: initialModels,
  history: initialHistory,
};

const legacyModelIdMap: Record<string, string> = {
  'model-openai-4o': 'model-openai-gpt-image',
  'model-gemini-2.5-pro': 'model-gemini-nano-banana',
};

function normalizeAssetKind(kind?: string): AssetRecord['kind'] {
  if (kind === 'image-reference' || kind === 'image') {
    return 'image-reference';
  }

  return 'text-inputs';
}

function normalizeAsset(asset: AssetRecord & { note?: string; kind?: string }): AssetRecord {
  return {
    id: asset.id,
    name: asset.name,
    kind: normalizeAssetKind(asset.kind),
    source: asset.source,
    updatedAt: asset.updatedAt,
  };
}

function normalizeModels(models?: ModelRecord[]): ModelRecord[] {
  if (!models || models.length === 0) {
    return initialModels;
  }

  const persistedById = new Map<string, ModelRecord>();

  models.forEach((model) => {
    persistedById.set(model.id, model);
    const mappedId = legacyModelIdMap[model.id];
    if (mappedId) {
      persistedById.set(mappedId, model);
    }
  });

  return initialModels.map((model) => {
    const persisted = persistedById.get(model.id);
    if (!persisted) {
      return model;
    }

    return {
      ...model,
      temperature: persisted.temperature ?? model.temperature,
      maxTokens: persisted.maxTokens ?? model.maxTokens,
      status: persisted.status ?? model.status,
    };
  });
}

function normalizeHistory(history?: BatchRun[]): BatchRun[] {
  if (!history) {
    return initialHistory;
  }

  return history.map((run) => ({
    ...run,
    status: run.status === 'running' ? 'failed' : (run.status ?? 'completed'),
    errorMessage:
      run.status === 'running'
        ? run.errorMessage || 'This batch job did not complete. The page was likely refreshed or the request timed out.'
        : run.errorMessage,
  }));
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    assets: (state.assets ?? initialAssets).map(normalizeAsset),
    models: normalizeModels(state.models),
    history: normalizeHistory(state.history),
  };
}

function migrateLegacyState(legacy: LegacyState): AppState {
  const prompts = legacy.prompts ?? [];

  return {
    promptProjects: prompts.map((prompt) => ({
      id: `project-${prompt.id}`,
      name: prompt.title,
      createdAt: prompt.updatedAt,
      updatedAt: prompt.updatedAt,
    })),
    promptVersions: prompts.map((prompt) => ({
      id: prompt.id,
      projectId: `project-${prompt.id}`,
      version: 1,
      title: 'Migrated v1',
      summary: prompt.summary,
      systemPrompt: prompt.systemPrompt,
      tags: prompt.tags,
      updatedAt: prompt.updatedAt,
      runCount: prompt.runCount,
    })),
    assets: (legacy.assets ?? initialAssets).map(normalizeAsset),
    models: normalizeModels(legacy.models),
    history: normalizeHistory(legacy.history),
  };
}

function loadState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return normalizeState(JSON.parse(stored) as AppState);
    } catch {
      return defaultState;
    }
  }

  const legacy = window.localStorage.getItem('promptlab-state-v1');
  if (legacy) {
    try {
      return migrateLegacyState(JSON.parse(legacy) as LegacyState);
    } catch {
      return defaultState;
    }
  }

  return defaultState;
}

function latestVersionForProject(versions: PromptVersion[], projectId: string) {
  return versions
    .filter((version) => version.projectId === projectId)
    .sort((left, right) => right.version - left.version)[0];
}

function applyCompletedRun(current: AppState, run: BatchRun): AppState {
  if (run.status !== 'completed') {
    return current;
  }

  const touchedPromptIds = new Set(run.results.map((result) => result.promptId));
  const touchedProjectIds = new Set(
    current.promptVersions
      .filter((version) => touchedPromptIds.has(version.id))
      .map((version) => version.projectId),
  );
  const timestamp = new Date().toISOString();

  return {
    ...current,
    history: current.history.map((entry) => (entry.id === run.id ? run : entry)),
    promptVersions: current.promptVersions.map((version) =>
      touchedPromptIds.has(version.id)
        ? { ...version, runCount: version.runCount + 1, updatedAt: timestamp }
        : version,
    ),
    promptProjects: touchedProjectIds.size > 0
      ? current.promptProjects.map((project) =>
          touchedProjectIds.has(project.id) ? { ...project, updatedAt: timestamp } : project,
        )
      : current.promptProjects,
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist PromptLab state.', error);
    }
  }, [state]);

  const createPromptProject = useCallback((draft?: Partial<PromptProjectDraft>) => {
    const projectId = makeId('project');
    const timestamp = new Date().toISOString();
    const project: PromptProject = {
      id: projectId,
      name: draft?.name ?? 'New Project',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const version: PromptVersion = {
      id: makeId('prompt'),
      projectId,
      version: 1,
      title: 'Prompt v1',
      summary: '',
      systemPrompt:
        draft?.systemPrompt ?? 'Describe the role, task, inputs, and output constraints here.',
      tags: [],
      updatedAt: timestamp,
      runCount: 0,
    };

    setState((current) => ({
      ...current,
      promptProjects: [project, ...current.promptProjects],
      promptVersions: [version, ...current.promptVersions],
    }));

    return { project, version };
  }, []);

  const createPromptVersion = useCallback((projectId: string, systemPrompt?: string) => {
    let created: PromptVersion | null = null;

    setState((current) => {
      const latest = latestVersionForProject(current.promptVersions, projectId);
      if (!latest) {
        return current;
      }

      const timestamp = new Date().toISOString();
      created = {
        ...latest,
        id: makeId('prompt'),
        version: latest.version + 1,
        title: `Prompt v${latest.version + 1}`,
        summary: '',
        systemPrompt: systemPrompt || latest.systemPrompt,
        tags: [],
        updatedAt: timestamp,
        runCount: 0,
      };

      return {
        ...current,
        promptVersions: [created, ...current.promptVersions],
        promptProjects: current.promptProjects.map((project) =>
          project.id === projectId ? { ...project, updatedAt: timestamp } : project,
        ),
      };
    });

    return created;
  }, []);

  const updatePromptProject = useCallback((projectId: string, updates: Partial<Pick<PromptProject, 'name'>>) => {
    setState((current) => ({
      ...current,
      promptProjects: current.promptProjects.map((project) =>
        project.id === projectId
          ? { ...project, ...updates, updatedAt: new Date().toISOString() }
          : project,
      ),
    }));
  }, []);

  const updatePromptVersion = useCallback((versionId: string, draft: PromptVersionDraft) => {
    const timestamp = new Date().toISOString();

    setState((current) => {
      const target = current.promptVersions.find((version) => version.id === versionId);
      if (!target) return current;

      return {
        ...current,
        promptVersions: current.promptVersions.map((version) =>
          version.id === versionId ? { ...version, ...draft, updatedAt: timestamp } : version,
        ),
        promptProjects: current.promptProjects.map((project) =>
          project.id === target.projectId ? { ...project, updatedAt: timestamp } : project,
        ),
      };
    });
  }, []);

  const removePromptProject = useCallback((projectId: string) => {
    setState((current) => {
      const versionIds = new Set(
        current.promptVersions
          .filter((version) => version.projectId === projectId)
          .map((version) => version.id),
      );

      return {
        ...current,
        promptProjects: current.promptProjects.filter((project) => project.id !== projectId),
        promptVersions: current.promptVersions.filter((version) => version.projectId !== projectId),
        history: current.history.filter(
          (run) => !run.results.some((result) => versionIds.has(result.promptId)),
        ),
      };
    });
  }, []);

  const removePromptVersion = useCallback((versionId: string) => {
    setState((current) => {
      const target = current.promptVersions.find((version) => version.id === versionId);
      if (!target) {
        return current;
      }

      const remainingVersions = current.promptVersions.filter((version) => version.id !== versionId);
      const projectHasVersions = remainingVersions.some((version) => version.projectId === target.projectId);

      return {
        ...current,
        promptProjects: projectHasVersions
          ? current.promptProjects
          : current.promptProjects.filter((project) => project.id !== target.projectId),
        promptVersions: remainingVersions,
        history: current.history.filter(
          (run) => !run.results.some((result) => result.promptId === versionId),
        ),
      };
    });
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

  const removeAsset = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== id),
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

  const removeRun = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      history: current.history.filter((run) => run.id !== id),
    }));
  }, []);

  const createRun = useCallback((run: Omit<BatchRun, 'id' | 'createdAt'>) => {
    const createdRun: BatchRun = {
      ...run,
      id: makeId('run'),
      createdAt: new Date().toISOString(),
    };

    setState((current) => {
      if (createdRun.status !== 'completed') {
        return {
          ...current,
          history: [createdRun, ...current.history],
        };
      }

      return applyCompletedRun(
        {
          ...current,
          history: [createdRun, ...current.history],
        },
        createdRun,
      );
    });

    return createdRun;
  }, []);

  const updateRun = useCallback(
    (
      id: string,
      updates: Partial<Pick<BatchRun, 'status' | 'errorMessage' | 'results' | 'scenario' | 'name'>>,
    ) => {
      setState((current) => {
        const existing = current.history.find((run) => run.id === id);
        if (!existing) {
          return current;
        }

        const nextRun: BatchRun = {
          ...existing,
          ...updates,
        };

        const nextState = {
          ...current,
          history: current.history.map((run) => (run.id === id ? nextRun : run)),
        };

        if (existing.status === 'completed' || nextRun.status !== 'completed') {
          return nextState;
        }

        return applyCompletedRun(nextState, nextRun);
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      createPromptProject,
      createPromptVersion,
      updatePromptProject,
      updatePromptVersion,
      removePromptVersion,
      removePromptProject,
      createAsset,
      removeAsset,
      updateAsset,
      updateModel,
      removeRun,
      createRun,
      updateRun,
    }),
    [
      createAsset,
      createPromptProject,
      createPromptVersion,
      createRun,
      removePromptVersion,
      removePromptProject,
      removeAsset,
      removeRun,
      state,
      updateAsset,
      updateModel,
      updatePromptProject,
      updatePromptVersion,
      updateRun,
    ],
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
