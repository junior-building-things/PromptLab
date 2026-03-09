import { useAppContext } from '../context/app-context';

const providerLabel = {
  openai: 'OpenAI',
  gemini: 'Google DeepMind',
  xai: 'xAI',
} as const;

export function ModelsPage() {
  const { models } = useAppContext();

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
                  src={
                    model.provider === 'gemini'
                      ? '/gemini.png'
                      : model.provider === 'xai'
                        ? '/xai.png'
                        : '/openai.png'
                  }
                  alt={providerLabel[model.provider]}
                />
                <div>
                  <h3>{model.name}</h3>
                  <p>Provider: {providerLabel[model.provider]}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
