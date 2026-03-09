import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileText,
  History as HistoryIcon,
  ImageIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/app-context';

export function HistoryPage() {
  const { history, prompts, models, assets } = useAppContext();
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  const counters = useMemo(() => history.reduce((sum, run) => sum + run.results.length, 0), [history]);

  const toggleExpand = (id: string) => {
    setExpandedTests((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPrompt = (id: string) => prompts.find((entry) => entry.id === id);
  const getModel = (id: string) => models.find((entry) => entry.id === id);
  const getAsset = (id?: string) => assets.find((entry) => entry.id === id);

  return (
    <section className="page-stack">
      <header className="page-heading-row">
        <div>
          <h2>History</h2>
          <p>View past batch testing results.</p>
        </div>
        <div className="toolbar-group">
          <div className="pill pill-subtle">{history.length} runs recorded</div>
          <div className="pill pill-subtle">{counters} outputs logged</div>
        </div>
      </header>

      <div className="stack-list">
        {history.length === 0 ? (
          <div className="surface-card empty-card">
            <HistoryIcon size={44} />
            <h3>No history yet</h3>
            <p>Run a batch test to start logging history and comparing model outputs.</p>
          </div>
        ) : (
          history.map((run) => (
            <article key={run.id} className="surface-card history-shell">
              <button className="history-toggle" onClick={() => toggleExpand(run.id)}>
                <div className="list-card-topline">
                  <div className="icon-pill icon-pill-muted">
                    {expandedTests.has(run.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div>
                    <h3>{run.name}</h3>
                    <div className="history-meta">
                      <span>
                        <Calendar size={14} />
                        {format(new Date(run.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                      <span className="pill">{run.results.length} results</span>
                    </div>
                  </div>
                </div>
              </button>

              {expandedTests.has(run.id) ? (
                <div className="history-results-grid">
                  {run.results.map((result) => {
                    const prompt = getPrompt(result.promptId);
                    const model = getModel(result.modelId);
                    const asset = getAsset(result.assetId);

                    return (
                      <div className="surface-card history-result-card" key={result.id}>
                        <div className="stack-list compact-list">
                          <div className="meta-pair">
                            <Cpu size={15} />
                            <div>
                              <span>Model</span>
                              <strong>{model?.name ?? 'Unknown model'}</strong>
                            </div>
                          </div>
                          <div className="meta-pair">
                            <FileText size={15} />
                            <div>
                              <span>Prompt</span>
                              <strong>{prompt?.title ?? 'Unknown prompt'}</strong>
                            </div>
                          </div>
                          {asset ? (
                            <div className="meta-pair">
                              <ImageIcon size={15} />
                              <div>
                                <span>Asset</span>
                                <strong>{asset.name}</strong>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="output-panel">
                          <p className="eyebrow">Output</p>
                          <p>{result.output}</p>
                        </div>
                        <div className="history-result-footer">
                          <span className="pill pill-subtle">{result.latencyMs} ms</span>
                          <span className="pill pill-success">
                            <CheckCircle size={14} />
                            {result.score}/100
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
