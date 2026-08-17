import { useMemo, useState } from 'react';
import {
  IconBox,
  IconImage,
  IconKey,
  IconText,
  IconVideo,
  ProviderMark,
} from '../components/icons';
import { MODEL_CATEGORY_LABELS } from '../lib/model-brand';
import { useAppContext } from '../context/app-context';
import type { Provider } from '../lib/types';

/**
 * Models / API Keys screen — port of the design's `renderModels` +
 * `renderProvider`. Each provider gets a card with:
 *   - logo + name + verified-dot status
 *   - API-key input + "Verify" button (highlights as .btn-ai when
 *     not yet connected)
 *   - Available models grouped by Text / Image / Video, three-column
 *     auto-fit grid below
 *
 * The provider model list comes from the app context (real data); the
 * `--accent` palette tint per provider matches the design's
 * `oklch(...)` values.
 */

type ProviderConfig = {
  id: Provider;
  name: string;
  accent: string;
};

const PROVIDERS_ORDER: ProviderConfig[] = [
  { id: 'gemini', name: 'Google', accent: 'oklch(0.74 0.14 250)' },
  { id: 'openai', name: 'OpenAI', accent: 'oklch(0.78 0.14 165)' },
  { id: 'anthropic', name: 'Anthropic', accent: 'oklch(0.72 0.13 55)' },
  { id: 'xai', name: 'xAI', accent: 'oklch(0.78 0.14 30)' },
];

/** Maps our `Provider` enum to the design's PNG asset filename. We use
 * `gemini` internally but the design ships `google.png`. */
function providerToMark(p: Provider): 'openai' | 'google' | 'xai' | 'alibaba' | 'anthropic' {
  if (p === 'gemini') return 'google';
  return p as 'openai' | 'xai' | 'anthropic';
}

const hiddenKeyMask = '••••••••••••••••';

/** Best-effort type-bucket inference for a model preset. The catalog's
 * model `apiModel` strings carry enough signal (gpt-image-*, sora-*,
 * gemini-*-image-*, veo-*, etc.) that we don't need an explicit field. */
function modelType(apiModel: string): 'text' | 'image' | 'video' {
  const n = apiModel.toLowerCase();
  if (n.includes('image')) return 'image';
  if (n.includes('sora') || n.includes('veo') || n.includes('video')) return 'video';
  return 'text';
}

const TYPE_GROUPS = [
  { key: 'text' as const, label: MODEL_CATEGORY_LABELS.text, icon: <IconText /> },
  { key: 'image' as const, label: MODEL_CATEGORY_LABELS.image, icon: <IconImage /> },
  { key: 'video' as const, label: MODEL_CATEGORY_LABELS.video, icon: <IconVideo /> },
];

export function ModelsPage() {
  const { models, providerKeys, saveProviderKey, savingProvider } = useAppContext();
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const providerData = useMemo(() => {
    return PROVIDERS_ORDER.map((cfg) => {
      const providerModels = models.filter((m) => m.provider === cfg.id);
      const groups = TYPE_GROUPS.map((g) => ({
        ...g,
        items: providerModels.filter((m) => modelType(m.apiModel) === g.key),
      })).filter((g) => g.items.length > 0);
      return {
        cfg,
        connected: providerKeys[cfg.id]?.hasKey ?? false,
        groups,
      };
    });
  }, [models, providerKeys]);

  const handleSave = async (provider: Provider) => {
    const draft = draftKeys[provider]?.trim();
    if (!draft) return;
    try {
      await saveProviderKey(provider, draft);
      setDraftKeys((c) => ({ ...c, [provider]: '' }));
      setEditing(null);
    } catch {
      setEditing(provider);
    }
  };

  return (
    <div className="body">
      <div className="section" style={{ marginTop: 0 }}>
        <div className="provider-grid">
          {providerData.map(({ cfg, connected, groups }) => {
            const hasKey = providerKeys[cfg.id]?.hasKey ?? false;
            const draft = draftKeys[cfg.id] ?? '';
            const isEditing = editing === cfg.id;
            const displayValue = draft || (hasKey && !isEditing ? hiddenKeyMask : '');
            return (
              <div
                key={cfg.id}
                className={`provider-card ${connected ? 'connected' : ''}`}
                style={{ ['--accent' as never]: cfg.accent }}
              >
                <div className="provider-head">
                  <div className="provider-logo">
                    <ProviderMark provider={providerToMark(cfg.id)} />
                  </div>
                  <div>
                    <div className="provider-name">{cfg.name}</div>
                    <div className="provider-sub">
                      <span className="provider-status-dot" />
                      {connected ? 'Verified' : 'Not verified'}
                    </div>
                  </div>
                </div>

                <div className="provider-key">
                  <div className="field-label">
                    <IconBox size={11}><IconKey /></IconBox>
                    API key
                  </div>
                  <div className="key-row">
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      value={displayValue}
                      onFocus={() => {
                        if (hasKey && !draft) setEditing(cfg.id);
                      }}
                      onBlur={() => {
                        if (!draft && editing === cfg.id) setEditing(null);
                      }}
                      onChange={(event) => {
                        const next = event.target.value;
                        setEditing(cfg.id);
                        setDraftKeys((c) => ({
                          ...c,
                          [cfg.id]: next === hiddenKeyMask ? '' : next,
                        }));
                      }}
                      placeholder={`Paste ${cfg.name} key`}
                    />
                    <button
                      type="button"
                      className={`btn ${connected ? '' : 'btn-ai'}`}
                      disabled={savingProvider === cfg.id || draft.length === 0}
                      onClick={() => void handleSave(cfg.id)}
                    >
                      {savingProvider === cfg.id ? 'Saving…' : 'Verify'}
                    </button>
                  </div>
                </div>

                {groups.length > 0 ? (
                  <div className="provider-models-wrap">
                    <div className="field-label">Available models</div>
                    <div className="model-groups">
                      {groups.map((group) => (
                        <div key={group.key} className="model-group">
                          <div className="model-group-head">
                            <span className="model-group-icon">
                              <IconBox size={11}>{group.icon}</IconBox>
                            </span>
                            <span className="model-group-label">{group.label}</span>
                            <span className="model-group-count">{group.items.length}</span>
                          </div>
                          <div className="model-list">
                            {group.items.map((model) => (
                              <div key={model.id} className="model-row">
                                <div className="model-id">{model.apiModel}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

