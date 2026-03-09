import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

export function PromptsPage() {
  const { prompts, createPrompt } = useAppContext();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return prompts;

    return prompts.filter((prompt) => {
      return [prompt.title, prompt.summary, prompt.tags.join(' '), prompt.systemPrompt]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [prompts, query]);

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Prompt workspace</p>
          <h2>Prompt library</h2>
          <p>
            Organize system prompts by workflow, keep prompt intent crisp, and track what you test
            against real providers.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() =>
            createPrompt({
              title: 'New Prompt Draft',
              summary: 'Fresh draft ready for editing.',
              systemPrompt: 'Describe the role, task, inputs, and output constraints here.',
              tags: ['draft'],
            })
          }
        >
          <Plus size={16} />
          New prompt
        </button>
      </header>

      <div className="toolbar-card">
        <label className="search-input">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompt title, summary, tags, or body"
          />
        </label>
        <div className="pill">{filtered.length} prompts</div>
      </div>

      <div className="card-grid card-grid-prompts">
        {filtered.map((prompt) => (
          <article key={prompt.id} className="surface-card prompt-card">
            <div className="prompt-card-topline">
              <div className="tag-row">
                {prompt.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="meta-text">{prompt.runCount} runs</span>
            </div>
            <div>
              <h3>{prompt.title}</h3>
              <p>{prompt.summary}</p>
            </div>
            <pre className="code-snippet">{prompt.systemPrompt}</pre>
            <footer className="card-footer">
              <span className="meta-text">
                Updated {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
              </span>
              <Link className="inline-link" to={`/prompts/${encodeURIComponent(prompt.id)}`}>
                Open
                <ArrowRight size={16} />
              </Link>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
