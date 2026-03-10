import { KeyRound, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app-context';
import { getProviderIconSrc, getProviderLabel } from '../lib/model-brand';
import type { Provider } from '../lib/types';

const providerOrder: Provider[] = ['openai', 'gemini', 'xai'];

export function ModelsPage() {
  const {
    models,
    providerKeys,
    saveProviderKey,
    removeProviderKey,
    savingProvider,
  } = useAppContext();
  const [draftKeys, setDraftKeys] = useState<Record<Provider, string>>({
    openai: '',
    gemini: '',
    xai: '',
  });
  const [pageMessage, setPageMessage] = useState('');

  const providerModels = useMemo(
    () =>
      providerOrder.map((provider) => ({
        provider,
        models: models.filter((model) => model.provider === provider),
      })),
    [models],
  );

  async function handleSave(provider: Provider) {
    try {
      await saveProviderKey(provider, draftKeys[provider]);
      setDraftKeys((current) => ({ ...current, [provider]: '' }));
      setPageMessage(`${getProviderLabel(provider)} API key saved.`);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : 'Failed to save API key.');
    }
  }

  async function handleRemove(provider: Provider) {
    try {
      await removeProviderKey(provider);
      setDraftKeys((current) => ({ ...current, [provider]: '' }));
      setPageMessage(`${getProviderLabel(provider)} API key removed.`);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : 'Failed to remove API key.');
    }
  }

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <h2>Models</h2>
          <p>Add your provider API keys, then prepare model presets before batch tests hit the network.</p>
        </div>
      </header>

      {pageMessage ? (
        <article className="surface-card stat-card">
          <h3>Update</h3>
          <p>{pageMessage}</p>
        </article>
      ) : null}

      <div className="stack-list">
        <section className="settings-grid provider-key-grid">
          {providerModels.map(({ provider, models: modelsForProvider }) => (
            <article key={provider} className="surface-card model-card provider-key-card">
              <div className="model-card-header">
                <div className="model-identity">
                  <img
                    className="model-logo"
                    src={getProviderIconSrc(provider)}
                    alt={getProviderLabel(provider)}
                  />
                  <div>
                    <h3>{getProviderLabel(provider)} API Key</h3>
                    <p>{providerKeys[provider].hasKey ? 'Key saved for this provider.' : 'No API key saved yet.'}</p>
                  </div>
                </div>
                <span className={`pill ${providerKeys[provider].hasKey ? 'pill-success' : 'pill-subtle'}`}>
                  {providerKeys[provider].hasKey ? 'Saved' : 'Required'}
                </span>
              </div>

              <div className="field-block">
                <span className="field-block-label">
                  <KeyRound size={15} />
                  API Key
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={draftKeys[provider]}
                  onChange={(event) => setDraftKeys((current) => ({ ...current, [provider]: event.target.value }))}
                  placeholder={`Enter your ${getProviderLabel(provider)} API key`}
                />
              </div>

              <div className="button-row-inline">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void handleSave(provider)}
                  disabled={savingProvider === provider || draftKeys[provider].trim().length === 0}
                >
                  {savingProvider === provider ? 'Saving...' : 'Save Key'}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => void handleRemove(provider)}
                  disabled={savingProvider === provider || !providerKeys[provider].hasKey}
                >
                  <Trash2 size={15} />
                  Remove Key
                </button>
              </div>
            </article>
          ))}
        </section>

        {providerModels.map(({ provider, models: modelsForProvider }) =>
          modelsForProvider.map((model) => (
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
                <span className={`pill ${providerKeys[provider].hasKey ? 'pill-success' : 'pill-subtle'}`}>
                  {providerKeys[provider].hasKey ? 'Ready' : 'API Key Required'}
                </span>
              </div>
            </article>
          )),
        )}
      </div>
    </section>
  );
}
