import { format } from 'date-fns';
import { Save, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

export function PromptDetailPage() {
  const { title } = useParams();
  const { prompts, history, updatePrompt } = useAppContext();
  const prompt = prompts.find((entry) => entry.id === title);

  const [draft, setDraft] = useState(() => ({
    title: prompt?.title ?? '',
    summary: prompt?.summary ?? '',
    systemPrompt: prompt?.systemPrompt ?? '',
    tags: prompt?.tags.join(', ') ?? '',
  }));

  const relatedRuns = useMemo(
    () => history.filter((run) => run.scenario.promptId === prompt?.id).slice(0, 3),
    [history, prompt?.id],
  );

  if (!prompt) {
    return (
      <section className="page-stack">
        <div className="surface-card empty-card">
          <h2>Prompt not found</h2>
          <p>The route is valid, but there is no prompt matching this id in local state.</p>
          <Link to="/" className="button button-primary">
            Back to prompts
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <header className="hero-card prompt-detail-hero">
        <div>
          <p className="eyebrow">Prompt detail</p>
          <h2>{prompt.title}</h2>
          <p>
            Refine the system prompt, track recent runs, and keep prompt intent stable across model
            comparisons.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() =>
            updatePrompt(prompt.id, {
              title: draft.title,
              summary: draft.summary,
              systemPrompt: draft.systemPrompt,
              tags: draft.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
        >
          <Save size={16} />
          Save prompt
        </button>
      </header>

      <div className="detail-grid">
        <article className="surface-card form-card">
          <label className="field-block">
            <span>Prompt title</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="field-block">
            <span>Summary</span>
            <textarea
              rows={3}
              value={draft.summary}
              onChange={(event) =>
                setDraft((current) => ({ ...current, summary: event.target.value }))
              }
            />
          </label>
          <label className="field-block">
            <span>System prompt</span>
            <textarea
              rows={14}
              value={draft.systemPrompt}
              onChange={(event) =>
                setDraft((current) => ({ ...current, systemPrompt: event.target.value }))
              }
            />
          </label>
          <label className="field-block">
            <span>Tags</span>
            <input
              value={draft.tags}
              onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
              placeholder="growth, support, launch"
            />
          </label>
        </article>

        <aside className="detail-sidebar">
          <article className="surface-card stat-card">
            <p className="eyebrow">Prompt metadata</p>
            <div className="stat-row">
              <span>Last updated</span>
              <strong>{format(new Date(prompt.updatedAt), 'MMM d, yyyy HH:mm')}</strong>
            </div>
            <div className="stat-row">
              <span>Total runs</span>
              <strong>{prompt.runCount}</strong>
            </div>
            <div className="tag-row">
              {prompt.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </article>

          <article className="surface-card stat-card">
            <p className="eyebrow">Recent runs</p>
            {relatedRuns.length === 0 ? (
              <p className="muted-copy">No batch runs have used this prompt yet.</p>
            ) : (
              <div className="stack-list compact-list">
                {relatedRuns.map((run) => (
                  <div key={run.id} className="list-row">
                    <div>
                      <strong>{run.name}</strong>
                      <p>{format(new Date(run.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    <span className="pill pill-subtle">{run.results.length} outputs</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="surface-card stat-card accent-card">
            <Sparkles size={18} />
            <h3>Production note</h3>
            <p>
              The next step is to replace the mocked batch executor with server-side calls to OpenAI
              Responses and Gemini Generate Content endpoints.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}
