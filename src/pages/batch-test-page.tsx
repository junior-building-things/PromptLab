import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Cpu,
  CircleAlert,
  FileText,
  History as HistoryIcon,
  ImageIcon,
  LoaderCircle,
  MoreHorizontal,
  Play,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/app-context';
import { getProviderIconSrc, getProviderLabel } from '../lib/model-brand';
import type { AssetRecord, BatchRun, PromptVersion, TestResult } from '../lib/types';

type ApiResult = {
  modelId: string;
  output: string;
  outputImage?: string;
  latencyMs: number;
  score: number;
};

type ApiError = {
  modelId: string;
  message: string;
};

type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
};

type BatchTableCell = {
  rowId: string;
  columnId: string;
  results: TestResult[];
};

type BatchTable = {
  key: string;
  title: string;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string }>;
  cells: Map<string, BatchTableCell>;
};

const BATCH_REQUEST_TIMEOUT_MS = 90000;
const SYSTEM_PROMPT_ONLY_ROW_ID = '__system-prompt-only__';
const SYSTEM_PROMPT_ONLY_ROW_LABEL = 'System Prompt Only';

function parseTextInputs(source: string) {
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function buildSummary(selectedIds: string[], options: DropdownOption[], emptyLabel: string) {
  if (selectedIds.length === 0) return emptyLabel;

  return options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label)
    .join(', ');
}

function isImageOutput(value?: string) {
  return Boolean(value && (/^data:image\//.test(value) || /^https?:\/\//.test(value)));
}

function getImageExtension(value?: string) {
  if (!value) {
    return 'png';
  }

  const dataUrlMatch = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(value);
  if (dataUrlMatch) {
    const extension = dataUrlMatch[1].toLowerCase();
    if (extension === 'jpeg') return 'jpg';
    return extension;
  }

  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpg';
    if (pathname.endsWith('.webp')) return 'webp';
    if (pathname.endsWith('.gif')) return 'gif';
    if (pathname.endsWith('.png')) return 'png';
  } catch {
    return 'png';
  }

  return 'png';
}

function getResultDownloadName(result: TestResult) {
  return `promptlab-sticker-${result.id}.${getImageExtension(result.outputImage)}`;
}

function buildCellKey(rowId: string, columnId: string) {
  return `${rowId}::${columnId}`;
}

function TextIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="multi-dropdown-option-glyph">
      <Icon size={16} />
    </span>
  );
}

