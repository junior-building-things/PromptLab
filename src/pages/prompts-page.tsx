import { format, formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { setPageChrome } from '../components/app-layout';
import {
  IconChev,
  IconCopy,
  IconEdit,
  IconFilter,
  IconPlay,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../components/icons';
import { Modal } from '../components/modal';
import { useAppContext } from '../context/app-context';

type ComposerMode =
  // "Create project" — full form including project type, project name
  // editable, both fields required.
  | { kind: 'create-project' }
  // "Add prompt" — same modal chrome but project name locked to an
  // existing project, project-type field hidden, only the system
  // prompt is captured. handleCreate routes the submit through
  // createPromptVersion(projectId, ...) instead of createPromptProject.
  | { kind: 'add-prompt'; projectId: string };

type ComposerState = {
  projectName: string;
  projectType: string;
  systemPrompt: string;
  mode: ComposerMode;
};

const PROJECT_TYPES = [
  { value: 'social-avatar', label: 'Social Avatar' },
  { value: 'typing-recommendation', label: 'Typing Recommendation' },
];

function formatRelative(value: string) {
  try {
    return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
  } catch {
    return '';
  }
}

function formatStamp(value: string) {
  try {
    return format(new Date(value), 'dd MMM yyyy · HH:mm');
  } catch {
    return '';
  }
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({
    projectName: '',
    projectType: '',
    systemPrompt: '',
    mode: { kind: 'create-project' },
  });
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());
  const [projectTypeOpen, setProjectTypeOpen] = useState(false);

  const cards = useMemo(() => {
    const term = query.trim().toLowerCase();
    return promptProjects
      .map((project) => {
        const versions = promptVersions
          .filter((v) => v.projectId === project.id)
          .sort((a, b) => b.version - a.version);
        return { project, versions };
      })
      .filter(({ versions }) => versions.length > 0)
      .filter(({ project, versions }) => {
        if (!term) return true;
        return (
          project.name.toLowerCase().includes(term) ||
          versions.some((v) => v.systemPrompt.toLowerCase().includes(term))
        );
      })
      .sort(
        (a, b) =>
          new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime(),
      );
  }, [promptProjects, promptVersions, query]);

  // Inject the page-specific topbar action ("New project") + toolbar
  // (search + filter chip) into the layout shell.
  useEffect(() => {
    setPageChrome({
      topbarRight: (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setComposer({
              projectName: '',
              projectType: '',
              systemPrompt: '',
              mode: { kind: 'create-project' },
            });
            setComposerOpen(true);
          }}
        >
          <IconBox><IconPlus /></IconBox>
          New project
        </button>
      ),
      toolbar: (
        <div className="toolbar">
          <div className="search">
            <IconBox size={13}><IconSearch /></IconBox>
            <input
              type="text"
              placeholder="Search project names or prompt bodies"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="kbd">⌘K</span>
          </div>
          <button type="button" className="chip">
            <IconBox size={12}><IconFilter /></IconBox>
            All projects
          </button>
        </div>
      ),
    });
    return () => setPageChrome({});
  }, [query]);

  const toggleProject = (id: string) =>
    setOpenProjects((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreate = () => {
    if (!composer.projectName.trim() || !composer.systemPrompt.trim()) return;
    if (composer.mode.kind === 'add-prompt') {
      // Appending a new version to an existing project — project name
      // is locked in the form so we trust the mode payload's id rather
      // than re-resolving by name.
      createPromptVersion(composer.mode.projectId, composer.systemPrompt.trim());
    } else {
      createPromptProject({
        name: composer.projectName.trim(),
        systemPrompt: composer.systemPrompt.trim(),
      });
    }
    setComposer({
      projectName: '',
      projectType: '',
      systemPrompt: '',
      mode: { kind: 'create-project' },
    });
    setComposerOpen(false);
  };

  const handleNewPromptVersion = (projectId: string, projectName: string) => {
    // Reuse the same modal as "Create project" but locked into add-
    // prompt mode: project name is pre-filled + read-only, project type
    // field is hidden, and submit routes to createPromptVersion.
    setComposer({
      projectName,
      projectType: '',
      systemPrompt: '',
      mode: { kind: 'add-prompt', projectId },
    });
    setComposerOpen(true);
  };

  const handleRemoveProject = (projectId: string, projectName: string) => {
    if (window.confirm(`Remove ${projectName} and all of its prompt versions?`)) {
      removePromptProject(projectId);
    }
  };

  const canCreate =
    composer.projectName.trim().length > 0 && composer.systemPrompt.trim().length > 0;

  return (
    <>
      <div className="body">
        <div className="section" style={{ marginTop: 0 }}>
          {cards.length === 0 ? (
            <div className="hero" style={{ padding: 32, textAlign: 'center' }}>
              <div className="page-sub">
                {query
                  ? `No matches for "${query}".`
                  : 'No projects yet — hit "New project" to create the first one.'}
              </div>
            </div>
          ) : (
            cards.map(({ project, versions }) => {
              const isOpen = openProjects.has(project.id);
              return (
                <div
                  key={project.id}
                  className={`project ${isOpen ? 'open' : ''}`}
                  data-id={project.id}
                >
                  <div className="project-head" onClick={() => toggleProject(project.id)}>
                    <div className="project-chev">
                      <IconBox size={12}><IconChev /></IconBox>
                    </div>
                    <div className="project-title">{project.name}</div>
                    <div className="project-pill">{versions.length} prompts</div>
                    <div className="project-meta">Updated {formatRelative(project.updatedAt)}</div>
                    <div className="project-spacer" />
                    <div className="project-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn">
                        <IconBox><IconPlay /></IconBox>
                        Test latest
                      </button>
                      <button
                        type="button"
                        className="btn btn-ai"
                        onClick={() => handleNewPromptVersion(project.id, project.name)}
                      >
                        <IconBox><IconPlus /></IconBox>
                        New prompt
                      </button>
                      <button
                        type="button"
                        className="icon-btn naked"
                        onClick={() => handleRemoveProject(project.id, project.name)}
                        aria-label="Remove project"
                      >
                        <IconBox><IconTrash /></IconBox>
                      </button>
                    </div>
                  </div>
                  <div className="project-body">
                    {versions[0]?.summary ? (
                      <div className="project-desc">{versions[0].summary}</div>
                    ) : null}
                    <div className="version-block">
                      {versions.map((version, i) => {
                        const isLatest = i === 0;
                        return (
                          <div key={version.id} className="version">
                            <div className="version-head">
                              <span
                                className={`version-tag ${isLatest ? 'latest' : 'previous'}`}
                              >
                                {isLatest
                                  ? `V${version.version} · LATEST`
                                  : `V${version.version}`}
                              </span>
                              <span className="version-stamp">
                                {formatStamp(version.updatedAt)}
                              </span>
                              <div className="version-actions">
                                <button type="button" className="icon-btn naked">
                                  <IconBox><IconCopy /></IconBox>
                                </button>
                                <button type="button" className="icon-btn naked">
                                  <IconBox><IconEdit /></IconBox>
                                </button>
                              </div>
                            </div>
                            <div className="version-body">{version.systemPrompt}</div>
                            <div className="version-foot">
                              <span className="tok">{version.runCount} runs</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title={composer.mode.kind === 'add-prompt' ? 'Add prompt' : 'Create project'}
        sub={
          composer.mode.kind === 'add-prompt'
            ? 'New version for an existing project'
            : 'New prompt workspace'
        }
        headerActions={
          <>
            <button type="button" className="btn" onClick={() => setComposerOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canCreate}
              onClick={handleCreate}
            >
              <IconBox><IconPlus /></IconBox>
              {composer.mode.kind === 'add-prompt' ? 'Add prompt' : 'Create project'}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label">
            Project name<span className="req">*</span>
          </label>
          <input
            type="text"
            className="field-input"
            value={composer.projectName}
            // Project name is fixed when adding a prompt to an existing
            // project — the user chose the target by clicking "New
            // prompt" on a specific card.
            readOnly={composer.mode.kind === 'add-prompt'}
            disabled={composer.mode.kind === 'add-prompt'}
            onChange={(event) =>
              setComposer((c) => ({ ...c, projectName: event.target.value }))
            }
            placeholder="UGC sticker tagging"
          />
        </div>

        {composer.mode.kind === 'create-project' && (
          <div className="field">
            <label className="field-label">Project type</label>
            <div className="type-row">
              <div
                className={`dropdown ${projectTypeOpen ? 'open' : ''}`}
                data-value={composer.projectType}
              >
                <button
                  type="button"
                  className="dropdown-trigger"
                  onClick={() => setProjectTypeOpen((o) => !o)}
                >
                  <span className="dropdown-label">
                    {PROJECT_TYPES.find((t) => t.value === composer.projectType)?.label ??
                      'Select a type…'}
                  </span>
                  <svg
                    className="dropdown-chev"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 4.5l3 3 3-3" />
                  </svg>
                </button>
                <div className="dropdown-menu" hidden={!projectTypeOpen}>
                  {PROJECT_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className={`dropdown-option ${
                        composer.projectType === type.value ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setComposer((c) => ({ ...c, projectType: type.value }));
                        setProjectTypeOpen(false);
                      }}
                    >
                      {type.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label">
            System prompt<span className="req">*</span>
          </label>
          <textarea
            className="field-textarea"
            value={composer.systemPrompt}
            onChange={(event) =>
              setComposer((c) => ({ ...c, systemPrompt: event.target.value }))
            }
            placeholder="You are an expert in internet culture and memes, and your job is to…"
          />
        </div>
      </Modal>
    </>
  );
}

/** Small wrapper to give each inline SVG icon component an explicit
 * pixel size — the icon components themselves stretch to 100%/100% so
 * their container determines the rendered dimensions. */
function IconBox({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
