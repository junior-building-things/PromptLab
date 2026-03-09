import { useAppContext } from '../context/app-context';
import { getProviderIconSrc, getProviderLabel } from '../lib/model-brand';

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
                  src={getProviderIconSrc(model.provider)}
                  alt={getProviderLabel(model.provider)}
                />
                <div>
                  <h3>{model.name}</h3>
                  <p>Provider: {getProviderLabel(model.provider)}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
