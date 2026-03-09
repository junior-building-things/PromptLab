import { format } from 'date-fns';
import { AlertCircle, LoaderCircle, Play, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/app-context';
import type { AssetRecord, BatchRun, TestResult } from '../lib/types';

type ApiResult = {
  modelId: string;
  output: string;
  latencyMs: number;
  score: number;
};

export function BatchTestPage() {
  const { prompts, assets, models, createRun } = useAppContext();
  const navigate = useNavigate();
  const readyModels = useMemo(() => models.filter((model) => model.status === 'ready'), [models]);

  const [promptId, setPromptId] = useState(prompts[0]?.id ?? '');
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '');
  const [userInput, setUserInput] = useState(
    'Summarize the material, identify weaknesses in the prompt, and draft an improved response.',
  );
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    readyModels.slice(0, 2).map((model) => model.id),
  );
  const [running, setRunning] = useState(false);
  const [previewRun, setPreviewRun] = useState<BatchRun | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedPrompt = prompts.find((prompt) => prompt.id === promptId);

  async function runBatch() {
    if (!selectedPrompt || selectedModelIds.length === 0) return;

    setRunning(true);
    setErrorMessage('');

    try {
      const asset = assets.find((entry) => entry.id === assetId);
      const selectedModels = models.filter((model) => selectedModelIds.includes(model.id));

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

      const results: TestResult[] = payload.results.map((result, index) => ({
        id: `result-${result.modelId}-${Date.now()}-${index}`,
        promptId,
        modelId: result.modelId,
        assetId: assetId || undefined,
        output: result.output,
        latencyMs: result.latencyMs,
        score: result.score,
      }));

      const run = createRun({
        name: `${selectedPrompt.title} - ${format(new Date(), 'MMM d HH:mm')}`,
        scenario: { promptId, assetId: assetId || undefined, modelIds: selectedModelIds, userInput },
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

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Run comparisons</p>
          <h2>Batch test</h2>
          <p>
            Pick a prompt, optional asset, and model set, then stage a run. The UI is ready now;
            the next production step is replacing the mock executor with real API requests.
          </p>
        </div>
        <button className="button button-primary" onClick={runBatch} disabled={running}>
          {running ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
          {running ? 'Running...' : 'Run batch'}
        </button>
      </header>

      <div className="detail-grid">
        <article className="surface-card form-card">
          <label className="field-block">
            <span>System prompt</span>
            <select value={promptId} onChange={(event) => setPromptId(event.target.value)}>
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Asset</span>
            <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>User input</span>
            <textarea
              rows={6}
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
            />
          </label>

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
                    <p>{model.provider}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </article>

        <aside className="detail-sidebar">
          <article className="surface-card stat-card accent-card">
            <Sparkles size={18} />
            <h3>Implementation path</h3>
            <p>
              OpenAI and Gemini calls run through `/api/batch-run`, so provider keys stay server-side
              on Vercel.
            </p>
          </article>

          {errorMessage ? (
            <article className="surface-card stat-card error-card">
              <AlertCircle size={18} />
              <h3>Run failed</h3>
              <p>{errorMessage}</p>
            </article>
          ) : null}

          {previewRun ? (
            <article className="surface-card stat-card">
              <p className="eyebrow">Latest run</p>
              <h3>{previewRun.name}</h3>
              <p className="muted-copy">{format(new Date(previewRun.createdAt), 'MMM d, yyyy HH:mm')}</p>
              <div className="stack-list compact-list">
                {previewRun.results.map((result) => {
                  const model = models.find((entry) => entry.id === result.modelId);
                  return (
                    <div className="list-row" key={result.id}>
                      <div>
                        <strong>{model?.name}</strong>
                        <p>{result.score}/100 quality score</p>
                      </div>
                      <span className="pill pill-subtle">{result.latencyMs} ms</span>
                    </div>
                  );
                })}
              </div>
              <button className="button button-secondary" onClick={() => navigate('/history')}>
                View in history
              </button>
            </article>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
