import { KeyRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app-context';
import { getProviderIconSrc } from '../lib/model-brand';
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
    } catch {
      setDraftKeys((current) => ({ ...current, [provider]: '' }));
      setEditingProvider(provider);
    }
  }

  return (
    <>
      {/* Flush toolbar matches the DictateAI / Hamlet pattern: page title +
        * sub on the left, no primary action here (model presets are managed
        * elsewhere). Sits flush against the topbar with a hairline below. */}
      <div className="tab-toolbar">
        <div className="page-header-text">
          <div className="page-header-title">Model management</div>
          <div className="page-header-sub">
            Add your provider API keys, then prepare model presets before batch tests hit the network.
          </div>
        </div>
      </div>

      <div className="page-scroll">
        <div className="page-body">
          {providerModels.map(({ provider, models: modelsForProvider }) => (
            <div key={provider} className="s-group">
              <div className="s-group-head">
                <div className="title-wrap">
                  <span className="title">{providerCardTitle[provider]}</span>
                </div>
                <div className="bar" />
              </div>

              <div className="s-row">
                <div className="s-icon">
                  <img
                    src={getProviderIconSrc(provider)}
                    alt={providerCardTitle[provider]}
                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                  />
                </div>
                <div className="s-body">
                  <div className="s-label">Provider</div>
                  <div className="s-desc">
                    {providerKeys[provider].hasKey
                      ? 'API key stored. Tap to update.'
                      : 'No API key yet — add one to enable this provider in batch runs.'}
                  </div>
                </div>
              </div>

              <div className="s-row">
                <div className="s-icon">
                  <KeyRound strokeWidth={2} />
                </div>
                <div className="s-body">
                  <div className="s-label">API key</div>
                  <div className="s-desc">Stored encrypted in Postgres (AES-256-GCM).</div>
                </div>
                <div className="s-control">
                  <div className="field-row">
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="s-input"
                      value={
                        draftKeys[provider] ||
                        (providerKeys[provider].hasKey && editingProvider !== provider
                          ? hiddenKeyMask
                          : '')
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
                      placeholder="Enter key"
                    />
                    <button
                      type="button"
                      className="btn"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void handleSave(provider)}
                      disabled={savingProvider === provider || draftKeys[provider].trim().length === 0}
                    >
                      {savingProvider === provider ? 'Saving…' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>

              {modelsForProvider.length > 0 ? (
                <div className="s-row s-row-col">
                  <div className="s-head-row">
                    <div className="s-icon" aria-hidden="true">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {modelsForProvider.length}
                      </span>
                    </div>
                    <div className="s-body">
                      <div className="s-label">Available models</div>
                      <div className="s-desc">Pick from these in the Batch Test composer.</div>
                    </div>
                  </div>
                  <div className="provider-model-list">
                    {modelsForProvider.map((model) => (
                      <div key={model.id} className="provider-model-row">
                        <span>{model.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
