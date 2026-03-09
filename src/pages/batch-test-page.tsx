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
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app-context';
import type { AssetRecord, PromptVersion, TestResult } from '../lib/types';

type ApiResult = {
  modelId: string;
  output: string;
  latencyMs: number;
  score: number;
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
              <div className="field-block">
                <span>System Prompts</span>
                <div className="selection-strip">
                  {versionOptions.map((prompt) => {
                    const selected = selectedPromptIds.includes(prompt.id);
                    return (
                      <label
                        key={prompt.id}
                        className={`selection-card${selected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedPromptIds((current) => toggleSelection(current, prompt.id))
                          }
                        />
                        <div className="selection-card-body">
                          <strong>{prompt.projectName}</strong>
                          <p>v{prompt.version}</p>
                          <span className="selection-card-copy">{prompt.title}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="field-block">
                <span>Image References</span>
                <div className="selection-strip">
                  {imageReferenceAssets.map((asset) => {
                    const selected = selectedImageReferenceIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`selection-card selection-card-image${selected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedImageReferenceIds((current) => toggleSelection(current, asset.id))
                          }
                        />
                        <div className="selection-card-media">
                          <img src={asset.source} alt={asset.name} className="selection-card-preview" />
                        </div>
                        <div className="selection-card-body">
                          <strong>{asset.name}</strong>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="field-block">
                <span>Text Inputs</span>
                <div className="selection-strip">
                  {textInputAssets.map((asset) => {
                    const selected = selectedTextInputAssetIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`selection-card${selected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedTextInputAssetIds((current) => toggleSelection(current, asset.id))
                          }
                        />
                        <div className="selection-card-body">
                          <strong>{asset.name}</strong>
                          <p>{parseTextInputs(asset.source).length} inputs</p>
                          <span className="selection-card-copy">
                            {parseTextInputs(asset.source).slice(0, 2).join(', ')}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="field-block">
                <span>Models</span>
                <div className="selection-strip">
                  {readyModels.map((model) => {
                    const selected = selectedModelIds.includes(model.id);
                    return (
                      <label
                        key={model.id}
                        className={`selection-card selection-card-model${selected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedModelIds((current) => toggleSelection(current, model.id))
                          }
                        />
                        <div className="selection-card-body selection-card-body-inline">
                          <img
                            className="model-logo"
                            src={model.provider === 'gemini' ? '/gemini.png' : '/openai.png'}
                            alt={model.provider === 'gemini' ? 'Gemini' : 'OpenAI'}
                          />
                          <strong>{model.name}</strong>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

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
