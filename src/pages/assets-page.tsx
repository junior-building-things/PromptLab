import { formatDistanceToNow } from 'date-fns';
import { FileText, ImageIcon, Plus, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useAppContext } from '../context/app-context';
import type { AssetKind } from '../lib/types';

const kindIcon: Record<AssetKind, typeof ImageIcon> = {
  image: ImageIcon,
  document: FileText,
  text: ScrollText,
};

export function AssetsPage() {
  const { assets, createAsset } = useAppContext();
  const [draft, setDraft] = useState({
    name: '',
    kind: 'document' as AssetKind,
    source: '',
    note: '',
  });

  return (
    <section className="page-stack">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">Reusable Context</p>
          <h2>Assets</h2>
          <p>Attach screenshots, transcripts, PDFs, or raw text to batch jobs.</p>
        </div>
      </header>

      <div className="detail-grid">
        <article className="surface-card form-card">
          <div className="section-header-inline">
            <h3>Create Asset</h3>
            <button
              className="button button-primary"
              onClick={() => {
                if (!draft.name || !draft.source) return;
                createAsset(draft);
                setDraft({ name: '', kind: 'document', source: '', note: '' });
              }}
            >
              <Plus size={16} />
              Add Asset
            </button>
          </div>
          <label className="field-block">
            <span>Name</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="field-block">
            <span>Kind</span>
            <select
              value={draft.kind}
              onChange={(event) =>
                setDraft((current) => ({ ...current, kind: event.target.value as AssetKind }))
              }
            >
              <option value="document">Document</option>
              <option value="image">Image</option>
              <option value="text">Text</option>
            </select>
          </label>
          <label className="field-block">
            <span>Source</span>
            <textarea
              rows={5}
              value={draft.source}
              onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
              placeholder="URL, signed blob path, or inline text"
            />
          </label>
          <label className="field-block">
            <span>Note</span>
            <textarea
              rows={4}
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
        </article>

        <article className="stack-list">
          {assets.map((asset) => {
            const Icon = kindIcon[asset.kind];
            return (
              <div key={asset.id} className="surface-card list-card">
                <div className="list-card-topline">
                  <div className="icon-pill">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{asset.name}</h3>
                    <p>{asset.note}</p>
                  </div>
                </div>
                <div className="stat-row">
                  <span>Kind</span>
                  <strong>{asset.kind}</strong>
                </div>
                <div className="code-snippet code-snippet-tight">{asset.source}</div>
                <span className="meta-text">
                  Updated {formatDistanceToNow(new Date(asset.updatedAt), { addSuffix: true })}
                </span>
              </div>
            );
          })}
        </article>
      </div>
    </section>
  );
}
