import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileText,
  History as HistoryIcon,
  ImageIcon,
  LoaderCircle,
  Play,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/app-context';
import type { AssetRecord, PromptVersion, TestResult } from '../lib/types';

type ApiResult = {
  modelId: string;
  output: string;
  latencyMs: number;
  score: number;
};

type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
};

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

  const labels = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label);

  if (labels.length <= 2) {
    return labels.join(', ');
  }

  return `${labels.length} Selected`;
}

function TextIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="multi-dropdown-option-glyph">
      <Icon size={16} />
    </span>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onToggle,
  emptyLabel,
}: {
  label: string;
  options: DropdownOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

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

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="field-block" ref={rootRef}>
      <span>{label}</span>
      <div className={`multi-dropdown${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="multi-dropdown-trigger"
          onClick={() => setOpen((current) => !current)}
        >
          <div className="multi-dropdown-trigger-copy">
            <strong>{buildSummary(selectedIds, options, emptyLabel)}</strong>
            <p>{selectedIds.length} selected</p>
          </div>
          <ChevronDown size={16} />
        </button>
        {open ? (
          <div className="multi-dropdown-menu">
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
  const { history, promptProjects, promptVersions, assets, models, createRun } = useAppContext();
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>(
    promptVersions[0] ? [promptVersions[0].id] : [],
  );
  const [selectedImageReferenceIds, setSelectedImageReferenceIds] = useState<string[]>([]);
  const [selectedTextInputAssetIds, setSelectedTextInputAssetIds] = useState<string[]>(
    assets.find((asset) => asset.kind === 'text-inputs')
      ? [assets.find((asset) => asset.kind === 'text-inputs')!.id]
      : [],
  );
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    models.filter((model) => model.status === 'ready').slice(0, 2).map((model) => model.id),
  );
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const counters = useMemo(() => history.reduce((sum, run) => sum + run.results.length, 0), [history]);
  const readyModels = useMemo(() => models.filter((model) => model.status === 'ready'), [models]);
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
        description:
          model.provider === 'openai'
            ? 'OpenAI'
            : model.provider === 'gemini'
              ? 'Google DeepMind'
              : 'xAI',
        icon: (
          <img
            src={
              model.provider === 'gemini'
                ? '/gemini.png'
                : model.provider === 'xai'
                  ? '/xai.png'
                  : '/openai.png'
            }
            alt={
              model.provider === 'gemini'
                ? 'Google DeepMind'
                : model.provider === 'xai'
                  ? 'xAI'
                  : 'OpenAI'
            }
            className="model-logo"
          />
        ),
      })),
    [readyModels],
  );

  function toggleExpand(id: string) {
    setExpandedTests((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    userInput: string,
  ) {
    const response = await fetch('/api/batch-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        asset,
        models: selectedModels,
        userInput,
      }),
    });

    const payload = (await response.json()) as
      | { results: ApiResult[] }
      | { error?: string; details?: string };

    if (!response.ok || !('results' in payload)) {
      const failurePayload = payload as { error?: string; details?: string };
      throw new Error(failurePayload.error || failurePayload.details || 'Batch run failed.');
    }

    return payload.results;
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

    if (selectedPrompts.length === 0 || selectedModels.length === 0 || selectedUserInputs.length === 0) {
      setErrorMessage('Select at least one system prompt, text input, and model before running.');
      return;
    }

    setRunning(true);
    setErrorMessage('');

    try {
      const imageReferenceScenarios = selectedImageReferences.length > 0 ? selectedImageReferences : [undefined];
      const results: TestResult[] = [];

      for (const prompt of selectedPrompts) {
        for (const imageReference of imageReferenceScenarios) {
          for (const userInput of selectedUserInputs) {
            const apiResults = await executeScenario(prompt, selectedModels, imageReference, userInput);

            apiResults.forEach((result, index) => {
              results.push({
                id: `result-${prompt.id}-${result.modelId}-${Date.now()}-${results.length + index}`,
                promptId: prompt.id,
                modelId: result.modelId,
                assetId: imageReference?.id,
                userInput,
                output: result.output,
                latencyMs: result.latencyMs,
                score: result.score,
              });
            });
          }
        }
      }

      const createdRun = createRun({
        name:
          selectedPrompts.length === 1
            ? `${getPromptLabel(selectedPrompts[0].id)} - ${format(new Date(), 'MMM d HH:mm')}`
            : `${selectedPrompts.length} Prompt Selections - ${format(new Date(), 'MMM d HH:mm')}`,
        scenario: {
          promptId: selectedPrompts[0].id,
          promptIds: selectedPrompts.map((prompt) => prompt.id),
          assetIds: selectedImageReferenceIds.length > 0 ? selectedImageReferenceIds : undefined,
          assetId: selectedImageReferenceIds[0],
          userInputAssetIds: selectedTextInputAssetIds,
          modelIds: selectedModelIds,
          userInput: selectedUserInputs.join(' | '),
        },
        results,
      });

      setExpandedTests((current) => new Set([createdRun.id, ...current]));
      closeComposer();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Batch run failed for an unknown reason.',
      );
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
              <p>Create a batch test to compare prompts, image references, text inputs, and models.</p>
            </div>
          ) : (
            <>
              <div className="toolbar-card">
                <div className="pill pill-subtle">{history.length} batch tests</div>
                <div className="pill pill-subtle">{counters} outputs logged</div>
              </div>

              {history.map((run) => (
                <article key={run.id} className="surface-card history-shell">
                  <button className="history-toggle" onClick={() => toggleExpand(run.id)}>
                    <div className="list-card-topline">
                      <div className="icon-pill icon-pill-muted">
                        {expandedTests.has(run.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <h3>{run.name}</h3>
                        <div className="history-meta">
                          <span>{format(new Date(run.createdAt), 'MMM d, yyyy HH:mm')}</span>
                          <span className="pill">{run.results.length} results</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {expandedTests.has(run.id) ? (
                    <div className="history-results-grid">
                      {run.results.map((result) => {
                        const model = getModel(result.modelId);
                        const imageReference = getAsset(result.assetId);

                        return (
                          <div className="surface-card history-result-card" key={result.id}>
                            <div className="stack-list compact-list">
                              <div className="meta-pair">
                                <Cpu size={15} />
                                <div>
                                  <span>Model</span>
                                  <strong>{model?.name ?? 'Unknown Model'}</strong>
                                </div>
                              </div>
                              <div className="meta-pair">
                                <FileText size={15} />
                                <div>
                                  <span>System Prompt</span>
                                  <strong>{getPromptLabel(result.promptId)}</strong>
                                </div>
                              </div>
                              {result.userInput ? (
                                <div className="meta-pair">
                                  <FileText size={15} />
                                  <div>
                                    <span>Text Input</span>
                                    <strong>{result.userInput}</strong>
                                  </div>
                                </div>
                              ) : null}
                              {imageReference ? (
                                <div className="meta-pair">
                                  <ImageIcon size={15} />
                                  <div>
                                    <span>Image Reference</span>
                                    <strong>{imageReference.name}</strong>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className="output-panel">
                              <p className="eyebrow">Output</p>
                              <p>{result.output}</p>
                            </div>
                            <div className="history-result-footer">
                              <span className="pill pill-subtle">{result.latencyMs} ms</span>
                              <span className="pill pill-success">
                                <CheckCircle size={14} />
                                {result.score}/100
                              </span>
                            </div>
                          </div>
                        );
                      })}
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
                  {running ? 'Running...' : 'Create Batch Test'}
                </button>
              </div>
            </header>

            <div className="stack-list">
              <MultiSelectDropdown
                label="System Prompts"
                options={promptDropdownOptions}
                selectedIds={selectedPromptIds}
                onToggle={(id) => setSelectedPromptIds((current) => toggleSelection(current, id))}
                emptyLabel="Select System Prompts"
              />

              <MultiSelectDropdown
                label="Image References"
                options={imageReferenceDropdownOptions}
                selectedIds={selectedImageReferenceIds}
                onToggle={(id) =>
                  setSelectedImageReferenceIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Select Image References"
              />

              <MultiSelectDropdown
                label="Text Inputs"
                options={textInputDropdownOptions}
                selectedIds={selectedTextInputAssetIds}
                onToggle={(id) =>
                  setSelectedTextInputAssetIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Select Text Inputs"
              />

              <MultiSelectDropdown
                label="Models"
                options={modelDropdownOptions}
                selectedIds={selectedModelIds}
                onToggle={(id) => setSelectedModelIds((current) => toggleSelection(current, id))}
                emptyLabel="Select Models"
              />

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
