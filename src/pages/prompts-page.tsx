import { formatDistanceToNow } from 'date-fns';
import { CopyPlus, FolderPlus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

export function PromptsPage() {
  const {
    promptProjects,
    promptVersions,
    createPromptProject,
    createPromptVersion,
    removePromptProject,
  } = useAppContext();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

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
          latestVersion.title,
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

  function handleNewProject() {
    const created = createPromptProject();
    navigate(`/prompts/${created.project.id}?version=${created.version.id}`);
  }

  function handleCreateVersion(projectId: string) {
    const created = createPromptVersion(projectId);
    if (created) {
      navigate(`/prompts/${projectId}?version=${created.id}`);
    }
  }

  function handleRemoveProject(projectId: string, projectName: string) {
    if (!window.confirm(`Remove ${projectName} and all of its prompt versions?`)) {
      return;
    }

    removePromptProject(projectId);
  }

  return (
    <section className="page-stack">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Prompt workspace</p>
          <h2>Prompt library</h2>
          <p>
            Organize prompts as projects, create versioned iterations, and keep the latest candidate
            easy to test.
          </p>
        </div>
        <button className="button button-primary" onClick={handleNewProject}>
          <FolderPlus size={16} />
          New project
        </button>
      </header>

      <div className="toolbar-card">
        <label className="search-input">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project names, version titles, tags, or prompt bodies"
          />
        </label>
        <div className="pill">{cards.length} projects</div>
      </div>

      <div className="card-grid card-grid-prompts">
        {cards.map(({ project, versions, latestVersion }) => (
          <article
            key={project.id}
            className="surface-card prompt-card prompt-project-card"
            onClick={() => navigate(`/prompts/${project.id}?version=${latestVersion.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(`/prompts/${project.id}?version=${latestVersion.id}`);
              }
            }}
          >
            <div className="prompt-card-topline">
              <div className="tag-row">
                {latestVersion.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="meta-text">{latestVersion.runCount} runs</span>
            </div>

            <div>
              <h3>{project.name}</h3>
              <p>{latestVersion.summary}</p>
            </div>

            <div className="project-version-meta">
              <span className="pill">Latest v{latestVersion.version}</span>
              <span className="pill pill-subtle">{versions.length} versions</span>
            </div>

            <pre className="code-snippet">{latestVersion.systemPrompt}</pre>

            <footer className="card-footer card-footer-actions">
              <span className="meta-text">
                Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
              </span>
              <div className="button-row-inline">
                <button
                  className="button button-secondary button-small"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCreateVersion(project.id);
                  }}
                >
                  <CopyPlus size={15} />
                  Create
                </button>
                <button
                  className="button button-danger button-small"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveProject(project.id, project.name);
                  }}
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
