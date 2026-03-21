import { format } from 'date-fns';
import { ChevronLeft, FileText, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

type ComposerState = {
  projectId: string;
  projectName: string;
  systemPrompt: string;
};

type PromptChangeSummaryResponse = {
  summaries?: Array<{
    versionId: string;
    bullets: string[];
  }>;
};

export function PromptDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    promptProjects,
    promptVersions,
    createPromptVersion,
    removePromptProject,
    removePromptVersion,
  } = useAppContext();
  const [menuVersionId, setMenuVersionId] = useState<string | null>(null);
  const [menuProjectOpen, setMenuProjectOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [changeSummaryByVersionId, setChangeSummaryByVersionId] = useState<Record<string, string[]>>({});

  const project = promptProjects.find((entry) => entry.id === projectId);
  const projectVersions = promptVersions.filter((entry) => entry.projectId === projectId);
  const versions = [...projectVersions].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  const versionSequence = useMemo(
    () => [...projectVersions].sort((left, right) => right.version - left.version),
    [projectVersions],
  );
  const summaryComparisons = useMemo(
    () =>
      versionSequence.length > 1
        ? versionSequence.slice(0, -1).map((version, index) => ({
            versionId: version.id,
            currentPrompt: version.systemPrompt,
            previousPrompt: versionSequence[index + 1]?.systemPrompt || '',
          }))
        : [],
    [versionSequence],
  );
  const summaryComparisonSignature = summaryComparisons
    .map(({ versionId, currentPrompt, previousPrompt }) => `${versionId}:${currentPrompt}:${previousPrompt}`)
    .join('\n---\n');

  useEffect(() => {
    if (summaryComparisons.length === 0) {
      setChangeSummaryByVersionId({});
      return;
    }

    let active = true;

    async function loadChangeSummaries() {
      try {
        const response = await fetch('/api/prompt-diff-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            comparisons: summaryComparisons,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate prompt change summaries.');
        }

        const payload = (await response.json()) as PromptChangeSummaryResponse;
        if (!active) {
          return;
        }

        const nextSummaries = Object.fromEntries(
          (payload.summaries ?? []).map((entry) => [entry.versionId, entry.bullets]),
        );
        setChangeSummaryByVersionId(nextSummaries);
      } catch {
        if (active) {
          setChangeSummaryByVersionId({});
        }
      }
    }

    void loadChangeSummaries();

    return () => {
      active = false;
    };
  }, [summaryComparisonSignature]);

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

  function openPromptComposer() {
    setComposer({
      projectId: activeProject.id,
      projectName: activeProject.name,
      systemPrompt: '',
    });
  }

  function closeComposer() {
    setComposer(null);
  }

  function submitComposer() {
    if (!composer || !composer.systemPrompt.trim()) return;
    createPromptVersion(composer.projectId, composer.systemPrompt.trim());
    closeComposer();
  }

  function handleRemoveProject() {
    if (!window.confirm(`Remove ${activeProject.name} and all prompts under it?`)) {
      return;
    }

    setMenuProjectOpen(false);
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
    <>
      <section className="page-stack">
        <div className="prompt-detail-header">
          <button
            type="button"
            className="surface-card prompt-detail-back-card"
            onClick={() => navigate('/')}
            aria-label="Back to prompts"
          >
            <ChevronLeft size={24} />
          </button>
          <header className="hero-card prompt-detail-hero">
            <div>
              <h2>{activeProject.name}</h2>
              <p>All prompts under this project, sorted by latest first.</p>
            </div>
            <div className="button-row-inline card-actions-corner">
              <button className="button button-secondary button-small" onClick={openPromptComposer}>
                <Plus size={16} />
                New Prompt
              </button>
              <div className="card-menu-wrap">
                <button
                  className="icon-action-button"
                  onClick={() => setMenuProjectOpen((current) => !current)}
                  aria-label="Project actions"
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuProjectOpen ? (
                  <div className="card-menu-sheet">
                    <button
                      className="menu-sheet-action menu-sheet-danger"
                      onClick={handleRemoveProject}
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        </div>

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

              {versions.length > 1 && changeSummaryByVersionId[version.id]?.length ? (
                <div className="prompt-change-summary">
                  <strong>What changed:</strong>
                  <ul className="prompt-change-list">
                    {changeSummaryByVersionId[version.id].map((bullet, index) => (
                      <li key={`${version.id}-${index}`}>{bullet.replace(/^-\s*/, '')}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <pre className="code-snippet">{version.systemPrompt}</pre>
            </article>
          ))}
        </div>
      </section>

      {composer ? (
        <div className="composer-backdrop" onClick={closeComposer}>
          <section className="surface-card composer-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="composer-sheet-header">
              <div>
                <h3>Create Prompt</h3>
              </div>
              <div className="button-row-inline">
                <button className="button button-secondary" onClick={closeComposer}>
                  Cancel
                </button>
                <button className="button button-primary" onClick={submitComposer}>
                  Create Prompt
                </button>
              </div>
            </header>

            <div className="stack-list">
              <label className="field-block">
                <span>Project Name</span>
                <input value={composer.projectName} disabled />
              </label>

              <label className="field-block">
                <span>System Prompt</span>
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