function BatchResultCell({
  results,
  isRunning,
  placeholderCount,
  stickerize,
}: {
  results: TestResult[];
  isRunning: boolean;
  placeholderCount: number;
  stickerize: boolean;
}) {
  if (results.length === 0) {
    if (isRunning) {
      return (
        <div className="batch-table-cell-stack">
          {Array.from({ length: placeholderCount }).map((_, index) => (
            <div key={index} className="batch-table-result">
              <div className="batch-table-output-placeholder" />
            </div>
          ))}
        </div>
      );
    }

    return <div className="batch-table-empty">No Result</div>;
  }

  return (
    <div className="batch-table-cell-stack">
      {results.map((result) => (
        <div key={result.id} className="batch-table-result">
          {isImageOutput(result.outputImage) ? (
            <div className={`batch-table-image-wrap${stickerize ? ' is-stickerized' : ''}`}>
              <a
                className="batch-table-download-link"
                href={result.outputImage}
                download={getResultDownloadName(result)}
                aria-label="Download generated sticker"
                title="Download"
              >
                <Download size={16} />
              </a>
              <img
                className="batch-table-output-image"
                src={result.outputImage}
                alt="Generated output"
              />
            </div>
          ) : (
            <div className="batch-table-output-fallback">
              <p>{result.output || 'No image output returned.'}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MultiSelectDropdown({
  label,
  labelIcon,
  options,
  selectedIds,
  onToggle,
  emptyLabel,
}: {
  label: string;
  labelIcon: ReactNode;
  options: DropdownOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [opensUpward, setOpensUpward] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>(288);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setOpensUpward(false);
      setMenuMaxHeight(288);
      return;
    }

    function updateMenuPosition() {
      const trigger = rootRef.current?.querySelector('.multi-dropdown-trigger');
      if (!(trigger instanceof HTMLElement)) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 20;
      const preferredHeight = 288;
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
      const spaceAbove = Math.max(0, rect.top - viewportPadding);
      const shouldOpenUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
      const availableHeight = shouldOpenUpward ? spaceAbove : spaceBelow;

      setOpensUpward(shouldOpenUpward);
      setMenuMaxHeight(Math.min(preferredHeight, availableHeight));
    }

    updateMenuPosition();

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="field-block" ref={rootRef}>
      <span className="field-block-label">
        {labelIcon}
        {label}
      </span>
      <div className={`multi-dropdown${open ? ' is-open' : ''}${opensUpward ? ' opens-upward' : ''}`}>
        <button
          type="button"
          className="multi-dropdown-trigger"
          onClick={() => setOpen((current) => !current)}
        >
          <div className="multi-dropdown-trigger-copy">
            <strong>{buildSummary(selectedIds, options, emptyLabel)}</strong>
          </div>
          <ChevronDown size={16} />
        </button>
        {open ? (
          <div
            className="multi-dropdown-menu"
            style={{ maxHeight: `${menuMaxHeight}px` }}
          >
            {options.map((option) => {
              const checked = selectedIds.includes(option.id);

              return (
                <label
                  key={option.id}
                  className={`multi-dropdown-option${checked ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(option.id)}
                  />
                  {option.icon ? <span className="multi-dropdown-option-icon">{option.icon}</span> : null}
                  <div className="multi-dropdown-option-copy">
                    <strong>{option.label}</strong>
                    {option.description ? <p>{option.description}</p> : null}
                  </div>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BatchTestPage() {
  const { history, promptProjects, promptVersions, assets, models, providerKeys, removeRun, createRun, updateRun } =
    useAppContext();
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [openRunMenuId, setOpenRunMenuId] = useState<string | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>(
    promptVersions[0] ? [promptVersions[0].id] : [],
  );
  const [selectedImageReferenceIds, setSelectedImageReferenceIds] = useState<string[]>([]);
  const [selectedTextInputAssetIds, setSelectedTextInputAssetIds] = useState<string[]>(
    assets.find((asset) => asset.kind === 'text-inputs')
      ? [assets.find((asset) => asset.kind === 'text-inputs')!.id]
      : [],
  );
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [stickerize, setStickerize] = useState(true);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!openRunMenuId) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.history-card-menu')) {
        return;
      }

      setOpenRunMenuId(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openRunMenuId]);

  const readyModels = useMemo(
    () => models.filter((model) => model.status === 'ready' && providerKeys[model.provider]?.hasKey),
    [models, providerKeys],
  );
  const versionOptions = useMemo(
    () =>
      promptVersions
        .map((version) => {
          const project = promptProjects.find((entry) => entry.id === version.projectId);
          return {
            ...version,
            projectName: project?.name ?? 'Unknown Project',
          };
        })
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [promptProjects, promptVersions],
  );
  const imageReferenceAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'image-reference'),
    [assets],
  );
  const textInputAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'text-inputs'),
    [assets],
  );

  const promptDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      versionOptions.map((prompt) => ({
        id: prompt.id,
        label: `${prompt.projectName} · v${prompt.version}`,
        description: prompt.title,
        icon: <TextIcon Icon={FileText} />,
      })),
    [versionOptions],
  );

  const imageReferenceDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      imageReferenceAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        icon: (
          <img
            src={asset.source}
            alt={asset.name}
            className="multi-dropdown-option-thumb"
          />
        ),
      })),
    [imageReferenceAssets],
  );

  const textInputDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      textInputAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        description: `${parseTextInputs(asset.source).length} inputs`,
        icon: <TextIcon Icon={FileText} />,
      })),
    [textInputAssets],
  );

  const modelDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      readyModels.map((model) => ({
        id: model.id,
        label: model.name,
        description: getProviderLabel(model.provider),
        icon: (
          <img
            src={getProviderIconSrc(model.provider)}
            alt={getProviderLabel(model.provider)}
            className="model-logo"
          />
        ),
      })),
    [readyModels],
  );

  useEffect(() => {
    setSelectedModelIds((current) => current.filter((id) => readyModels.some((model) => model.id === id)));
  }, [readyModels]);

  function toggleExpand(id: string) {
    setExpandedTests((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRemoveRun(id: string) {
    removeRun(id);
    setOpenRunMenuId(null);
    setExpandedTests((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function getPromptLabel(id: string) {
    const version = promptVersions.find((entry) => entry.id === id);
    if (!version) return 'Unknown Prompt';
    const project = promptProjects.find((entry) => entry.id === version.projectId);
    return `${project?.name ?? 'Unknown Project'} · v${version.version}`;
  }

  function getModel(id: string) {
    return models.find((entry) => entry.id === id);
  }

  function getAsset(id?: string) {
    return assets.find((entry) => entry.id === id);
  }

  function getAssetName(id?: string) {
    return getAsset(id)?.name;
  }

  function getRowLabels(run: BatchRun) {
    const labels = new Map<string, string>();

    run.results.forEach((result) => {
      if (result.userInput) {
        labels.set(result.userInput, result.userInput);
      }
    });

    if (labels.size === 0 && run.scenario.userInput) {
      run.scenario.userInput.split(' | ').forEach((value) => {
        if (value.trim()) {
          labels.set(value, value);
        }
      });
    }

    if (labels.size === 0) {
      return [{ id: SYSTEM_PROMPT_ONLY_ROW_ID, label: SYSTEM_PROMPT_ONLY_ROW_LABEL }];
    }

    return [...labels.entries()].map(([id, label]) => ({ id, label }));
  }

  function buildRunTables(run: BatchRun): BatchTable[] {
    const promptIds =
      run.scenario.promptIds && run.scenario.promptIds.length > 0
        ? run.scenario.promptIds
        : [...new Set(run.results.map((result) => result.promptId))];
    const modelIds =
      run.scenario.modelIds && run.scenario.modelIds.length > 0
        ? run.scenario.modelIds
        : [...new Set(run.results.map((result) => result.modelId))];
    const rows = getRowLabels(run);

    const promptColumns = promptIds.map((id) => ({ id, label: getPromptLabel(id) }));
    const modelColumns = modelIds.map((id) => ({ id, label: getModel(id)?.name ?? 'Unknown Model' }));
    const usePromptColumns = promptColumns.length > 1 || modelColumns.length <= 1;

    const tableConfigs =
      promptColumns.length > 1 && modelColumns.length > 1
        ? modelColumns.map((modelColumn) => ({
            key: modelColumn.id,
            title: modelColumn.label,
            scopeModelId: modelColumn.id,
            columns: promptColumns,
          }))
        : [
            {
              key: 'default',
              title:
                modelColumns.length > 1 && promptColumns.length <= 1
                  ? 'Results'
                  : modelColumns[0]?.label ?? 'Results',
              scopeModelId: undefined,
              columns: usePromptColumns ? promptColumns : modelColumns,
            },
          ];

    return tableConfigs.map((config) => {
      const cells = new Map<string, BatchTableCell>();

      run.results
        .filter((result) => (config.scopeModelId ? result.modelId === config.scopeModelId : true))
        .forEach((result) => {
          const rowId = result.userInput?.trim() ? result.userInput : SYSTEM_PROMPT_ONLY_ROW_ID;
          const columnId = usePromptColumns ? result.promptId : result.modelId;
          const key = buildCellKey(rowId, columnId);
          const existing = cells.get(key);

          if (existing) {
            existing.results.push(result);
            return;
          }

          cells.set(key, {
            rowId,
            columnId,
            results: [result],
          });
        });

      return {
        key: config.key,
        title: config.title,
        columns: config.columns,
        rows,
        cells,
      };
    });
  }

  function openComposer() {
    setComposerOpen(true);
    setErrorMessage('');
  }

  function closeComposer() {
    setComposerOpen(false);
    setErrorMessage('');
  }

  async function executeScenario(
    prompt: PromptVersion,
    selectedModels: typeof models,
    asset: AssetRecord | undefined,
    userInput?: string,
    shouldStickerize = true,
  ) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), BATCH_REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch('/api/batch-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          asset,
          models: selectedModels,
          userInput: userInput?.trim() ? userInput : undefined,
          stickerize: shouldStickerize,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Batch job timed out before the provider returned a result.');
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = (await response.json()) as
      | { results: ApiResult[]; errors?: ApiError[] }
      | { error?: string; details?: string };

    if (!response.ok || !('results' in payload)) {
      const failurePayload = payload as { error?: string; details?: string };
      throw new Error(failurePayload.error || failurePayload.details || 'Batch run failed.');
    }

    return payload;
  }

  async function runBatch() {
    const selectedPrompts = versionOptions.filter((prompt) => selectedPromptIds.includes(prompt.id));
    const selectedModels = readyModels.filter((model) => selectedModelIds.includes(model.id));
    const selectedImageReferences = imageReferenceAssets.filter((asset) =>
      selectedImageReferenceIds.includes(asset.id),
    );
    const selectedUserInputs = textInputAssets
      .filter((asset) => selectedTextInputAssetIds.includes(asset.id))
      .flatMap((asset) => parseTextInputs(asset.source));
    const scenarioUserInputs = selectedUserInputs.length > 0 ? selectedUserInputs : [undefined];

    if (selectedPrompts.length === 0 || selectedModels.length === 0) {
      setErrorMessage(
        readyModels.length === 0
          ? 'Add at least one provider API key in the Models view before running a batch test.'
          : 'Select at least one system prompt and model before running.',
      );
      return;
    }

    const draftScenario = {
      promptId: selectedPrompts[0].id,
      promptIds: selectedPrompts.map((prompt) => prompt.id),
      assetIds: selectedImageReferenceIds.length > 0 ? selectedImageReferenceIds : undefined,
      assetId: selectedImageReferenceIds[0],
      userInputAssetIds: selectedTextInputAssetIds.length > 0 ? selectedTextInputAssetIds : undefined,
      modelIds: selectedModelIds,
      userInput: selectedUserInputs.length > 0 ? selectedUserInputs.join(' | ') : undefined,
      stickerize,
    };
    const draftRun = createRun({
      name:
        selectedPrompts.length === 1
          ? `${getPromptLabel(selectedPrompts[0].id)} - ${format(new Date(), 'MMM d HH:mm')}`
          : `${selectedPrompts.length} Prompt Selections - ${format(new Date(), 'MMM d HH:mm')}`,
      status: 'running',
      errorMessage: undefined,
      scenario: draftScenario,
      results: [],
    });

    setRunning(true);
    setErrorMessage('');
    closeComposer();
    setExpandedTests((current) => new Set([draftRun.id, ...current]));

    try {
      const imageReferenceScenarios = selectedImageReferences.length > 0 ? selectedImageReferences : [undefined];
      const scenarioQueue = selectedPrompts.flatMap((prompt) =>
        imageReferenceScenarios.flatMap((imageReference) =>
          scenarioUserInputs.map((userInput) => ({
            prompt,
            imageReference,
            userInput,
          })),
        ),
      );
      const results: TestResult[] = [];
      const errors: string[] = [];

      await Promise.all(
        scenarioQueue.map(async ({ prompt, imageReference, userInput }) => {
          try {
            const apiPayload = await executeScenario(
              prompt,
              selectedModels,
              imageReference,
              userInput,
              stickerize,
            );

            const nextResults = apiPayload.results.map((result, index) => ({
              id: `result-${prompt.id}-${result.modelId}-${Date.now()}-${results.length + index}`,
              promptId: prompt.id,
              modelId: result.modelId,
              assetId: imageReference?.id,
              userInput,
              output: result.output,
              outputImage: result.outputImage,
              latencyMs: result.latencyMs,
              score: result.score,
            }));

            results.push(...nextResults);

            const errorResults =
              apiPayload.errors?.map((error, index) => ({
                id: `result-error-${prompt.id}-${error.modelId}-${Date.now()}-${results.length + nextResults.length + index}`,
                promptId: prompt.id,
                modelId: error.modelId,
                assetId: imageReference?.id,
                userInput,
                output: `Error: ${error.message}`,
                outputImage: undefined,
                latencyMs: 0,
                score: 0,
              })) ?? [];

            results.push(...errorResults);

            apiPayload.errors?.forEach((error) => {
              const model = getModel(error.modelId);
              errors.push(`${model?.name ?? 'Unknown Model'}: ${error.message}`);
            });

            const uniqueErrors = [...new Set(errors)];
            updateRun(draftRun.id, {
              status: 'running',
              errorMessage: uniqueErrors.length > 0 ? uniqueErrors.join(' | ') : undefined,
              results: [...results],
            });
          } catch (error) {
            errors.push(
              error instanceof Error ? error.message : 'Batch run failed for an unknown reason.',
            );
            const uniqueErrors = [...new Set(errors)];
            updateRun(draftRun.id, {
              status: 'running',
              errorMessage: uniqueErrors.join(' | '),
              results: [...results],
            });
          }
        }),
      );

      const uniqueErrors = [...new Set(errors)];

      updateRun(draftRun.id, {
        status: uniqueErrors.length > 0 ? 'failed' : 'completed',
        errorMessage: uniqueErrors.length > 0 ? uniqueErrors.join(' | ') : undefined,
        results: [...results],
      });
    } catch (error) {
      updateRun(draftRun.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Batch run failed for an unknown reason.',
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="page-stack">
        <header className="hero-card">
          <div>
            <h2>Batch Test</h2>
            <p>Run and review previous batch tests.</p>
          </div>
          <button className="button button-primary" onClick={openComposer}>
            <Play size={16} />
            New Batch Test
          </button>
        </header>

        <div className="stack-list">
          {history.length === 0 ? (
            <div className="surface-card empty-card">
              <HistoryIcon size={44} />
              <h3>No Batch Tests Yet</h3>
              <p>Create a batch test to compare prompts, image references, optional text inputs, and models.</p>
            </div>
          ) : (
            <>
              {history.map((run) => (
                <article key={run.id} className="surface-card history-shell">
                  <div className="history-shell-header">
                    <button className="history-toggle" onClick={() => toggleExpand(run.id)}>
                      <div className="list-card-topline">
                        <div className="icon-pill icon-pill-muted">
                          {expandedTests.has(run.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                        <div>
                          <h3>{run.name}</h3>
                          <div className="history-meta">
                            <span>{format(new Date(run.createdAt), 'MMM d, yyyy HH:mm')}</span>
                            <span
                              className={`pill ${
                                run.status === 'failed'
                                  ? 'pill-danger'
                                  : run.status === 'running'
                                    ? 'pill-progress'
                                    : 'pill-success'
                              }`}
                            >
                              {run.status === 'running' ? (
                                <>
                                  <LoaderCircle size={14} className="spin" />
                                  In Progress
                                </>
                              ) : run.status === 'failed' ? (
                                <>
                                  <CircleAlert size={14} />
                                  Failed
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={14} />
                                  Completed
                                </>
                              )}
                            </span>
                            <span className="pill pill-subtle">{run.results.length} Results</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="card-menu-wrap history-card-menu">
                      <button
                        type="button"
                        className="icon-action-button"
                        aria-label="Open Batch Job Menu"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenRunMenuId((current) => (current === run.id ? null : run.id));
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {openRunMenuId === run.id ? (
                        <div
                          className="card-menu-sheet"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="menu-sheet-action menu-sheet-danger"
                            onClick={() => handleRemoveRun(run.id)}
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {expandedTests.has(run.id) ? (
                    <div className="batch-results-stack">
                      {buildRunTables(run).map((table) => (
                        <div className="surface-card batch-table-shell" key={table.key}>
                          <div className="section-header-inline">
                            <h3>{table.title}</h3>
                          </div>
                          <div className="batch-table-scroll">
                            <table className="batch-results-table">
                              <thead>
                                <tr>
                                  <th>Text Inputs</th>
                                  {table.columns.map((column) => (
                                    <th key={column.id}>{column.label}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row) => (
                                  <tr key={row.id}>
                                    <th>{row.label}</th>
                                    {table.columns.map((column) => {
                                      const cell = table.cells.get(buildCellKey(row.id, column.id));
                                      return (
                                        <td key={column.id}>
                                          <BatchResultCell
                                            results={cell?.results ?? []}
                                            isRunning={run.status === 'running'}
                                            placeholderCount={
                                              run.scenario.assetIds && run.scenario.assetIds.length > 0
                                                ? run.scenario.assetIds.length
                                                : 1
                                            }
                                            stickerize={Boolean(run.scenario.stickerize)}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </>
          )}
        </div>
      </section>

      {composerOpen ? (
        <div className="composer-backdrop" onClick={closeComposer}>
          <section className="surface-card composer-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="composer-sheet-header">
              <div>
                <h3>New Batch Test</h3>
              </div>
              <div className="button-row-inline">
                <button className="button button-secondary" onClick={closeComposer}>
                  Cancel
                </button>
                <button className="button button-primary" onClick={runBatch} disabled={running}>
                  {running ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                  {running ? 'Running...' : 'New Job'}
                </button>
              </div>
            </header>

            <div className="stack-list">
              <MultiSelectDropdown
                label="Choose model"
                labelIcon={<Cpu size={15} />}
                options={modelDropdownOptions}
                selectedIds={selectedModelIds}
                onToggle={(id) => setSelectedModelIds((current) => toggleSelection(current, id))}
                emptyLabel="Choose model"
              />

              <MultiSelectDropdown
                label="Choose system prompt"
                labelIcon={<FileText size={15} />}
                options={promptDropdownOptions}
                selectedIds={selectedPromptIds}
                onToggle={(id) => setSelectedPromptIds((current) => toggleSelection(current, id))}
                emptyLabel="Choose system prompt"
              />

              <MultiSelectDropdown
                label="Add image references (optional)"
                labelIcon={<ImageIcon size={15} />}
                options={imageReferenceDropdownOptions}
                selectedIds={selectedImageReferenceIds}
                onToggle={(id) =>
                  setSelectedImageReferenceIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Add image references (optional)"
              />

              <MultiSelectDropdown
                label="Add text inputs (optional)"
                labelIcon={<FileText size={15} />}
                options={textInputDropdownOptions}
                selectedIds={selectedTextInputAssetIds}
                onToggle={(id) =>
                  setSelectedTextInputAssetIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Add text inputs (optional)"
              />

              <label className="checkbox-card">
                <div className="checkbox-card-copy">
                  <strong>Stickerize</strong>
                  <p className="muted-copy">
                    Remove the background and add the white outline to generated image outputs.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={stickerize}
                  className={`toggle-switch${stickerize ? ' is-active' : ''}`}
                  onClick={() => setStickerize((current) => !current)}
                >
                  <span className="toggle-switch-thumb" />
                </button>
              </label>

              {errorMessage ? (
                <article className="surface-card stat-card error-card">
                  <AlertCircle size={18} />
                  <h3>Run Failed</h3>
                  <p>{errorMessage}</p>
                </article>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
