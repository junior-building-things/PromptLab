import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { setPageChrome } from '../components/app-layout';
import {
  IconBox,
  IconClose,
  IconTrash,
  IconPlus,
  IconSearch,
  IconUpload,
} from '../components/icons';
import { ConfirmDialog } from '../components/confirm-dialog';
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

function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
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

/** Thumbnails shown inline for an image set before it collapses to +N. */
const PREVIEW_LIMIT = 10;

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
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null);
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
    setUploadNotice('');
  };

  const canSubmit =
    draftName.trim().length > 0 && (draftFiles.length > 0 || draftPaste.trim().length > 0);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;

    // Appending rather than replacing means "Add more" can be clicked
    // repeatedly instead of forcing one multi-select.
    setDraftFiles((current) => {
      const merged = [...current];
      picked.forEach((file) => {
        if (!merged.some((entry) => entry.name === file.name && entry.size === file.size)) {
          merged.push(file);
        }
      });

      // An asset is either an image set or a text file — a mixed pick has
      // no meaning downstream, so the first file decides the kind.
      const wantImages = isImageFile(merged[0]);
      const filtered = merged.filter((file) => isImageFile(file) === wantImages);
      setUploadNotice(
        filtered.length < merged.length
          ? `Skipped ${merged.length - filtered.length} file(s): an asset is either images or text, not both.`
          : '',
      );

      // Only image sets are multi-file.
      return wantImages ? filtered : filtered.slice(0, 1);
    });
  };


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
      <ConfirmDialog
        open={pendingRemoval !== null}
        noun="asset"
        onConfirm={() => {
          if (pendingRemoval) removeAsset(pendingRemoval.id);
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
      {previewSrc ? (
        <div className="composer-backdrop" onClick={() => setPreviewSrc(null)}>
          <section
            className="surface-card image-preview-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-preview-close"
              onClick={() => setPreviewSrc(null)}
              aria-label="Close image preview"
            >
              <IconBox size={16}><IconClose /></IconBox>
            </button>
            <img className="image-preview-sheet-image" src={previewSrc} alt="" />
          </section>
        </div>
      ) : null}
      <div className="screen">
        <div className="asset-thead">
          <div>Name</div>
          <div>Preview</div>
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
                  <div className="a-actions">
                    <button
                      type="button"
                      className="icon-btn naked"
                      aria-label="Remove asset"
                      onClick={() => setPendingRemoval({ id: asset.id, name: asset.name })}
                    >
                      <IconBox><IconTrash /></IconBox>
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
                    .slice(0, PREVIEW_LIMIT)
                    .map((source, index) =>
                      isRenderableImage(source) ? (
                        <button
                          key={`${asset.id}-${index}`}
                          type="button"
                          className="a-thumb a-thumb-button"
                          aria-label={`Preview ${asset.name} ${index + 1}`}
                          onClick={() => setPreviewSrc(source)}
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
                  {getAssetSources(asset).length > PREVIEW_LIMIT ? (
                    <span className="a-label">
                      +{getAssetSources(asset).length - PREVIEW_LIMIT}
                    </span>
                  ) : null}
                </div>
                <div className="a-actions">
                  <button
                    type="button"
                    className="icon-btn naked"
                    aria-label="Remove asset"
                    onClick={() => setPendingRemoval({ id: asset.id, name: asset.name })}
                  >
                    <IconBox><IconTrash /></IconBox>
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
              <span>
                {draftFiles.length === 0
                  ? 'Choose file'
                  : draftFiles.length === 1
                    ? draftFiles[0].name
                    : `${draftFiles.length} images selected`}
              </span>
            </button>
            {draftFiles.length > 0 && isImageFile(draftFiles[0]) ? (
              <button
                type="button"
                className="file-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconBox><IconPlus /></IconBox>
                <span>Add more</span>
              </button>
            ) : null}
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
          {uploadNotice ? (
            <div className="page-sub" style={{ fontSize: 11, paddingTop: 6 }}>{uploadNotice}</div>
          ) : null}
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

