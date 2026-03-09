import { useAppContext } from '../context/app-context';

export function ModelsPage() {
  const { models, updateModel } = useAppContext();

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <h2>Models</h2>
          <p>Prepare model presets before batch tests hit the network.</p>
        </div>
      </header>

      <div className="stack-list">
        {models.map((model) => (
          <article key={model.id} className="surface-card model-card">
            <div className="model-card-header">
              <div className="model-identity">
                <img
                  className="model-logo"
                  src={model.provider === 'gemini' ? '/gemini.png' : '/openai.png'}
                  alt={model.provider === 'gemini' ? 'Gemini' : 'OpenAI'}
                />
                <h3>{model.name}</h3>
              </div>
            </div>

            <label className="field-block">
              <span>Model ID</span>
              <input
                value={model.apiModel}
                onChange={(event) => updateModel(model.id, { apiModel: event.target.value })}
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
