import { format } from 'date-fns';
import { FileText, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

export function PromptDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { promptProjects, promptVersions, removePromptProject, removePromptVersion } = useAppContext();

  const project = promptProjects.find((entry) => entry.id === projectId);
  const versions = promptVersions
    .filter((entry) => entry.projectId === projectId)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  if (!project || versions.length === 0) {
    return (
      <section className="page-stack">
        <div className="surface-card empty-card">
          <h2>Prompt project not found</h2>
          <p>The route is valid, but there is no project matching this id in local state.</p>
          <Link to="/" className="button button-primary">
            Back to prompts
          </Link>
        </div>
      </section>
    );
  }

  const activeProject = project;

  function handleDeleteProject() {
    if (!window.confirm(`Delete ${activeProject.name} and all prompts under it?`)) {
      return;
    }

    removePromptProject(activeProject.id);
    navigate('/');
  }

  function handleDeletePrompt(versionId: string, versionNumber: number) {
    if (!window.confirm(`Delete prompt v${versionNumber}?`)) {
      return;
    }

    const isLastVersion = versions.length === 1;
    removePromptVersion(versionId);

    if (isLastVersion) {
      navigate('/');
    }
  }

  return (
    <section className="page-stack">
      <header className="hero-card prompt-detail-hero">
        <div>
          <p className="eyebrow">Prompt project</p>
          <h2>{activeProject.name}</h2>
          <p>All prompts under this project, sorted by latest first.</p>
        </div>
        <button className="button button-secondary" onClick={handleDeleteProject}>
          <Trash2 size={16} />
          Delete project
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
              <button
                className="button button-danger button-small"
                onClick={() => handleDeletePrompt(version.id, version.version)}
              >
                <Trash2 size={15} />
                Delete
              </button>
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
