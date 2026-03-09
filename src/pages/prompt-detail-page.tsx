import { format } from 'date-fns';
import { FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

export function PromptDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { promptProjects, promptVersions, removePromptProject, removePromptVersion } = useAppContext();
  const [menuVersionId, setMenuVersionId] = useState<string | null>(null);

  const project = promptProjects.find((entry) => entry.id === projectId);
  const versions = promptVersions
    .filter((entry) => entry.projectId === projectId)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  if (!project || versions.length === 0) {
    return (
      <section className="page-stack">
        <div className="surface-card empty-card">
          <h2>Prompt Project Not Found</h2>
          <p>The route is valid, but there is no project matching this id in local state.</p>
          <Link to="/" className="button button-primary">
            Back To Prompts
          </Link>
        </div>
      </section>
    );
  }

  const activeProject = project;

  function handleRemoveProject() {
    if (!window.confirm(`Remove ${activeProject.name} and all prompts under it?`)) {
      return;
    }

    removePromptProject(activeProject.id);
    navigate('/');
  }

  function handleRemovePrompt(versionId: string, versionNumber: number) {
    if (!window.confirm(`Remove Prompt v${versionNumber}?`)) {
      return;
    }

    const isLastVersion = versions.length === 1;
    removePromptVersion(versionId);
    setMenuVersionId(null);

    if (isLastVersion) {
      navigate('/');
    }
  }

  return (
    <section className="page-stack">
      <header className="hero-card prompt-detail-hero">
        <div>
          <p className="eyebrow">Prompt Project</p>
          <h2>{activeProject.name}</h2>
          <p>All prompts under this project, sorted by latest first.</p>
        </div>
        <button className="button button-secondary" onClick={handleRemoveProject}>
          <Trash2 size={16} />
          Remove Project
        </button>
      </header>

      <div className="stack-list">
        {versions.map((version) => (
          <article key={version.id} className="surface-card project-prompt-card">
            <div className="project-prompt-card-header">
              <div className="list-card-topline">
                <div className="icon-pill icon-pill-muted">
                  <FileText size={18} />
                </div>
                <div>
                  <h3>Prompt v{version.version}</h3>
                  <p>
                    Updated {format(new Date(version.updatedAt), 'MMM d, yyyy HH:mm')} · {version.runCount} runs
                  </p>
                </div>
              </div>
              <div className="card-menu-wrap">
                <button
                  className="icon-action-button"
                  onClick={() =>
                    setMenuVersionId((current) => (current === version.id ? null : version.id))
                  }
                  aria-label="Prompt Actions"
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuVersionId === version.id ? (
                  <div className="card-menu-sheet">
                    <button
                      className="menu-sheet-action menu-sheet-danger"
                      onClick={() => handleRemovePrompt(version.id, version.version)}
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {version.summary ? <p>{version.summary}</p> : null}

            {version.tags.length > 0 ? (
              <div className="tag-row">
                {version.tags.map((tag) => (
                  <span className="tag-chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <pre className="code-snippet">{version.systemPrompt}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
