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
  X,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { setPageChrome } from '../components/app-layout';
import {
  MultiSelectDropdown,
  type DropdownGroup,
  type DropdownOption as MsdOption,
} from '../components/multi-select-dropdown';
import { useAppContext } from '../context/app-context';

// Small inline helper for the topbar button — gives a lucide icon a
// fixed pixel footprint that matches the design's `.btn svg { 13px }`.
function BoxIcon({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 13,
        height: 13,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
import { getProviderIconSrc, getProviderLabel } from '../lib/model-brand';
import type { AssetRecord, BatchRun, ModelRecord, PromptProject, PromptVersion, TestResult } from '../lib/types';

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

/** Local alias so legacy memo signatures keep using `DropdownOption` —
 * routed through the new component's exported type so additions like
 * `searchText` / `group` flow through. */
type DropdownOption = MsdOption;

type BatchTableCell = {
  rowId: string;
  columnId: string;
  results: TestResult[];
};

type BatchTable = {
  key: string;
  title: string;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string; assetId?: string; userInput?: string }>;
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

function buildRowId(assetId?: string, userInput?: string) {
  if (assetId && userInput) return `${assetId}::${userInput}`;
  if (assetId) return assetId;
  if (userInput) return userInput;
  return SYSTEM_PROMPT_ONLY_ROW_ID;
}

function TextIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="multi-dropdown-option-glyph">
      <Icon size={16} />
    </span>
  );
}

