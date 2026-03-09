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
  assets?: AssetRecord[];
  models?: ModelRecord[];
  history?: BatchRun[];
};

type AppContextValue = AppState & {
  createPromptProject: (draft?: Partial<PromptProjectDraft>) => { project: PromptProject; version: PromptVersion };
  createPromptVersion: (projectId: string, systemPrompt?: string) => PromptVersion | null;
  updatePromptProject: (projectId: string, updates: Partial<Pick<PromptProject, 'name'>>) => void;
  updatePromptVersion: (versionId: string, draft: PromptVersionDraft) => void;
  removePromptProject: (projectId: string) => void;
  createAsset: (draft: AssetDraft) => void;
  updateAsset: (id: string, draft: AssetDraft) => void;
  updateModel: (id: string, draft: Partial<ModelDraft>) => void;
  createRun: (run: Omit<BatchRun, 'id' | 'createdAt'>) => BatchRun;
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
    assets: legacy.assets ?? initialAssets,
    models: legacy.models ?? initialModels,
    history: legacy.history ?? initialHistory,
  };
}

function loadState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as AppState;
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

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
        history: current.history.filter((run) => !versionIds.has(run.scenario.promptId)),
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

    setState((current) => {
      const target = current.promptVersions.find((version) => version.id === createdRun.scenario.promptId);
      const timestamp = new Date().toISOString();

      return {
        ...current,
        history: [createdRun, ...current.history],
        promptVersions: current.promptVersions.map((version) =>
          version.id === createdRun.scenario.promptId
            ? { ...version, runCount: version.runCount + 1, updatedAt: timestamp }
            : version,
        ),
        promptProjects: target
          ? current.promptProjects.map((project) =>
              project.id === target.projectId ? { ...project, updatedAt: timestamp } : project,
            )
          : current.promptProjects,
      };
    });

    return createdRun;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      createPromptProject,
      createPromptVersion,
      updatePromptProject,
      updatePromptVersion,
      removePromptProject,
      createAsset,
      updateAsset,
      updateModel,
      createRun,
    }),
    [
      createAsset,
      createPromptProject,
      createPromptVersion,
      createRun,
      removePromptProject,
      state,
      updateAsset,
      updateModel,
      updatePromptProject,
      updatePromptVersion,
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
