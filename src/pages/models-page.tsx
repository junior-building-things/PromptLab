import { KeyRound, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app-context';
import { getProviderIconSrc, getProviderLabel } from '../lib/model-brand';
import type { Provider } from '../lib/types';

const providerOrder: Provider[] = ['openai', 'gemini', 'xai'];
const providerCardTitle: Record<Provider, string> = {
  openai: 'OpenAI',
  gemini: 'Google',
  xai: 'xAI',
};
const hiddenKeyMask = '••••••••••••••••';

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
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

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
      setEditingProvider(null);
    } catch {}
  }

  async function handleRemove(provider: Provider) {
    try {
      await removeProviderKey(provider);
      setDraftKeys((current) => ({ ...current, [provider]: '' }));
      setEditingProvider(null);
    } catch {}
  }

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <h2>Model Management</h2>
          <p>Add your provider API keys, then prepare model presets before batch tests hit the network.</p>
        </div>
      </header>

      <div className="stack-list">
        <section className="settings-grid provider-key-grid">
          {providerModels.map(({ provider }) => (
            <article key={provider} className="surface-card model-card provider-key-card">
              <div className="model-card-header">
                <div className="model-identity">
                  <img
                    className="provider-logo"
                    src={getProviderIconSrc(provider)}
                    alt={providerCardTitle[provider]}
                    width={96}
                    height={96}
                  />
                  <div>
                    <h3>{providerCardTitle[provider]}</h3>
                  </div>
                </div>
              </div>

              <div className="field-block">
                <span className="field-block-label">
                  <KeyRound size={15} />
                  API Key
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={
                    draftKeys[provider] ||
                    (providerKeys[provider].hasKey && editingProvider !== provider ? hiddenKeyMask : '')
                  }
                  onFocus={() => {
                    if (providerKeys[provider].hasKey && draftKeys[provider].length === 0) {
                      setEditingProvider(provider);
                    }
                  }}
                  onBlur={() => {
                    if (draftKeys[provider].length === 0 && editingProvider === provider) {
                      setEditingProvider(null);
                    }
                  }}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setEditingProvider(provider);
                    setDraftKeys((current) => ({
                      ...current,
                      [provider]: nextValue === hiddenKeyMask ? '' : nextValue,
                    }));
                  }}
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

        <div className="section-header-inline model-section-heading">
          <h3>Available Models:</h3>
        </div>

        {providerModels.map(({ provider, models: modelsForProvider }) =>
          modelsForProvider.map((model) => (
            <article key={model.id} className="surface-card model-card">
              <div className="model-card-header">
                <div>
                  <h3>{model.name}</h3>
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