function tryParseJSON(text?: string): any {
  if (!text) return null;
  let trimmed = text.trim();

  // Extract JSON from markdown code blocks (e.g., ```json ... ```)
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch) {
    trimmed = codeBlockMatch[1].trim();
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function BatchResultCell({
  results,
  isRunning,
  placeholderCount,
  stickerize,
  onPreviewImage,
}: {
  results: TestResult[];
  isRunning: boolean;
  placeholderCount: number;
  stickerize: boolean;
  onPreviewImage: (imageSrc: string) => void;
}) {
  if (results.length === 0) {
    if (isRunning) {
      // Loading state from the Claude Design PromptLab.html mockup:
      // a square (aspect-ratio 1/1) thumb panel with a violet
      // shimmer sweeping across it. The `.batch-thumb.loading`
      // keyframes live in styles.css (shimmer-thumb, 1.6 s ease).
      // One thumb per pending result — stacked vertically when a
      // single matrix cell expects multiple results (e.g. when the
      // run targets multiple image-reference assets).
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%',
          }}
        >
          {Array.from({ length: Math.max(1, placeholderCount) }).map((_, index) => (
            <div key={index} className="batch-thumb loading" />
          ))}
        </div>
      );
    }

    return (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          textAlign: 'center',
          width: '100%',
        }}
      >
        No result
      </div>
    );
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
              <button
                type="button"
                className="batch-table-image-preview-button"
                onClick={() => onPreviewImage(result.outputImage!)}
                aria-label="Preview generated image"
              >
                <img
                  className="batch-table-output-image"
                  src={result.outputImage}
                  alt="Generated output"
                />
              </button>
            </div>
          ) : (
            <div className="batch-table-output-fallback" style={{ width: '100%' }}>
              {(() => {
                const jsonObject = tryParseJSON(result.output);
                if (jsonObject) {
                  return (
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        margin: 0,
                        padding: '8px',
                        background: 'var(--bg-elev-1)',
                        border: '1px solid var(--hairline)',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: 'oklch(0.82 0.08 195)', // elegant premium teal/blue
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      {JSON.stringify(jsonObject, null, 2)}
                    </pre>
                  );
                }
                return <p>{result.output || 'No image output returned.'}</p>;
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// The custom MultiSelectDropdown was lifted to
// `src/components/multi-select-dropdown.tsx` so the visual matches the
// Claude Design PromptLab.html exactly — sticky search input, mono
// group headers, checkbox marks. Same external API (options +
// selectedIds + onToggle) so the call sites below didn't change shape.

export function BatchTestPage() {
  const { history, promptProjects, promptVersions, assets, models, providerKeys, removeRun, createRun, updateRun } =
    useAppContext();
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [openRunMenuId, setOpenRunMenuId] = useState<string | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedImageReferenceIds, setSelectedImageReferenceIds] = useState<string[]>([]);
  const [selectedTextInputAssetIds, setSelectedTextInputAssetIds] = useState<string[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [stickerize, setStickerize] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);

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

  useEffect(() => {
    if (!previewImageSrc) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewImageSrc(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewImageSrc]);

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

  // Prompt dropdown options — grouped by project name. The design uses
  // mono uppercase project names as section headers; we lowercase to
  // match the design's `dropdown-group-head` styling rule.
  const promptDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      versionOptions.map((prompt) => ({
        id: prompt.id,
        label: `v${prompt.version} · ${prompt.systemPrompt.slice(0, 64)}${
          prompt.systemPrompt.length > 64 ? '…' : ''
        }`,
        searchText: `${prompt.projectName.toLowerCase()} v${prompt.version} ${prompt.systemPrompt.toLowerCase()}`,
        group: prompt.projectId,
      })),
    [versionOptions],
  );

  // Project-name groups for the prompt dropdown.
  const promptGroups = useMemo<DropdownGroup[]>(
    () =>
      versionOptions
        .map((v) => ({ key: v.projectId, label: v.projectName }))
        .filter(
          (g, i, arr) => arr.findIndex((x) => x.key === g.key) === i,
        ),
    [versionOptions],
  );

  const imageReferenceDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      imageReferenceAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        searchText: asset.name.toLowerCase(),
      })),
    [imageReferenceAssets],
  );

  const textInputDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      textInputAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        searchText: asset.name.toLowerCase(),
      })),
    [textInputAssets],
  );

  // Model dropdown options — grouped by inferred type (text / image /
  // video). Type is inferred from the API model id since the catalog
  // doesn't carry an explicit `type` field.
  const modelDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      readyModels.map((model) => {
        const id = model.apiModel.toLowerCase();
        const type = id.includes('image')
          ? 'image'
          : id.includes('sora') || id.includes('veo') || id.includes('video')
            ? 'video'
            : 'text';
        return {
          id: model.id,
          label: model.name,
          searchText: `${model.name.toLowerCase()} ${getProviderLabel(model.provider).toLowerCase()}`,
          group: type,
          icon: (
            <img
              src={getProviderIconSrc(model.provider)}
              alt={getProviderLabel(model.provider)}
              style={{ width: 12, height: 12, display: 'block' }}
            />
          ),
        };
      }),
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

  function handleDownloadRun(run: BatchRun) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(run, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const sanitizedName = run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadAnchor.setAttribute('download', `${sanitizedName}-batch-test.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
    const rowsMap = new Map<string, { id: string; label: string; assetId?: string; userInput?: string }>();

    // 1. Build from results if they exist
    run.results.forEach((result) => {
      const rowId = buildRowId(result.assetId, result.userInput);
      if (!rowsMap.has(rowId)) {
        rowsMap.set(rowId, {
          id: rowId,
          label: result.userInput || getAssetName(result.assetId) || SYSTEM_PROMPT_ONLY_ROW_LABEL,
          assetId: result.assetId,
          userInput: result.userInput,
        });
      }
    });

    // 2. If no results yet, build from scenario configuration
    if (rowsMap.size === 0) {
      const assetIds = run.scenario.assetIds && run.scenario.assetIds.length > 0
        ? run.scenario.assetIds
        : (run.scenario.assetId ? [run.scenario.assetId] : [undefined]);

      const userInputs = run.scenario.userInput
        ? run.scenario.userInput.split(' | ').map((val) => val.trim()).filter(Boolean)
        : [undefined];

      assetIds.forEach((assetId) => {
        userInputs.forEach((userInput) => {
          const rowId = buildRowId(assetId, userInput);
          if (rowId !== SYSTEM_PROMPT_ONLY_ROW_ID) {
            rowsMap.set(rowId, {
              id: rowId,
              label: userInput || getAssetName(assetId) || SYSTEM_PROMPT_ONLY_ROW_LABEL,
              assetId,
              userInput,
            });
          }
        });
      });
    }

    if (rowsMap.size === 0) {
      return [{ id: SYSTEM_PROMPT_ONLY_ROW_ID, label: SYSTEM_PROMPT_ONLY_ROW_LABEL }];
    }

    return [...rowsMap.values()];
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
          const rowId = buildRowId(result.assetId, result.userInput);
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

  // Inject the new "New Batch Test" CTA into the layout topbar.
  useEffect(() => {
    setPageChrome({
      topbarRight: (
        <button type="button" className="btn btn-primary" onClick={openComposer}>
          <BoxIcon><Play size={13} /></BoxIcon>
          New Batch Test
        </button>
      ),
    });
    return () => setPageChrome({});
  }, []);

  return (
    <>
      <div className="body">
        <div className="batch-list">
          {history.length === 0 ? (
            <div className="hero" style={{ padding: 32, textAlign: 'center' }}>
              <div className="page-sub">
                No batch tests yet — hit "New Batch Test" to compare prompts and models.
              </div>
            </div>
          ) : (
            history.map((run) => {
              const isOpen = expandedTests.has(run.id);
              const tables = isOpen ? buildRunTables(run) : [];
              return (
                <div key={run.id} className={`batch-job ${isOpen ? 'open' : ''}`}>
                  <div className="batch-head" onClick={() => toggleExpand(run.id)}>
                    <div className="project-chev">
                      <ChevronRight size={12} />
                    </div>
                    <div className="batch-titlewrap">
                      <div className="batch-title">{run.name}</div>
                      <div className="batch-sub">
                        <span className="batch-stamp">
                          {format(new Date(run.createdAt), 'MMM d, yyyy · HH:mm')}
                        </span>
                        {run.status === 'running' ? (
                          <span className="batch-pill running">
                            <span className="spin"><LoaderCircle size={11} /></span>
                            In progress
                          </span>
                        ) : run.status === 'failed' ? (
                          <span className="batch-pill" style={{ color: 'var(--rose)' }}>
                            <CircleAlert size={11} />
                            Failed
                          </span>
                        ) : (
                          <span className="batch-pill ok">
                            <CheckCircle size={11} />
                            Complete
                          </span>
                        )}
                        <span className="batch-pill muted">{run.results.length} results</span>
                      </div>
                    </div>
                    <div className="batch-actions" style={{ display: 'flex', gap: 6 }} onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="icon-btn naked"
                        aria-label="Download batch test results"
                        title="Download JSON"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownloadRun(run);
                        }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn naked"
                        aria-label="Delete batch test"
                        title="Remove"
                        style={{ color: 'var(--rose)' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveRun(run.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="batch-body">
                      {tables.map((table) => (
                        <div className="batch-model" key={table.key}>
                          <div className="batch-model-head">
                            <span className="batch-model-name">{table.title}</span>
                            <span className="batch-model-bar" />
                          </div>
                          <div
                            className="batch-matrix"
                            style={{
                              gridTemplateColumns: `220px repeat(${table.columns.length}, minmax(160px, 1fr))`,
                            }}
                          >
                            {(() => {
                              const hasImages = run.scenario.assetIds && run.scenario.assetIds.length > 0;
                              const hasTexts = run.scenario.userInput && run.scenario.userInput.trim().length > 0;
                              const headerLabel = hasImages && hasTexts ? 'Inputs' : hasImages ? 'Image References' : 'Text Inputs';
                              return <div className="batch-cell batch-cell-th">{headerLabel}</div>;
                            })()}
                            {table.columns.map((column) => (
                              <div key={column.id} className="batch-cell batch-cell-th">
                                {column.label}
                              </div>
                            ))}
                            {table.rows.map((row) => {
                              const asset = row.assetId ? getAsset(row.assetId) : undefined;
                              return (
                                <Fragment key={row.id}>
                                  <div className="batch-cell batch-cell-label" style={{ gap: 12 }}>
                                    {asset && (
                                      <div
                                        style={{
                                          width: 80,
                                          height: 80,
                                          borderRadius: 6,
                                          background: 'var(--bg-elev-3)',
                                          border: '1px solid var(--hairline)',
                                          backgroundImage: asset.source.startsWith('data:image') || asset.source.startsWith('http') ? `url(${asset.source})` : undefined,
                                          backgroundSize: 'cover',
                                          backgroundPosition: 'center',
                                          flexShrink: 0,
                                          cursor: 'pointer',
                                        }}
                                        title={asset.name}
                                        onClick={() => setPreviewImageSrc(asset.source)}
                                      />
                                    )}
                                    {(!asset || row.userInput) && (
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.userInput || row.label}
                                      </span>
                                    )}
                                  </div>
                                  {table.columns.map((column) => {
                                    const cell = table.cells.get(buildCellKey(row.id, column.id));
                                    return (
                                      <div key={column.id} className="batch-cell batch-cell-img">
                                        <BatchResultCell
                                          results={cell?.results ?? []}
                                          isRunning={run.status === 'running'}
                                          placeholderCount={
                                            run.scenario.assetIds &&
                                            run.scenario.assetIds.length > 0
                                              ? run.scenario.assetIds.length
                                              : 1
                                          }
                                          stickerize={Boolean(run.scenario.stickerize)}
                                          onPreviewImage={setPreviewImageSrc}
                                        />
                                      </div>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        className={`modal-overlay ${composerOpen ? '' : 'hidden'}`}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeComposer();
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }}>
          <div className="modal-head">
            <div>
              <div className="modal-title">New Batch Test</div>
              <div className="modal-sub">Compare models and prompts</div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeComposer}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={runBatch}
                disabled={running}
              >
                {running ? <LoaderCircle size={13} className="spin" /> : <Play size={13} />}
                {running ? 'Running…' : 'New Job'}
              </button>
            </div>
          </div>
          <div className="modal-body">
            <div className="field">
              <label className="field-label">
                <Cpu size={11} />
                Model<span className="req">*</span>
              </label>
              <MultiSelectDropdown
                options={modelDropdownOptions}
                selectedIds={selectedModelIds}
                onToggle={(id) => setSelectedModelIds((current) => toggleSelection(current, id))}
                emptyLabel="Select models…"
                searchPlaceholder="Search models…"
                groups={[
                  { key: 'text', label: 'Text' },
                  { key: 'image', label: 'Image' },
                  { key: 'video', label: 'Video' },
                ]}
              />
            </div>

            <div className="field">
              <label className="field-label">
                <FileText size={11} />
                System prompt<span className="req">*</span>
              </label>
              <MultiSelectDropdown
                options={promptDropdownOptions}
                selectedIds={selectedPromptIds}
                onToggle={(id) => setSelectedPromptIds((current) => toggleSelection(current, id))}
                emptyLabel="Select prompts…"
                searchPlaceholder="Search prompts…"
                groups={promptGroups}
              />
            </div>

            <div className="field">
              <label className="field-label">
                <ImageIcon size={11} />
                Image reference
              </label>
              <MultiSelectDropdown
                options={imageReferenceDropdownOptions}
                selectedIds={selectedImageReferenceIds}
                onToggle={(id) =>
                  setSelectedImageReferenceIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Select images…"
                searchPlaceholder="Search images…"
              />
            </div>

            <div className="field">
              <label className="field-label">
                <FileText size={11} />
                Text input
              </label>
              <MultiSelectDropdown
                options={textInputDropdownOptions}
                selectedIds={selectedTextInputAssetIds}
                onToggle={(id) =>
                  setSelectedTextInputAssetIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Select text inputs…"
                searchPlaceholder="Search text inputs…"
              />
            </div>

            <div className="field">
              <label className="field-label">Stickerize</label>
              <div className="field-toggle-row">
                <div className="field-toggle-text">
                  Remove the background and add the white outline to generated image outputs.
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={stickerize}
                  className={`toggle ${stickerize ? 'on' : ''}`}
                  onClick={() => setStickerize((current) => !current)}
                />
              </div>
            </div>

            {errorMessage ? (
              <div
                style={{
                  padding: 12,
                  border: '1px solid oklch(0.72 0.18 22 / 0.4)',
                  borderRadius: 'var(--r-md)',
                  background: 'oklch(0.72 0.18 22 / 0.08)',
                  color: 'var(--rose)',
                  fontSize: 12.5,
                }}
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {previewImageSrc ? (
        <div className="composer-backdrop" onClick={() => setPreviewImageSrc(null)}>
          <section
            className="surface-card image-preview-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-preview-close"
              onClick={() => setPreviewImageSrc(null)}
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>
            <img
              className="image-preview-sheet-image"
              src={previewImageSrc}
              alt="Generated output preview"
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
