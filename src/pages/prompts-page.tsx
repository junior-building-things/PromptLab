import { differenceInDays, differenceInHours, differenceInMinutes, differenceInMonths, differenceInYears, format } from 'date-fns';
import { ChevronDown, ChevronRight, FolderPlus, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app-context';

type ComposerState =
  | { mode: 'project'; projectId: null; projectName: string; systemPrompt: string }
  | { mode: 'prompt'; projectId: string; projectName: string; systemPrompt: string };

function formatCompactUpdatedAt(value: string) {
  const date = new Date(value);
  const now = new Date();
  const years = differenceInYears(now, date);
  if (years >= 1) {
    return `Updated ${years}y ago`;
  }

  const months = differenceInMonths(now, date);
  if (months >= 1) {
    return `Updated ${months}mo ago`;
  }

  const days = differenceInDays(now, date);
  if (days >= 1) {
    return `Updated ${days}d ago`;
  }

  const hours = differenceInHours(now, date);
  if (hours >= 1) {
    return `Updated ${hours}h ago`;
  }

  const minutes = Math.max(1, differenceInMinutes(now, date));
  return `Updated ${minutes}m ago`;
}

export function PromptsPage() {
  const {
    promptProjects,
    promptVersions,
    createPromptProject,
    createPromptVersion,
    removePromptProject,
  } = useAppContext();
  const [query, setQuery] = useState('');
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const cards = useMemo(() => {
    return promptProjects
      .map((project) => {
        const versions = promptVersions
          .filter((version) => version.projectId === project.id)
          .sort((left, right) => right.version - left.version);
        const latestVersion = versions[0];

        return {
          project,
          versions,
          latestVersion,
        };
      })
      .filter(({ latestVersion }) => latestVersion)
      .filter(({ project, versions, latestVersion }) => {
        const term = query.trim().toLowerCase();
        if (!term) return true;

        return [
          project.name,
          latestVersion.summary,
          latestVersion.systemPrompt,
          ...versions.flatMap((version) => [version.title, version.summary, version.tags.join(' ')]),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((left, right) =>
        new Date(right.project.updatedAt).getTime() - new Date(left.project.updatedAt).getTime(),
      );
  }, [promptProjects, promptVersions, query]);

  function openProjectComposer() {
    setComposer({
      mode: 'project',
      projectId: null,
      projectName: '',
      systemPrompt: '',
    });
  }

  function openPromptComposer(projectId: string, projectName: string) {
    setComposer({
      mode: 'prompt',
      projectId,
      projectName,
      systemPrompt: '',
    });
    setMenuProjectId(null);
  }

  function closeComposer() {
    setComposer(null);
  }

  function submitComposer() {
    if (!composer) return;
    if (!composer.projectName.trim() || !composer.systemPrompt.trim()) return;

    if (composer.mode === 'project') {
      createPromptProject({
        name: composer.projectName.trim(),
        systemPrompt: composer.systemPrompt.trim(),
      });
      closeComposer();
      return;
    }

    createPromptVersion(composer.projectId, composer.systemPrompt.trim());
    closeComposer();
  }

  function handleRemoveProject(projectId: string, projectName: string) {
    if (!window.confirm(`Remove ${projectName} and all of its prompt versions?`)) {
      return;
    }

    removePromptProject(projectId);
    setMenuProjectId(null);
  }

  function toggleProjectExpand(projectId: string) {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  return (
    <>
      <section className="page-stack">
        <header className="hero-card">
          <div>
            <h2>Prompt Library</h2>
            <p>
              Organize prompts as projects, create versioned iterations, and keep the latest candidate
              easy to test.
            </p>
          </div>
          <button className="button button-primary" onClick={openProjectComposer}>
            <FolderPlus size={16} />
            New Project
          </button>
        </header>

        <div className="toolbar-card">
          <label className="search-input">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search project names or prompt bodies"
            />
          </label>
          <div className="pill">{cards.length} projects</div>
        </div>

        <div className="card-grid card-grid-prompts">
          {cards.map(({ project, versions, latestVersion }) => {
            const isExpanded = expandedProjects.has(project.id);

            return (
            <article key={project.id} className="surface-card prompt-card prompt-project-card prompt-project-shell">
              <div className="prompt-project-header">
                <button
                  type="button"
                  className="prompt-project-toggle"
                  onClick={() => toggleProjectExpand(project.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`prompt-project-${project.id}`}
                >
                  <div className="list-card-topline">
                    <div className="icon-pill icon-pill-muted">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    <div className="prompt-project-title-row">
                      <h3>{project.name}</h3>
                      <div className="project-version-meta">
                        <span className="pill pill-subtle">{versions.length} prompts</span>
                        <span className="meta-text">{formatCompactUpdatedAt(project.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="button-row-inline card-actions-corner">
                  <button
                    className="button button-secondary button-small"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPromptComposer(project.id, project.name);
                    }}
                  >
                    <Plus size={15} />
                    New Prompt
                  </button>
                  <div className="card-menu-wrap">
                    <button
                      className="icon-action-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuProjectId((current) => (current === project.id ? null : project.id));
                      }}
                      aria-label="Project actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {menuProjectId === project.id ? (
                      <div className="card-menu-sheet" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="menu-sheet-action menu-sheet-danger"
                          onClick={() => handleRemoveProject(project.id, project.name)}
                        >
                          <Trash2 size={15} />
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="prompt-project-preview">
                {latestVersion.summary ? <p>{latestVersion.summary}</p> : null}
              </div>

              {latestVersion.tags.length > 0 ? (
                <div className="tag-row">
                  {latestVersion.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="prompt-version-label">Latest version: v{latestVersion.version}</div>
              <pre className="code-snippet prompt-project-snippet">{latestVersion.systemPrompt}</pre>

              {isExpanded ? (
                <div id={`prompt-project-${project.id}`} className="prompt-project-expanded">
                  {versions.slice(1).map((version) => (
                    <article key={version.id} className="project-prompt-card prompt-project-version">
                      <div className="prompt-version-label">v{version.version}</div>
                      {version.changeSummary?.length ? (
                        <div className="prompt-change-summary">
                          <strong>What changed:</strong>
                          <ul className="prompt-change-list">
                            {version.changeSummary.map((bullet, index) => (
                              <li key={`${version.id}-${index}`}>{bullet.replace(/^-\s*/, '')}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <pre className="code-snippet">{version.systemPrompt}</pre>
                    </article>
                  ))}
                </div>
              ) : null}
            </article>
            );
          })}
        </div>
      </section>

      {composer ? (
        <div className="composer-backdrop" onClick={closeComposer}>
          <section className="surface-card composer-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="composer-sheet-header">
              <div>
                <h3>{composer.mode === 'project' ? 'Create Project' : 'Create Prompt'}</h3>
              </div>
              <div className="button-row-inline">
                <button className="button button-secondary" onClick={closeComposer}>
                  Cancel
                </button>
                <button className="button button-primary" onClick={submitComposer}>
                  {composer.mode === 'project' ? 'Create Project' : 'Create Prompt'}
                </button>
              </div>
            </header>

            <div className="stack-list">
              <label className="field-block">
                <span>Project name</span>
                <input
                  value={composer.projectName}
                  disabled={composer.mode === 'prompt'}
                  onChange={(event) =>
                    setComposer((current) =>
                      current
                        ? {
                            ...current,
                            projectName: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Launch Messaging"
                />
              </label>

              <label className="field-block">
                <span>System prompt</span>
                <textarea
                  rows={12}
                  value={composer.systemPrompt}
                  onChange={(event) =>
                    setComposer((current) =>
                      current
                        ? {
                            ...current,
                            systemPrompt: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Describe the role, task, inputs, and output constraints here."
                />
              </label>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
