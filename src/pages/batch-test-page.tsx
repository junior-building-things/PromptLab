import { format } from 'date-fns';
import { AlertCircle, LoaderCircle, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/app-context';
import type { AssetRecord, BatchRun, TestResult } from '../lib/types';

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

export function BatchTestPage() {
  const { promptProjects, promptVersions, assets, models, createRun } = useAppContext();
  const navigate = useNavigate();
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
  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'image-reference'),
    [assets],
  );
  const textInputAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'text-inputs'),
    [assets],
  );

  const [promptId, setPromptId] = useState(versionOptions[0]?.id ?? '');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    imageAssets[0] ? [imageAssets[0].id] : [],
  );
  const [selectedUserInputAssetIds, setSelectedUserInputAssetIds] = useState<string[]>(
    textInputAssets[0] ? [textInputAssets[0].id] : [],
  );
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    readyModels.slice(0, 2).map((model) => model.id),
  );
  const [running, setRunning] = useState(false);
  const [previewRun, setPreviewRun] = useState<BatchRun | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!promptId && versionOptions[0]?.id) {
      setPromptId(versionOptions[0].id);
    }
  }, [promptId, versionOptions]);

  const selectedPrompt = versionOptions.find((prompt) => prompt.id === promptId);
  const selectedUserInputs = useMemo(
    () =>
      textInputAssets
        .filter((asset) => selectedUserInputAssetIds.includes(asset.id))
        .flatMap((asset) => parseTextInputs(asset.source)),
    [selectedUserInputAssetIds, textInputAssets],
  );

  async function executeScenario(
    selectedModels: typeof models,
    asset: AssetRecord | undefined,
    userInput: string,
  ) {
    const response = await fetch('/api/batch-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: selectedPrompt,
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
    if (!selectedPrompt || selectedModelIds.length === 0 || selectedUserInputs.length === 0) {
      setErrorMessage('Select at least one model and one user input asset before running.');
      return;
    }

    setRunning(true);
    setErrorMessage('');

    try {
      const selectedModels = models.filter((model) => selectedModelIds.includes(model.id));
      const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
      const assetScenarios = selectedAssets.length > 0 ? selectedAssets : [undefined];
      const results: TestResult[] = [];

      for (const asset of assetScenarios) {
        for (const userInput of selectedUserInputs) {
          const apiResults = await executeScenario(selectedModels, asset, userInput);

          apiResults.forEach((result, index) => {
            results.push({
              id: `result-${result.modelId}-${Date.now()}-${results.length + index}`,
              promptId,
              modelId: result.modelId,
              assetId: asset?.id,
              userInput,
              output: result.output,
              latencyMs: result.latencyMs,
              score: result.score,
            });
          });
        }
      }

      const run = createRun({
        name: `${selectedPrompt.projectName} v${selectedPrompt.version} - ${format(new Date(), 'MMM d HH:mm')}`,
        scenario: {
          promptId,
          assetIds: selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
          userInputAssetIds: selectedUserInputAssetIds,
          assetId: selectedAssetIds[0],
          modelIds: selectedModelIds,
          userInput: selectedUserInputs.join(' | '),
        },
        results,
      });

      setPreviewRun(run);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Batch run failed for an unknown reason.';
      setErrorMessage(message);
    } finally {
      setRunning(false);
    }
  }

  function toggleModel(modelId: string) {
    setSelectedModelIds((current) =>
      current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId],
    );
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    );
  }

  function toggleUserInputAsset(assetId: string) {
    setSelectedUserInputAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    );
  }

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <h2>Batch Test</h2>
          <p>Batch test different prompts and assets.</p>
        </div>
        <button className="button button-primary" onClick={runBatch} disabled={running}>
          {running ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
          {running ? 'Running...' : 'Run Batch'}
        </button>
      </header>

      <div className="detail-grid">
        <article className="surface-card form-card">
          <label className="field-block">
            <span>System Prompt Version</span>
            <select value={promptId} onChange={(event) => setPromptId(event.target.value)}>
              {versionOptions.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.projectName} · v{prompt.version} · {prompt.title}
                </option>
              ))}
            </select>
          </label>

          <div className="field-block">
            <span>Assets</span>
            <div className="checkbox-grid">
              {imageAssets.map((asset) => (
                <label key={asset.id} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={selectedAssetIds.includes(asset.id)}
                    onChange={() => toggleAsset(asset.id)}
                  />
                  <div>
                    <strong>{asset.name}</strong>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="field-block">
            <span>User Inputs</span>
            <div className="checkbox-grid">
              {textInputAssets.map((asset) => {
                const count = parseTextInputs(asset.source).length;
                return (
                  <label key={asset.id} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={selectedUserInputAssetIds.includes(asset.id)}
                      onChange={() => toggleUserInputAsset(asset.id)}
                    />
                    <div>
                      <strong>{asset.name}</strong>
                      <p>{count} inputs</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="field-block">
            <span>Models</span>
            <div className="checkbox-grid">
              {readyModels.map((model) => (
                <label key={model.id} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={selectedModelIds.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                  />
                  <div>
                    <strong>{model.name}</strong>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </article>

        <aside className="detail-sidebar">
          <article className="surface-card stat-card">
            <h3>Batch Size</h3>
            <p>
              {Math.max(selectedAssetIds.length, 1)} asset sets × {selectedUserInputs.length} user inputs ×{' '}
              {selectedModelIds.length} models
            </p>
          </article>

          {selectedPrompt ? (
            <article className="surface-card stat-card">
              <h3>{selectedPrompt.projectName}</h3>
              <p>
                v{selectedPrompt.version} · {selectedPrompt.title}
              </p>
              <div className="tag-row">
                {selectedPrompt.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ) : null}

          {errorMessage ? (
            <article className="surface-card stat-card error-card">
              <AlertCircle size={18} />
              <h3>Run Failed</h3>
              <p>{errorMessage}</p>
            </article>
          ) : null}

          {previewRun ? (
            <article className="surface-card stat-card">
              <h3>{previewRun.name}</h3>
              <p className="muted-copy">{format(new Date(previewRun.createdAt), 'MMM d, yyyy HH:mm')}</p>
              <div className="stack-list compact-list">
                {previewRun.results.slice(0, 6).map((result) => {
                  const model = models.find((entry) => entry.id === result.modelId);
                  return (
                    <div className="list-row" key={result.id}>
                      <div>
                        <strong>{model?.name}</strong>
                        <p>{result.userInput ?? 'No User Input'}</p>
                      </div>
                      <span className="pill pill-subtle">{result.score}/100</span>
                    </div>
                  );
                })}
              </div>
              <button className="button button-secondary" onClick={() => navigate('/history')}>
                View In History
              </button>
            </article>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
