import { Cpu, KeyRound } from 'lucide-react';
import { useAppContext } from '../context/app-context';

export function ModelsPage() {
  const { models, updateModel } = useAppContext();

  return (
    <section className="page-stack">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">Provider Configuration</p>
          <h2>Models</h2>
          <p>Prepare OpenAI and Gemini model presets before batch tests hit the network.</p>
        </div>
      </header>

      <div className="stack-list">
        {models.map((model) => (
          <article key={model.id} className="surface-card model-card">
            <div className="model-card-header">
              <div className="list-card-topline">
                <div className="icon-pill">
                  <Cpu size={18} />
                </div>
                <div>
                  <h3>{model.name}</h3>
                  <p>
                    {model.provider} via {model.endpoint}
                  </p>
                </div>
              </div>
              <span className={`pill ${model.status === 'ready' ? 'pill-success' : 'pill-subtle'}`}>
                {model.status}
              </span>
            </div>

            <div className="settings-grid">
              <label className="field-block">
                <span>Model ID</span>
                <input
                  value={model.apiModel}
                  onChange={(event) => updateModel(model.id, { apiModel: event.target.value })}
                />
              </label>
              <label className="field-block">
                <span>Temperature</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={model.temperature}
                  onChange={(event) =>
                    updateModel(model.id, { temperature: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field-block">
                <span>Max tokens</span>
                <input
                  type="number"
                  min="128"
                  step="64"
                  value={model.maxTokens}
                  onChange={(event) => updateModel(model.id, { maxTokens: Number(event.target.value) })}
                />
              </label>
              <label className="field-block">
                <span>Status</span>
                <select
                  value={model.status}
                  onChange={(event) =>
                    updateModel(model.id, { status: event.target.value as 'ready' | 'draft' })
                  }
                >
                  <option value="ready">Ready</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
            </div>

            <div className="env-hint">
              <KeyRound size={16} />
              <span>{model.envVar}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
