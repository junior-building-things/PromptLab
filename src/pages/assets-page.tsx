import { formatDistanceToNow } from 'date-fns';
import { FileImage, FileText, MoreHorizontal, Plus, Trash2, Upload } from 'lucide-react';
import {
  type ChangeEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAppContext } from '../context/app-context';
import type { AssetKind } from '../lib/types';

type AssetComposerState = {
  name: string;
  kind: AssetKind;
  source: string;
};

const typeCopy: Record<AssetKind, string> = {
  'text-inputs': 'Upload or paste a .txt file with comma-separated text inputs.',
  'image-reference': 'Upload or paste a png or jpg image.',
};

function parseTextInputs(source: string) {
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AssetsPage() {
  const { assets, createAsset, removeAsset } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [menuAssetId, setMenuAssetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetComposerState>({
    name: '',
    kind: 'text-inputs',
    source: '',
  });

  const accept = draft.kind === 'image-reference' ? '.png,.jpg,.jpeg,image/png,image/jpeg' : '.txt,text/plain';
  const sortedAssets = useMemo(
    () =>
      [...assets].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [assets],
  );

  function openComposer() {
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setSelectedFileName('');
    setDraft({
      name: '',
      kind: 'text-inputs',
      source: '',
    });
  }

  function handleCreateAsset() {
    if (!draft.name.trim() || !draft.source.trim()) return;

    createAsset({
      name: draft.name.trim(),
      kind: draft.kind,
      source: draft.source.trim(),
    });
    closeComposer();
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setDraft((current) => ({ ...current, source: result }));
    };

    if (draft.kind === 'image-reference') {
      reader.readAsDataURL(file);
      return;
    }

    reader.readAsText(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    readFile(file);
    event.target.value = '';
  }

  function handleRemoveAsset(assetId: string, assetName: string) {
    if (!window.confirm(`Remove ${assetName}?`)) {
      return;
    }

    removeAsset(assetId);
    setMenuAssetId(null);
  }

  return (
    <>
      <section className="page-stack">
        <header className="page-heading-row">
          <div>
            <p className="eyebrow">Reusable Context</p>
            <h2>Assets</h2>
            <p>Store reusable text inputs and image references for prompt testing.</p>
          </div>
          <button className="button button-primary" onClick={openComposer}>
            <Plus size={16} />
            Upload Asset
          </button>
        </header>

        {sortedAssets.length > 0 ? (
          <div className="asset-grid">
            {sortedAssets.map((asset) => {
              const textInputs = asset.kind === 'text-inputs' ? parseTextInputs(asset.source) : [];

              return (
                <article key={asset.id} className="surface-card asset-card">
                  <div className="asset-card-header">
                    <div className="asset-title-row">
                      {asset.kind === 'text-inputs' ? <FileText size={18} /> : <FileImage size={18} />}
                      <h3>{asset.name}</h3>
                    </div>
                    <div className="card-menu-wrap">
                      <button
                        className="icon-action-button"
                        onClick={() =>
                          setMenuAssetId((current) => (current === asset.id ? null : asset.id))
                        }
                        aria-label="Asset actions"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {menuAssetId === asset.id ? (
                        <div className="card-menu-sheet">
                          <button
                            className="menu-sheet-action menu-sheet-danger"
                            onClick={() => handleRemoveAsset(asset.id, asset.name)}
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="asset-preview">
                    {asset.kind === 'image-reference' ? (
                      <img className="asset-preview-image" src={asset.source} alt={asset.name} />
                    ) : (
                      <div className="asset-preview-text">
                        {textInputs.slice(0, 4).map((item) => (
                          <span key={item} className="asset-preview-chip">
                            {item}
                          </span>
                        ))}
                        {textInputs.length === 0 ? (
                          <span className="asset-preview-empty">No Text Inputs Added Yet</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <footer className="card-footer">
                    <span className="meta-text">
                      Updated {formatDistanceToNow(new Date(asset.updatedAt), { addSuffix: true })}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <article className="surface-card empty-card">
            <div className="icon-pill icon-pill-muted">
              <Upload size={22} />
            </div>
            <h3>No Assets Yet</h3>
            <p>Upload text inputs or image references to reuse them across prompt tests.</p>
          </article>
        )}
      </section>

      {composerOpen ? (
        <div className="composer-backdrop" onClick={closeComposer}>
          <section className="surface-card composer-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="composer-sheet-header">
              <div>
                <h3>Upload Asset</h3>
              </div>
              <div className="button-row-inline">
                <button className="button button-secondary" onClick={closeComposer}>
                  Cancel
                </button>
                <button className="button button-primary" onClick={handleCreateAsset}>
                  Upload Asset
                </button>
              </div>
            </header>

            <div className="stack-list">
              <label className="field-block">
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Launch Inputs"
                />
              </label>

              <label className="field-block">
                <span>Type</span>
                <select
                  value={draft.kind}
                  onChange={(event) =>
                    {
                      setSelectedFileName('');
                      setDraft((current) => ({
                        ...current,
                        kind: event.target.value as AssetKind,
                        source: '',
                      }));
                    }
                  }
                >
                  <option value="text-inputs">Text Inputs</option>
                  <option value="image-reference">Image Reference</option>
                </select>
                <p className="meta-text">{typeCopy[draft.kind]}</p>
              </label>

              <div className="field-block">
                <span>Upload File</span>
                <div className="button-row-inline">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    Choose File
                  </button>
                  <span className="meta-text">
                    {draft.kind === 'image-reference' ? 'PNG or JPG' : 'TXT'}
                  </span>
                </div>
                {selectedFileName ? <p className="meta-text">{selectedFileName}</p> : null}
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept={accept}
                  onChange={handleFileChange}
                />
              </div>

              {draft.kind === 'text-inputs' ? (
                <label className="field-block">
                  <span>Paste Text Inputs</span>
                  <textarea
                    rows={6}
                    value={draft.source}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, source: event.target.value }))
                    }
                    placeholder="Paste comma-separated text inputs."
                  />
                </label>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
