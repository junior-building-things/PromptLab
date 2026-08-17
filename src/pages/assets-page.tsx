import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { setPageChrome } from '../components/app-layout';
import {
  IconBox,
  IconImage,
  IconMore,
  IconPlus,
  IconSearch,
  IconText,
  IconUpload,
} from '../components/icons';
import { Modal } from '../components/modal';
import { useAppContext } from '../context/app-context';
import { getAssetSources, isGroupedAsset } from '../lib/asset-images';
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
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [draftFileLabel, setDraftFileLabel] = useState('');
  const [uploading, setUploading] = useState(false);
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
        </div>
      ),
    });
    return () => setPageChrome({});
  }, [query]);

  const closeComposer = () => {
    setComposerOpen(false);
    setDraftName('');
    setDraftPaste('');
    setDraftFiles([]);
    setDraftFileLabel('');
  };

  const canSubmit =
    draftName.trim().length > 0 && (draftFiles.length > 0 || draftPaste.trim().length > 0);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setDraftFiles(files);
    setDraftFileLabel(
      files.length === 1 ? files[0].name : `${files.length} files selected`,
    );
    event.target.value = '';
  };

  const isImageFile = (file: File) =>
    file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (draftFiles.length === 0) {
      createAsset({ name: draftName.trim(), kind: 'text-inputs', source: draftPaste.trim() });
      closeComposer();
      return;
    }

    const kind: AssetKind = isImageFile(draftFiles[0]) ? 'image-reference' : 'text-inputs';

    if (kind === 'text-inputs') {
      // Text assets stay single-file; a bulk pick only makes sense for
      // images, where the set becomes one row per image in a batch.
      createAsset({
        name: draftName.trim(),
        kind,
        source: await readTextFile(draftFiles[0]),
      });
      closeComposer();
      return;
    }

    setUploading(true);
    try {
      // Image bytes go to the image store; the asset only keeps the
      // references so the workspace JSON stays small enough to persist.
      const sources: string[] = [];
      for (const file of draftFiles.filter(isImageFile)) {
        sources.push(await uploadImage(await readImageAsDataUrl(file)));
      }

      createAsset({
        name: draftName.trim(),
        kind,
        source: sources[0],
        sources: sources.length > 1 ? sources : undefined,
      });
      closeComposer();
    } finally {
      setUploading(false);
    }
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
                  {getAssetSources(asset)
                    .slice(0, 4)
                    .map((source, index) =>
                      isRenderableImage(source) ? (
                        <div
                          key={`${asset.id}-${index}`}
                          className="a-thumb"
                          style={{
                            backgroundImage: `url(${source})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      ) : (
                        <div key={`${asset.id}-${index}`} className="a-thumb" />
                      ),
                    )}
                  <span className="a-label">
                    {isGroupedAsset(asset)
                      ? `${getAssetSources(asset).length} images`
                      : asset.name}
                  </span>
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
              disabled={!canSubmit || uploading}
              onClick={() => void handleSubmit()}
            >
              <IconBox><IconPlus /></IconBox>
              {uploading
                ? `Uploading ${draftFiles.length} image${draftFiles.length === 1 ? '' : 's'}…`
                : 'Upload asset'}
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
              multiple
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

