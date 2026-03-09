import { format } from 'date-fns';
import { CopyPlus, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/app-context';

export function PromptDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    promptProjects,
    promptVersions,
    history,
    createPromptVersion,
    updatePromptProject,
    updatePromptVersion,
  } = useAppContext();

  const project = promptProjects.find((entry) => entry.id === projectId);
  const versions = useMemo(
    () =>
      promptVersions
        .filter((entry) => entry.projectId === projectId)
        .sort((left, right) => right.version - left.version),
    [projectId, promptVersions],
  );
  const selectedVersionId = searchParams.get('version') ?? versions[0]?.id;
  const selectedVersion = versions.find((entry) => entry.id === selectedVersionId) ?? versions[0];

  const [draft, setDraft] = useState({
    projectName: project?.name ?? '',
    title: selectedVersion?.title ?? '',
    summary: selectedVersion?.summary ?? '',
    systemPrompt: selectedVersion?.systemPrompt ?? '',
    tags: selectedVersion?.tags.join(', ') ?? '',
  });

  useEffect(() => {
    setDraft({
      projectName: project?.name ?? '',
      title: selectedVersion?.title ?? '',
      summary: selectedVersion?.summary ?? '',
      systemPrompt: selectedVersion?.systemPrompt ?? '',
      tags: selectedVersion?.tags.join(', ') ?? '',
    });
  }, [project?.name, selectedVersion]);

  const relatedRuns = useMemo(
    () => history.filter((run) => run.scenario.promptId === selectedVersion?.id).slice(0, 4),
    [history, selectedVersion?.id],
  );

  if (!project || !selectedVersion) {
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
  const activeVersion = selectedVersion;

  function saveVersion() {
    updatePromptProject(activeProject.id, { name: draft.projectName });
    updatePromptVersion(activeVersion.id, {
      title: draft.title,
      summary: draft.summary,
      systemPrompt: draft.systemPrompt,
      tags: draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }

  function createVersionAndSelect() {
    const created = createPromptVersion(activeProject.id);
    if (!created) return;
    setSearchParams({ version: created.id });
  }

  return (
    <section className="page-stack">
      <header className="hero-card prompt-detail-hero">
        <div>
          <p className="eyebrow">Prompt project</p>
          <h2>{activeProject.name}</h2>
          <p>
            Review every version under this project, choose the active draft, and keep edits scoped
            to the selected version.
          </p>
        </div>
        <div className="button-row-inline">
          <button className="button button-secondary" onClick={createVersionAndSelect}>
            <CopyPlus size={16} />
            New version
          </button>
          <button className="button button-primary" onClick={saveVersion}>
            <Save size={16} />
            Save version
          </button>
        </div>
      </header>

      <div className="detail-grid">
        <article className="surface-card form-card">
          <label className="field-block">
            <span>Project name</span>
            <input
              value={draft.projectName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, projectName: event.target.value }))
              }
            />
          </label>
          <label className="field-block">
            <span>Version title</span>
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
            <p className="eyebrow">All versions</p>
            <div className="stack-list compact-list">
              {versions.map((version) => (
                <button
                  key={version.id}
                  className={`version-row${version.id === activeVersion.id ? ' is-selected' : ''}`}
                  onClick={() => setSearchParams({ version: version.id })}
                >
                  <div>
                    <strong>v{version.version}</strong>
                    <p>{version.title}</p>
                  </div>
                  <span className="pill pill-subtle">{version.runCount} runs</span>
                </button>
              ))}
            </div>
          </article>

          <article className="surface-card stat-card">
            <p className="eyebrow">Selected version</p>
            <div className="stat-row">
              <span>Version</span>
              <strong>v{activeVersion.version}</strong>
            </div>
            <div className="stat-row">
              <span>Last updated</span>
              <strong>{format(new Date(activeVersion.updatedAt), 'MMM d, yyyy HH:mm')}</strong>
            </div>
            <div className="stat-row">
              <span>Total runs</span>
              <strong>{activeVersion.runCount}</strong>
            </div>
            <div className="tag-row">
              {activeVersion.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </article>

          <article className="surface-card stat-card">
            <p className="eyebrow">Recent runs</p>
            {relatedRuns.length === 0 ? (
              <p className="muted-copy">No batch runs have used this version yet.</p>
            ) : (
              <div className="stack-list compact-list">
                {relatedRuns.map((run) => (
                  <button
                    key={run.id}
                    className="version-row"
                    onClick={() => navigate('/history')}
                  >
                    <div>
                      <strong>{run.name}</strong>
                      <p>{format(new Date(run.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    <span className="pill pill-subtle">{run.results.length} outputs</span>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="surface-card stat-card accent-card">
            <Sparkles size={18} />
            <h3>Versioning rule</h3>
            <p>
              Create a new version when the prompt intent shifts, not just when copy changes. Keep
              versions tight so batch history stays comparable.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}
