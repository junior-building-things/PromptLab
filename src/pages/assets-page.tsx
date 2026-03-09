import { formatDistanceToNow } from 'date-fns';
import { FileImage, FileText, Plus, Upload } from 'lucide-react';
import {
  type ChangeEvent,
  type ClipboardEvent,
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
  const { assets, createAsset } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
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
    readFile(file);
    event.target.value = '';
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (draft.kind !== 'image-reference') return;

    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith('image/'),
    );
    const file = imageItem?.getAsFile();
    if (!file) return;

    event.preventDefault();
    readFile(file);
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
                    <div>
                      <h3>{asset.name}</h3>
                      <p>{asset.kind === 'text-inputs' ? 'Text Inputs' : 'Image Reference'}</p>
                    </div>
                    <span className="pill pill-subtle">
                      {asset.kind === 'text-inputs' ? <FileText size={14} /> : <FileImage size={14} />}
                      {asset.kind === 'text-inputs' ? 'Text Inputs' : 'Image Reference'}
                    </span>
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
                <p className="eyebrow">Upload Asset</p>
                <h3>Create Asset</h3>
                <p>Add reusable text inputs or image references for future test runs.</p>
              </div>
              <div className="button-row-inline">
                <button className="button button-secondary" onClick={closeComposer}>
                  Cancel
                </button>
                <button className="button button-primary" onClick={handleCreateAsset}>
                  Create Asset
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
                    setDraft((current) => ({
                      ...current,
                      kind: event.target.value as AssetKind,
                      source: '',
                    }))
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
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept={accept}
                  onChange={handleFileChange}
                />
              </div>

              <label className="field-block">
                <span>{draft.kind === 'image-reference' ? 'Paste Image' : 'Paste Text Inputs'}</span>
                <textarea
                  rows={draft.kind === 'image-reference' ? 8 : 6}
                  value={draft.source}
                  onPaste={handlePaste}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, source: event.target.value }))
                  }
                  placeholder={
                    draft.kind === 'image-reference'
                      ? 'Paste an image URL, data URL, or paste an image from your clipboard.'
                      : 'Paste comma-separated text inputs.'
                  }
                />
              </label>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
