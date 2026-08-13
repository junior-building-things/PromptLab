import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { setPageChrome } from '../components/app-layout';
import {
  IconFilter,
  IconImage,
  IconMore,
  IconPlus,
  IconSearch,
  IconText,
  IconUpload,
} from '../components/icons';
import { Modal } from '../components/modal';
import { useAppContext } from '../context/app-context';
import { isRenderableImage, uploadImage } from '../lib/image-source';
import type { AssetKind } from '../lib/types';

/**
 * Assets screen — port of the design's DictateAI-table-pattern asset
 * list. Sticky `.asset-thead` (NAME / PREVIEW / TYPE / ·), `.asset-row`
 * per asset with a tinted leading icon, name, scrollable preview (chips
 * for text-input assets or a thumb for image refs), a type pill, and a
 * row-hover actions menu.
 */

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

function parseTextInputs(source: string) {
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AssetsPage() {
  const { assets, createAsset, removeAsset } = useAppContext();
  const [query, setQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPaste, setDraftPaste] = useState('');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileLabel, setDraftFileLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    const sorted = [...assets].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!term) return sorted;
    return sorted.filter((asset) => asset.name.toLowerCase().includes(term));
  }, [assets, query]);

  // Inject topbar action + toolbar into the layout shell.
  useEffect(() => {
    setPageChrome({
      topbarRight: (
        <button type="button" className="btn btn-primary" onClick={() => setComposerOpen(true)}>
          <IconBox><IconPlus /></IconBox>
          Upload asset
        </button>
      ),
      toolbar: (
        <div className="toolbar">
          <div className="search">
            <IconBox size={13}><IconSearch /></IconBox>
            <input
              type="text"
              placeholder="Search assets"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="kbd">⌘K</span>
          </div>
          <button type="button" className="chip">
            <IconBox size={12}><IconFilter /></IconBox>
            All assets
          </button>
        </div>
      ),
    });
    return () => setPageChrome({});
  }, [query]);

  const closeComposer = () => {
    setComposerOpen(false);
    setDraftName('');
    setDraftPaste('');
    setDraftFile(null);
    setDraftFileLabel('');
  };

  const canSubmit = draftName.trim().length > 0 && (draftFile !== null || draftPaste.trim().length > 0);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDraftFile(file);
    setDraftFileLabel(file.name);
    event.target.value = '';
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    let kind: AssetKind = 'text-inputs';
    let source = draftPaste.trim();
    if (draftFile) {
      const isImage =
        draftFile.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(draftFile.name);
      kind = isImage ? 'image-reference' : 'text-inputs';
      // Image bytes go to the image store; the asset only keeps the
      // reference so the workspace JSON stays small enough to persist.
      source = isImage
        ? await uploadImage(await readImageAsDataUrl(draftFile))
        : await readTextFile(draftFile);
    }
    createAsset({ name: draftName.trim(), kind, source });
    closeComposer();
  };

  return (
    <>
      <div className="screen">
        <div className="asset-thead">
          <div>Name</div>
          <div>Preview</div>
          <div>Type</div>
          <div />
        </div>
        {sortedAssets.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }} className="page-sub">
            {query ? `No assets match "${query}".` : 'No assets yet — hit "Upload asset" to add one.'}
          </div>
        ) : (
          sortedAssets.map((asset) => {
            if (asset.kind === 'text-inputs') {
              const chips = parseTextInputs(asset.source);
              return (
                <div key={asset.id} className="asset-row">
                  <div className="a-name">{asset.name}</div>
                  <div className="a-preview">
                    {chips.length === 0 ? (
                      <span className="page-sub" style={{ fontSize: 12 }}>
                        (empty)
                      </span>
                    ) : (
                      chips.map((chip) => (
                        <span key={chip} className="a-chip">
                          {chip}
                        </span>
                      ))
                    )}
                  </div>
                  <div>
                    <span className="a-type">
                      <IconBox size={11}><IconText /></IconBox>
                      TXT
                    </span>
                  </div>
                  <div className="a-actions">
                    <button
                      type="button"
                      className="icon-btn naked"
                      aria-label="Asset actions"
                      onClick={() => {
                        if (window.confirm(`Remove ${asset.name}?`)) removeAsset(asset.id);
                      }}
                    >
                      <IconBox><IconMore /></IconBox>
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={asset.id} className="asset-row">
                <div className="a-name">{asset.name}</div>
                <div className="a-preview">
                  {isRenderableImage(asset.source) ? (
                    <div
                      className="a-thumb"
                      style={{
                        backgroundImage: `url(${asset.source})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  ) : (
                    <div className="a-thumb" />
                  )}
                  <span className="a-label">{asset.name}</span>
                </div>
                <div>
                  <span className="a-type">
                    <IconBox size={11}><IconImage /></IconBox>
                    PNG
                  </span>
                </div>
                <div className="a-actions">
                  <button
                    type="button"
                    className="icon-btn naked"
                    aria-label="Asset actions"
                    onClick={() => {
                      if (window.confirm(`Remove ${asset.name}?`)) removeAsset(asset.id);
                    }}
                  >
                    <IconBox><IconMore /></IconBox>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={composerOpen}
        onClose={closeComposer}
        title="Upload asset"
        sub="Reusable test input"
        headerActions={
          <>
            <button type="button" className="btn" onClick={closeComposer}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              <IconBox><IconPlus /></IconBox>
              Upload asset
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label">
            Name<span className="req">*</span>
          </label>
          <input
            type="text"
            className="field-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Expressions"
          />
        </div>

        <div className="field">
          <label className="field-label">
            Upload file<span className="req">*</span>
          </label>
          <div className="file-row">
            <button
              type="button"
              className="file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconBox><IconUpload /></IconBox>
              <span>{draftFileLabel || 'Choose file'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,image/*"
              hidden
              onChange={(event) => void handleFileChange(event)}
            />
            <span className="file-tag">TXT / PNG / JPG</span>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Or paste text inputs</label>
          <textarea
            className="field-textarea"
            value={draftPaste}
            onChange={(event) => setDraftPaste(event.target.value)}
            placeholder="Happy, Shocked, Surprised"
          />
        </div>
      </Modal>
    </>
  );
}

function IconBox({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
