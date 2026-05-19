import { FileImage, FileText, MoreHorizontal, Plus, Trash2, Upload, X } from 'lucide-react';
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

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read text file.'));
    reader.readAsText(file);
  });
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image.'));
    image.src = source;
  });
}

async function compressImageFile(file: File) {
  const source = await readImageAsDataUrl(file);
  const image = await loadImage(source);
  const maxDimension = 1400;
  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare image upload.');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82);
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    event.target.value = '';

    try {
      const result =
        draft.kind === 'image-reference'
          ? await compressImageFile(file)
          : await readTextFile(file);

      setDraft((current) => ({ ...current, source: result }));
    } catch (error) {
      console.error('Failed to process uploaded asset.', error);
    }
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
      <div className="tab-toolbar">
        <div className="page-header-text">
          <div className="page-header-title">Assets</div>
          <div className="page-header-sub">
            Store reusable text inputs and image references for batch testing.
          </div>
        </div>
        <button type="button" className="btn btn-ai" onClick={openComposer}>
          <Plus strokeWidth={2} />
          Upload asset
        </button>
      </div>

      <div className="page-scroll">
        <div className="page-body">
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

                </article>
              );
            })}
          </div>
        ) : (
          <article className="surface-card empty-card asset-empty-state">
            <div className="icon-pill icon-pill-muted">
              <Upload size={22} />
            </div>
            <h3>No assets yet</h3>
            <p>Upload text inputs or image references to reuse them across prompt tests.</p>
          </article>
        )}
        </div>
      </div>

      {/* Asset composer — DictateAI-style modal. Backdrop click + Cancel
        * dismiss; rendered always so the CSS transition can play on
        * enter/exit. */}
      <div
        className={`modal-overlay ${composerOpen ? 'open' : ''}`}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeComposer();
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
          <div className="modal-header">
            <div id="asset-modal-title" className="modal-title">Upload asset</div>
            <button type="button" className="modal-close" onClick={closeComposer} aria-label="Close">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="modal-body">
            <label className="modal-field">
              <span className="modal-label">Name</span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Launch Inputs"
              />
            </label>

            <label className="modal-field">
              <span className="modal-label">Type</span>
              <select
                value={draft.kind}
                onChange={(event) => {
                  setSelectedFileName('');
                  setDraft((current) => ({
                    ...current,
                    kind: event.target.value as AssetKind,
                    source: '',
                  }));
                }}
              >
                <option value="text-inputs">Text inputs</option>
                <option value="image-reference">Image reference</option>
              </select>
              <p className="meta-text">{typeCopy[draft.kind]}</p>
            </label>

            <div className="modal-field">
              <span className="modal-label">Upload file</span>
              <div className="button-row-inline">
                <button
                  type="button"
                  className="btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload strokeWidth={2} />
                  Choose file
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
              <label className="modal-field">
                <span className="modal-label">Paste text inputs</span>
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
          <div className="modal-footer">
            <button type="button" className="btn" onClick={closeComposer}>
              Cancel
            </button>
            <button type="button" className="btn btn-ai" onClick={handleCreateAsset}>
              <Plus strokeWidth={2} />
              Upload asset
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
