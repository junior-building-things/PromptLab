import { format } from 'date-fns';
import {
  ChevronDown,
  Download,
  CircleAlert,
  History as HistoryIcon,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { setPageChrome } from '../components/app-layout';
import { ConfirmDialog } from '../components/confirm-dialog';
import {
  MultiSelectDropdown,
  type DropdownGroup,
  type DropdownOption as MsdOption,
} from '../components/multi-select-dropdown';
import { useAppContext } from '../context/app-context';

import {
  IconBox,
  IconCheck,
  IconChev,
  IconCpu,
  IconDoc,
  IconImage,
  IconPlay,
  IconSpinner,
  IconTrash,
} from '../components/icons';
import { expandImageAsset, resolveAssetEntry } from '../lib/asset-images';
import { readThemeMode, resolveTheme } from '../lib/theme';
import { isRenderableImage, toDataUrl } from '../lib/image-source';
import { getProviderLabel, MODEL_CATEGORY_LABELS } from '../lib/model-brand';
import type {
  AssetRecord,
  BatchRun,
  ModelRecord,
  PromptProject,
  PromptVersion,
  TestResult,
  ThinkingLevel,
} from '../lib/types';

const THINKING_OPTIONS: Array<{ value: ThinkingLevel; label: string; description: string }> = [
  { value: 'dynamic', label: 'Dynamic', description: 'Provider default — model picks how much to think.' },
  { value: 'minimal', label: 'Minimal', description: 'Skip reasoning when possible. Lowest latency.' },
  { value: 'low', label: 'Low', description: 'Light reasoning budget.' },
  { value: 'medium', label: 'Medium', description: 'Balanced effort for typical tasks.' },
  { value: 'high', label: 'High', description: 'Maximum reasoning budget. Highest latency / cost.' },
];

function thinkingLabelFor(value: ThinkingLevel | undefined): string | undefined {
  // Return undefined only when no level was persisted at all — that's
  // a pre-Thinking-dropdown run and the caller should fall back to the
  // legacy inferThinkingLevel heuristic. An explicit 'dynamic' is the
  // user's chosen value and should render as "Dynamic", not silently
  // collapse to the inferred default.
  if (!value) return undefined;
  return THINKING_OPTIONS.find((option) => option.value === value)?.label;
}

/** Map a model's provider field to a key into the inlined-logo map.
 * Gemini is published under `google.png` in our public assets, so this
 * isolates that rename in one place. */
type ProviderLogoKey = 'openai' | 'openai_darkmode' | 'google' | 'xai';

const PROVIDER_LOGO_FILES: Record<ProviderLogoKey, string> = {
  openai: '/assets/openai.png',
  openai_darkmode: '/assets/openai_darkmode.png',
  google: '/assets/google.png',
  xai: '/assets/xai.png',
};

/** Fetch each provider PNG and convert to a data URI. Used by the HTML
 * report download so the file works offline / on any origin — `<img
 * src="/assets/openai.png">` would 404 once the user opens the file
 * outside the dev server. Failures fall back to an empty string so the
 * report still renders (just without the mark for that provider). */
async function loadProviderLogoDataUris(): Promise<Record<ProviderLogoKey, string>> {
  const entries = await Promise.all(
    (Object.keys(PROVIDER_LOGO_FILES) as ProviderLogoKey[]).map(async (key) => {
      try {
        const response = await fetch(PROVIDER_LOGO_FILES[key]);
        if (!response.ok) return [key, ''] as const;
        const blob = await response.blob();
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        return [key, dataUri] as const;
      } catch {
        return [key, ''] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<ProviderLogoKey, string>;
}

/** Provider mark for the batch matrix headers. Uses the public-served
 * PNGs under `/assets/` so the same paths work in the live UI and in
 * the downloaded HTML report. For OpenAI we render both the dark and
 * light marks and let CSS toggle visibility based on `data-theme` —
 * cleaner than `filter: invert(1)` and lets us use the dedicated
 * `openai_darkmode.png` asset. */
function ProviderMarkInline({ model }: { model: ModelRecord | undefined }) {
  if (!model) return null;
  const provider = model.provider;
  if (provider === 'openai') {
    return (
      <span className="batch-provider-mark batch-provider-mark-openai">
        <img
          src="/assets/openai.png"
          alt="openai"
          className="batch-provider-img batch-provider-img-openai-light"
        />
        <img
          src="/assets/openai_darkmode.png"
          alt="openai"
          className="batch-provider-img batch-provider-img-openai-dark"
        />
      </span>
    );
  }
  const file = provider === 'gemini' ? 'google.png' : `${provider}.png`;
  // The Google mark renders heavier than OpenAI / xAI at the same box
  // size (the asset has almost no inner padding), so it visually
  // dominates the model name. Tag it so CSS can shave a couple pixels.
  const sizeClass = provider === 'gemini' ? ' batch-provider-img-google' : '';
  return (
    <span className="batch-provider-mark">
      <img src={`/assets/${file}`} alt={provider} className={`batch-provider-img${sizeClass}`} />
    </span>
  );
}

type ApiResult = {
  modelId: string;
  output: string;
  outputImage?: string;
  latencyMs: number;
  score: number;
};

type ApiError = {
  modelId: string;
  message: string;
};

/** Local alias so legacy memo signatures keep using `DropdownOption` —
 * routed through the new component's exported type so additions like
 * `searchText` / `group` flow through. */
type DropdownOption = MsdOption;

type BatchTableCell = {
  rowId: string;
  columnId: string;
  results: TestResult[];
};

type BatchTable = {
  key: string;
  title: string;
  /** When the table title represents a single model (multi-model splits)
   * we stash the model id so renderers can show the provider mark next
   * to the name. Undefined when the title is a prompt version label or
   * the generic "Results" fallback. */
  titleModelId?: string;
  columns: Array<{
    id: string;
    label: string;
    /** Set when this column header represents a model (i.e. multi-model
     * single-prompt runs) so the matrix can render the provider mark. */
    modelId?: string;
  }>;
  rows: Array<{ id: string; label: string; assetId?: string; userInput?: string }>;
  cells: Map<string, BatchTableCell>;
};

// 5 minutes — matches the api/batch-run.js function's maxDuration: 300
// ceiling. OpenAI image-gen at quality:'high' regularly takes 30-120s,
// so the previous 90s client cap killed the request before the
// provider returned. The server-side cap is the real backstop; this
// just stops the client from abandoning an in-flight call too early.
const BATCH_REQUEST_TIMEOUT_MS = 300_000;
const SYSTEM_PROMPT_ONLY_ROW_ID = '__system-prompt-only__';
const SYSTEM_PROMPT_ONLY_ROW_LABEL = 'System Prompt Only';

function parseTextInputs(source: string) {
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function buildSummary(selectedIds: string[], options: DropdownOption[], emptyLabel: string) {
  if (selectedIds.length === 0) return emptyLabel;

  return options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label)
    .join(', ');
}

function isImageOutput(value?: string) {
  return isRenderableImage(value);
}

function buildCellKey(rowId: string, columnId: string) {
  return `${rowId}::${columnId}`;
}

/**
 * Infer a model's "thinking level" string for display next to the
 * model name. Different reasoning families surface different
 * vocabularies (Gemini's "dynamic", OpenAI's "high/medium/low"), so
 * this is a best-effort inference from the model id pattern. Image /
 * video / classic chat models have no thinking concept and return
 * undefined — the caller drops the label in those cases.
 *
 * If a real per-model `thinkingLevel` field is added to ModelRecord
 * later, this helper should prefer that field over the inference.
 */
function inferThinkingLevel(model: ModelRecord | undefined): string | undefined {
  if (!model) return undefined;
  const id = model.apiModel.toLowerCase();
  // Image / video families have no thinking concept.
  if (id.includes('image') || id.includes('sora') || id.includes('veo')) {
    return undefined;
  }
  // Gemini text models default to dynamic thinking unless explicitly
  // pinned with a thinkingBudget. The Pro variants are configurable.
  if (id.startsWith('gemini')) return 'Dynamic';
  // OpenAI gpt-5 family (and the o-series, in case it's ever added)
  // exposes a reasoning_effort knob; "high" is the common default
  // for these comparisons.
  if (id.startsWith('gpt-5') || id.startsWith('o3') || id.startsWith('o4')) {
    return 'High';
  }
  // xAI grok 4.3+ exposes reasoning.
  if (/^grok-(4\.3|5)/.test(id)) return 'High';
  // qwen3-max + qwen3-plus have thinking mode.
  if (id.startsWith('qwen3-max') || id.startsWith('qwen3-plus')) {
    return 'Default';
  }
  return undefined;
}

/** Compose the "MODEL NAME, DYNAMIC THINKING" display label used in
 * matrix section headers + column labels. Prefers the run's explicit
 * scenario.thinkingLevel when one is set; otherwise falls back to the
 * per-family inference. "dynamic" (provider default) is treated the
 * same as no level — the label is just the model name. */
function formatModelLabel(
  model: ModelRecord | undefined,
  scenarioThinking?: ThinkingLevel,
): string {
  if (!model) return 'Unknown Model';
  // Skip the label entirely for image / video / non-reasoning models —
  // showing "Sora, High thinking" would be nonsense.
  const supportsThinking = inferThinkingLevel(model) !== undefined;
  if (!supportsThinking) return model.name;
  const explicit = thinkingLabelFor(scenarioThinking);
  if (explicit) return `${model.name}, ${explicit} thinking`;
  // Fallback to the inferred default vocabulary.
  const inferred = inferThinkingLevel(model);
  if (!inferred) return model.name;
  return `${model.name}, ${inferred} thinking`;
}

function buildRowId(assetId?: string, userInput?: string) {
  if (assetId && userInput) return `${assetId}::${userInput}`;
  if (assetId) return assetId;
  if (userInput) return userInput;
  return SYSTEM_PROMPT_ONLY_ROW_ID;
}

function TextIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="multi-dropdown-option-glyph">
      <Icon size={16} />
    </span>
  );
}

function tryParseJSON(text?: string): any {
  if (!text) return null;
  let trimmed = text.trim();

  // Extract JSON from markdown code blocks (e.g., ```json ... ```)
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch) {
    trimmed = codeBlockMatch[1].trim();
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function generateBatchHtmlReport(
  run: BatchRun,
  assets: AssetRecord[],
  promptProjects: PromptProject[],
  promptVersions: PromptVersion[],
  models: ModelRecord[],
  providerLogos: Record<ProviderLogoKey, string> = {
    openai: '',
    openai_darkmode: '',
    google: '',
    xai: '',
  },
  /** Stored-image URL → data URI. Images live behind the session-gated
   * `/api/images` route, so the report has to carry its own copy to
   * survive being opened offline or off-origin. */
  inlinedImages: Record<string, string> = {},
  /** The report is a standalone file, so it bakes in whichever theme
   * PromptLab is showing rather than following the reader's OS. */
  theme: 'dark' | 'light' = 'dark',
): string {
  function imageSrc(source: string) {
    return inlinedImages[source] ?? source;
  }

  /** Inline a provider mark for the given model id. Returns empty string
   * when the model can't be resolved or its provider doesn't ship a
   * logo asset. For OpenAI we use the dark-mode (white) mark since the
   * report body sits on the dark `--bg` panel. */
  function providerMarkHtml(modelId: string | undefined): string {
    if (!modelId) return '';
    const model = getModel(modelId);
    if (!model) return '';
    const key: ProviderLogoKey | null =
      model.provider === 'openai'
        ? 'openai_darkmode'
        : model.provider === 'gemini'
        ? 'google'
        : model.provider === 'xai'
        ? 'xai'
        : null;
    if (!key) return '';
    const src = providerLogos[key];
    if (!src) return '';
    // Google mark optical-size correction — same reason as the live UI.
    const sizeClass = key === 'google' ? ' provider-mark-google' : '';
    return `<img class="provider-mark${sizeClass}" src="${src}" alt="${model.provider}" />`;
  }

  function getPromptLabel(id: string) {
    const version = promptVersions.find((entry) => entry.id === id);
    if (!version) return 'Unknown Prompt';
    const project = promptProjects.find((entry) => entry.id === version.projectId);
    return `${project?.name ?? 'Unknown Project'} · v${version.version}`;
  }

  function getModel(id: string) {
    return models.find((entry) => entry.id === id);
  }

  function getAsset(id: string) {
    return resolveAssetEntry(assets, id);
  }

  function getAssetName(id?: string) {
    return resolveAssetEntry(assets, id)?.name;
  }

  function getRowLabels(run: BatchRun) {
    const rowsMap = new Map<string, { id: string; label: string; assetId?: string; userInput?: string }>();

    run.results.forEach((result) => {
      const rowId = buildRowId(result.assetId, result.userInput);
      if (!rowsMap.has(rowId)) {
        rowsMap.set(rowId, {
          id: rowId,
          label: result.userInput || getAssetName(result.assetId) || SYSTEM_PROMPT_ONLY_ROW_LABEL,
          assetId: result.assetId,
          userInput: result.userInput,
        });
      }
    });

    if (rowsMap.size === 0) {
      const assetIds = run.scenario.assetIds && run.scenario.assetIds.length > 0
        ? run.scenario.assetIds
        : (run.scenario.assetId ? [run.scenario.assetId] : [undefined]);

      const userInputs = run.scenario.userInput
        ? run.scenario.userInput.split(' | ').map((val) => val.trim()).filter(Boolean)
        : [undefined];

      assetIds.forEach((assetId) => {
        userInputs.forEach((userInput) => {
          const id = buildRowId(assetId, userInput);
          if (id !== SYSTEM_PROMPT_ONLY_ROW_ID) {
            rowsMap.set(id, {
              id,
              label: userInput || getAssetName(assetId) || SYSTEM_PROMPT_ONLY_ROW_LABEL,
              assetId,
              userInput,
            });
          }
        });
      });
    }

    if (rowsMap.size === 0) {
      return [{ id: SYSTEM_PROMPT_ONLY_ROW_ID, label: SYSTEM_PROMPT_ONLY_ROW_LABEL }];
    }

    return [...rowsMap.values()];
  }

  function buildRunTables(run: BatchRun): BatchTable[] {
    const promptIds =
      run.scenario.promptIds && run.scenario.promptIds.length > 0
        ? run.scenario.promptIds
        : [...new Set(run.results.map((result) => result.promptId))];
    const modelIds =
      run.scenario.modelIds && run.scenario.modelIds.length > 0
        ? run.scenario.modelIds
        : [...new Set(run.results.map((result) => result.modelId))];
    const rows = getRowLabels(run);

    const promptColumns = promptIds.map((id) => ({ id, label: getPromptLabel(id) }));
    const modelColumns = modelIds.map((id) => ({
      id,
      label: formatModelLabel(getModel(id), run.scenario.thinkingLevel),
      modelId: id,
    }));
    const usePromptColumns = promptColumns.length > 1 || modelColumns.length <= 1;

    // Single-prompt × multi-model runs used to read "Results" — replace
    // with the prompt's version ("Prompt vN") so the matrix header tells
    // the reader what's being compared across models.
    const singlePromptVersion =
      promptColumns.length === 1
        ? promptVersions.find((entry) => entry.id === promptColumns[0].id)?.version
        : undefined;

    const tableConfigs: Array<{
      key: string;
      title: string;
      titleModelId?: string;
      scopeModelId?: string;
      columns: Array<{ id: string; label: string; modelId?: string }>;
    }> =
      promptColumns.length > 1 && modelColumns.length > 1
        ? modelColumns.map((modelColumn) => ({
            key: modelColumn.id,
            title: modelColumn.label,
            titleModelId: modelColumn.id,
            scopeModelId: modelColumn.id,
            columns: promptColumns,
          }))
        : [
            {
              key: 'default',
              title:
                modelColumns.length > 1 && promptColumns.length === 1
                  ? singlePromptVersion !== undefined
                    ? `Prompt v${singlePromptVersion}`
                    : promptColumns[0]?.label ?? 'Results'
                  : modelColumns[0]?.label ?? 'Results',
              titleModelId: modelColumns.length === 1 ? modelColumns[0]?.id : undefined,
              scopeModelId: undefined,
              columns: usePromptColumns ? promptColumns : modelColumns,
            },
          ];

    return tableConfigs.map((config) => {
      const cells = new Map<string, BatchTableCell>();

      run.results
        .filter((result) => (config.scopeModelId ? result.modelId === config.scopeModelId : true))
        .forEach((result) => {
          const rowId = buildRowId(result.assetId, result.userInput);
          const columnId = usePromptColumns ? result.promptId : result.modelId;
          const key = buildCellKey(rowId, columnId);
          const existing = cells.get(key);

          if (existing) {
            existing.results.push(result);
            return;
          }

          cells.set(key, {
            rowId,
            columnId,
            results: [result],
          });
        });

      return {
        key: config.key,
        title: config.title,
        titleModelId: config.titleModelId,
        columns: config.columns,
        rows,
        cells,
      };
    });
  }

  const tables = buildRunTables(run);
  const dateStr = format(new Date(run.createdAt), 'MMM d, yyyy · HH:mm');

  let tablesHtml = '';
  tables.forEach((table) => {
    const gridCols = `260px repeat(${table.columns.length}, minmax(180px, 1fr))`;
    
    let headerRowCells = '';
    const hasImages = run.scenario.assetIds && run.scenario.assetIds.length > 0;
    const hasTexts = run.scenario.userInput && run.scenario.userInput.trim().length > 0;
    const headerLabel = hasImages && hasTexts ? 'Inputs' : hasImages ? 'Image References' : 'Text Inputs';
    headerRowCells += `<div class="cell cell-th">${headerLabel}</div>`;
    table.columns.forEach((column) => {
      const mark = providerMarkHtml(column.modelId);
      headerRowCells += `<div class="cell cell-th">${mark}${column.label}</div>`;
    });

    let bodyRows = '';
    table.rows.forEach((row) => {
      let labelContentHtml = '';
      if (row.id === SYSTEM_PROMPT_ONLY_ROW_ID) {
        labelContentHtml = `<span style="font-style: italic; color: var(--text-dim);">${SYSTEM_PROMPT_ONLY_ROW_LABEL}</span>`;
      } else {
        const asset = row.assetId ? getAsset(row.assetId) : undefined;
        if (asset) {
          labelContentHtml += `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <img class="input-thumb" src="${imageSrc(asset.source)}" alt="${asset.name}" title="${asset.name}" />
              ${row.userInput ? `<div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">${row.userInput}</div>` : ''}
            </div>
          `;
        } else if (row.userInput) {
          labelContentHtml += `<div style="color: var(--text);">${row.userInput}</div>`;
        } else {
          labelContentHtml += `<span style="color: var(--text-dim); font-style: italic;">No Inputs</span>`;
        }
      }

      bodyRows += `<div class="cell cell-label">${labelContentHtml}</div>`;

      table.columns.forEach((column) => {
        const cellData = table.cells.get(buildCellKey(row.id, column.id));
        let cellContentHtml = '';
        if (!cellData || cellData.results.length === 0) {
          cellContentHtml = `<div class="output-text" style="color: var(--text-dim); font-style: italic;">No Result</div>`;
        } else {
          cellData.results.forEach((result) => {
            let outputHtml = '';
            if (isImageOutput(result.outputImage)) {
              outputHtml = `
                <div style="margin-bottom: 8px;">
                  <a href="${imageSrc(result.outputImage!)}" download="output-image.png" style="display: block;">
                    <img class="output-image" src="${imageSrc(result.outputImage!)}" alt="Output Image" />
                  </a>
                </div>
              `;
            } else if (result.output) {
              const jsonObject = tryParseJSON(result.output);
              if (jsonObject) {
                outputHtml = `<pre class="output-json">${JSON.stringify(jsonObject, null, 2)}</pre>`;
              } else {
                outputHtml = `<div class="output-text">${result.output}</div>`;
              }
            } else {
              outputHtml = `<div class="output-text" style="color: var(--text-dim); font-style: italic;">Empty Output</div>`;
            }

            const latencyHtml = result.latencyMs ? `<span>${result.latencyMs.toLocaleString()} ms</span>` : '';
            // Score badge intentionally omitted from the HTML report — it
            // was a placeholder length-based heuristic, not a real quality
            // measurement, so showing it on a shareable artifact was
            // misleading. Add a real evaluator before resurfacing this.

            cellContentHtml += `
              <div class="result-box" style="margin-bottom: 12px;">
                ${outputHtml}
                <div class="meta-metrics">
                  ${latencyHtml}
                </div>
              </div>
            `;
          });
        }
        bodyRows += `<div class="cell cell-content">${cellContentHtml}</div>`;
      });
    });

    const titleMark = providerMarkHtml(table.titleModelId);
    tablesHtml += `
      <div class="table-container" style="margin-bottom: 32px;">
        <h2 class="matrix-title">${titleMark}${table.title}</h2>
        <div class="grid" style="grid-template-columns: ${gridCols};">
          ${headerRowCells}
          ${bodyRows}
        </div>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${run.name} - Batch Test Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      ${
        theme === 'light'
          ? `--bg: #f6f7f8;
      --bg-elev: #ffffff;
      --bg-elev-2: #fafbfc;
      --text: #18181b;
      --text-muted: #52525b;
      --text-dim: #71717a;
      --hairline: rgba(0, 0, 0, 0.10);
      --output-code: #18181b;
      --output-code-bg: rgba(0, 0, 0, 0.04);`
          : `--bg: #09090b;
      --bg-elev: #18181b;
      --bg-elev-2: #27272a;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --hairline: rgba(255, 255, 255, 0.08);
      --output-code: oklch(0.82 0.08 195);
      --output-code-bg: rgba(0, 0, 0, 0.25);`
      }
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'Fira Code', monospace;
      --ai: #8b5cf6;
      --green: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      padding: 40px 24px;
      line-height: 1.5;
    }
    .container {
      max-width: 1440px;
      margin: 0 auto;
    }
    .header {
      margin-bottom: 32px;
      border-bottom: 1px solid var(--hairline);
      padding-bottom: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 99px;
      border: 1px solid var(--hairline);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    .pill.ok {
      color: var(--green);
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.2);
    }
    .matrix-section {
      background: var(--bg-elev);
      border: 1px solid var(--hairline);
      border-radius: 12px;
      padding: 24px;
    }
    .matrix-title {
      font-family: var(--font-mono);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text);
      margin-bottom: 0;
      padding: 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      /* Sticky as well, stacked above the column-header row. Without
       * this the matrix-title scrolls behind the sticky .cell-th band
       * and the upper half of the title text gets clipped. Background
       * matches the surrounding .matrix-section panel (var(--bg-elev))
       * so the sticky band blends into the panel instead of showing
       * up as a darker stripe over it. */
      position: sticky;
      top: 0;
      background: var(--bg-elev);
      z-index: 11;
    }
    .matrix-title::after {
      content: "";
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--hairline) 0%, transparent 90%);
    }
    .grid {
      display: grid;
      column-gap: 16px;
      row-gap: 16px;
    }
    .cell {
      min-width: 0;
    }
    .cell-th {
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      padding: 12px 4px 8px;
      border-bottom: 1px solid var(--hairline);
      /* Sticky column header stacks just below the also-sticky
       * matrix-title. top matches the matrix-title's computed height
       * so the two pin without overlapping. Background matches the
       * surrounding panel (var(--bg-elev)) so the sticky band blends
       * into the matrix-section panel rather than showing up as a
       * darker stripe over it. */
      position: sticky;
      top: 42px;
      background: var(--bg-elev);
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .provider-mark {
      width: 14px;
      height: 14px;
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }
    .cell-th .provider-mark {
      width: 12px;
      height: 12px;
    }
    /* Google mark optical-size correction — its asset has minimal
     * inner padding so it visually outweighs the other marks at the
     * shared box size. */
    .provider-mark-google {
      width: 12px;
      height: 12px;
    }
    .cell-th .provider-mark-google {
      width: 10px;
      height: 10px;
    }
    .cell-label {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text);
      display: flex;
      align-items: flex-start;
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      padding-top: 12px;
    }
    .input-thumb {
      width: 150px;
      height: 150px;
      border-radius: 8px;
      border: 1px solid var(--hairline);
      object-fit: cover;
      background: var(--bg-elev-2);
    }
    .cell-content {
      border-top: 1px solid rgba(255, 255, 255, 0.03);
      padding-top: 12px;
    }
    .output-text {
      font-size: 13px;
      color: var(--text-muted);
      white-space: pre-wrap;
    }
    .output-json {
      background: var(--output-code-bg);
      border: 1px solid var(--hairline);
      border-radius: 6px;
      padding: 10px;
      font-family: var(--font-mono);
      font-size: 11px;
      overflow-x: auto;
      max-height: 280px;
      color: var(--output-code);
      white-space: pre-wrap;
      word-break: break-all;
      /* Transparent scrollbar so the rounded panel reads as a clean
       * card instead of a chunky light-gray bar on the right edge.
       * Firefox uses scrollbar-color; WebKit/Chromium use the
       * ::-webkit-scrollbar pseudo-elements below. */
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    .output-json:hover {
      scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
    }
    .output-json::-webkit-scrollbar {
      width: 6px;
      height: 6px;
      background: transparent;
    }
    .output-json::-webkit-scrollbar-track {
      background: transparent;
    }
    .output-json::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 3px;
      transition: background 0.15s ease;
    }
    .output-json:hover::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.18);
    }
    .output-json::-webkit-scrollbar-corner {
      background: transparent;
    }
    .output-image {
      max-width: 100%;
      border-radius: 8px;
      border: 1px solid var(--hairline);
      display: block;
      transition: transform 0.15s ease;
      background: var(--bg-elev-2);
    }
    .output-image:hover {
      transform: scale(1.02);
    }
    .result-box {
      border: 1px solid var(--hairline);
      background: rgba(255, 255, 255, 0.01);
      border-radius: 8px;
      padding: 12px;
    }
    .meta-metrics {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      font-family: var(--font-mono);
      font-size: 9.5px;
      color: var(--text-dim);
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="title">${run.name}</h1>
      <div class="meta">
        <span>${dateStr}</span>
        <!-- The downloaded report is a frozen artifact of a finished run,
             so always read "Completed" — surfacing "running" / "failed"
             on a static HTML file the user is about to share would be
             misleading. -->
        <span class="pill ok">Completed</span>
        <span>${run.results.length} results</span>
      </div>
    </header>

    <main class="matrix-section">
      ${tablesHtml}
    </main>
  </div>
</body>
</html>`;
}

function BatchResultCell({
  results,
  isRunning,
  placeholderCount,
  stickerize,
  onPreviewImage,
}: {
  results: TestResult[];
  isRunning: boolean;
  placeholderCount: number;
  stickerize: boolean;
  onPreviewImage: (imageSrc: string) => void;
}) {
  if (results.length === 0) {
    if (isRunning) {
      // Loading state from the Claude Design PromptLab.html mockup:
      // a square (aspect-ratio 1/1) thumb panel with a violet
      // shimmer sweeping across it. The `.batch-thumb.loading`
      // keyframes live in styles.css (shimmer-thumb, 1.6 s ease).
      // One thumb per pending result — stacked vertically when a
      // single matrix cell expects multiple results (e.g. when the
      // run targets multiple image-reference assets).
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%',
          }}
        >
          {Array.from({ length: Math.max(1, placeholderCount) }).map((_, index) => (
            <div key={index} className="batch-thumb loading" />
          ))}
        </div>
      );
    }

    return (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          textAlign: 'center',
          width: '100%',
        }}
      >
        No result
      </div>
    );
  }

  return (
    <div className="batch-table-cell-stack">
      {results.map((result) => (
        <div key={result.id} className="batch-table-result">
          {isImageOutput(result.outputImage) ? (
            <div className={`batch-table-image-wrap${stickerize ? ' is-stickerized' : ''}`}>
              <button
                type="button"
                className="batch-table-image-preview-button"
                onClick={() => onPreviewImage(result.outputImage!)}
                aria-label="Preview generated image"
              >
                <img
                  className="batch-table-output-image"
                  src={result.outputImage}
                  alt="Generated output"
                />
              </button>
            </div>
          ) : (
            <div className="batch-table-output-fallback" style={{ width: '100%' }}>
              {(() => {
                const jsonObject = tryParseJSON(result.output);
                if (jsonObject) {
                  return (
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        margin: 0,
                        padding: '8px',
                        background: 'var(--output-code-bg)',
                        border: '1px solid var(--hairline)',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: 'var(--output-code)',
                        textAlign: 'left',
                        width: '100%',
                        // Matches the downloadable report: long outputs
                        // scroll inside the cell instead of stretching
                        // the whole row.
                        maxHeight: 280,
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(jsonObject, null, 2)}
                    </pre>
                  );
                }
                return (
                  <p style={{ maxHeight: 280, overflow: 'auto', textAlign: 'left', width: '100%' }}>
                    {result.output || 'No image output returned.'}
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// The custom MultiSelectDropdown was lifted to
// `src/components/multi-select-dropdown.tsx` so the visual matches the
// Claude Design PromptLab.html exactly — sticky search input, mono
// group headers, checkbox marks. Same external API (options +
// selectedIds + onToggle) so the call sites below didn't change shape.

export function BatchTestPage() {
  const { history, promptProjects, promptVersions, assets, models, providerKeys, removeRun, createRun, updateRun } =
    useAppContext();
  const [composerOpen, setComposerOpen] = useState(false);
  const location = useLocation();
  const expandOnArrival = (location.state as { expandRunId?: string } | null)?.expandRunId;
  const [expandedTests, setExpandedTests] = useState<Set<string>>(
    () => new Set(expandOnArrival ? [expandOnArrival] : []),
  );
  const [openRunMenuId, setOpenRunMenuId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!openRunMenuId) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.history-card-menu')) {
        return;
      }

      setOpenRunMenuId(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openRunMenuId]);

  useEffect(() => {
    if (!previewImageSrc) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewImageSrc(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewImageSrc]);

  function openComposer() {
    setComposerOpen(true);
  }

  function toggleExpand(id: string) {
    setExpandedTests((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRemoveRun(id: string) {
    removeRun(id);
    setOpenRunMenuId(null);
    setExpandedTests((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function handleDownloadRun(run: BatchRun) {
    // Inline provider PNGs as data URIs so the downloaded HTML works
    // offline / on any origin — the live UI's /assets/* paths would
    // 404 once the file is opened outside the dev server.
    const providerLogos = await loadProviderLogoDataUris();
    // Same reason as the provider marks: outputs and reference images
    // are session-gated URLs, so the report gets its own inline copies.
    const storedSources = [
      ...new Set(
        [
          ...run.results.map((result) => result.outputImage),
          ...run.results.map((result) => getAsset(result.assetId)?.source),
        ].filter((source): source is string => Boolean(source)),
      ),
    ];
    const inlinedImages = Object.fromEntries(
      await Promise.all(storedSources.map(async (source) => [source, await toDataUrl(source)] as const)),
    );
    const htmlContent = generateBatchHtmlReport(
      run,
      assets,
      promptProjects,
      promptVersions,
      models,
      providerLogos,
      inlinedImages,
      resolveTheme(readThemeMode()),
    );
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', downloadUrl);
    const sanitizedName = run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadAnchor.setAttribute('download', `${sanitizedName}-batch-report.html`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  function getPromptLabel(id: string) {
    const version = promptVersions.find((entry) => entry.id === id);
    if (!version) return 'Unknown Prompt';
    const project = promptProjects.find((entry) => entry.id === version.projectId);
    return `${project?.name ?? 'Unknown Project'} · v${version.version}`;
  }

  function getModel(id: string) {
    return models.find((entry) => entry.id === id);
  }

  function getAsset(id?: string) {
    return resolveAssetEntry(assets, id);
  }

  function getAssetName(id?: string) {
    return getAsset(id)?.name;
  }

  function getRowLabels(run: BatchRun) {
    const rowsMap = new Map<string, { id: string; label: string; assetId?: string; userInput?: string }>();

    // 1. Build from results if they exist
    run.results.forEach((result) => {
      const rowId = buildRowId(result.assetId, result.userInput);
      if (!rowsMap.has(rowId)) {
        rowsMap.set(rowId, {
          id: rowId,
          label: result.userInput || getAssetName(result.assetId) || SYSTEM_PROMPT_ONLY_ROW_LABEL,
          assetId: result.assetId,
          userInput: result.userInput,
        });
      }
    });

    // 2. If no results yet, build from scenario configuration
    if (rowsMap.size === 0) {
      const assetIds = run.scenario.assetIds && run.scenario.assetIds.length > 0
        ? run.scenario.assetIds
        : (run.scenario.assetId ? [run.scenario.assetId] : [undefined]);

      const userInputs = run.scenario.userInput
        ? run.scenario.userInput.split(' | ').map((val) => val.trim()).filter(Boolean)
        : [undefined];

      assetIds.forEach((assetId) => {
        userInputs.forEach((userInput) => {
          const rowId = buildRowId(assetId, userInput);
          if (rowId !== SYSTEM_PROMPT_ONLY_ROW_ID) {
            rowsMap.set(rowId, {
              id: rowId,
              label: userInput || getAssetName(assetId) || SYSTEM_PROMPT_ONLY_ROW_LABEL,
              assetId,
              userInput,
            });
          }
        });
      });
    }

    if (rowsMap.size === 0) {
      return [{ id: SYSTEM_PROMPT_ONLY_ROW_ID, label: SYSTEM_PROMPT_ONLY_ROW_LABEL }];
    }

    return [...rowsMap.values()];
  }

  function buildRunTables(run: BatchRun): BatchTable[] {
    const promptIds =
      run.scenario.promptIds && run.scenario.promptIds.length > 0
        ? run.scenario.promptIds
        : [...new Set(run.results.map((result) => result.promptId))];
    const modelIds =
      run.scenario.modelIds && run.scenario.modelIds.length > 0
        ? run.scenario.modelIds
        : [...new Set(run.results.map((result) => result.modelId))];
    const rows = getRowLabels(run);

    const promptColumns = promptIds.map((id) => ({ id, label: getPromptLabel(id) }));
    const modelColumns = modelIds.map((id) => ({
      id,
      label: formatModelLabel(getModel(id), run.scenario.thinkingLevel),
      modelId: id,
    }));
    const usePromptColumns = promptColumns.length > 1 || modelColumns.length <= 1;

    // Single-prompt × multi-model runs read "Prompt vN" — the prompt
    // version is what's being compared across models in that matrix.
    const singlePromptVersion =
      promptColumns.length === 1
        ? promptVersions.find((entry) => entry.id === promptColumns[0].id)?.version
        : undefined;

    const tableConfigs: Array<{
      key: string;
      title: string;
      titleModelId?: string;
      scopeModelId?: string;
      columns: Array<{ id: string; label: string; modelId?: string }>;
    }> =
      promptColumns.length > 1 && modelColumns.length > 1
        ? modelColumns.map((modelColumn) => ({
            key: modelColumn.id,
            title: modelColumn.label,
            titleModelId: modelColumn.id,
            scopeModelId: modelColumn.id,
            columns: promptColumns,
          }))
        : [
            {
              key: 'default',
              title:
                modelColumns.length > 1 && promptColumns.length === 1
                  ? singlePromptVersion !== undefined
                    ? `Prompt v${singlePromptVersion}`
                    : promptColumns[0]?.label ?? 'Results'
                  : modelColumns[0]?.label ?? 'Results',
              // The single-table fallback only carries a model in its
              // title when there's exactly one model — multi-model
              // single-prompt runs use the prompt version as title.
              titleModelId: modelColumns.length === 1 ? modelColumns[0]?.id : undefined,
              scopeModelId: undefined,
              columns: usePromptColumns ? promptColumns : modelColumns,
            },
          ];

    return tableConfigs.map((config) => {
      const cells = new Map<string, BatchTableCell>();

      run.results
        .filter((result) => (config.scopeModelId ? result.modelId === config.scopeModelId : true))
        .forEach((result) => {
          const rowId = buildRowId(result.assetId, result.userInput);
          const columnId = usePromptColumns ? result.promptId : result.modelId;
          const key = buildCellKey(rowId, columnId);
          const existing = cells.get(key);

          if (existing) {
            existing.results.push(result);
            return;
          }

          cells.set(key, {
            rowId,
            columnId,
            results: [result],
          });
        });

      return {
        key: config.key,
        title: config.title,
        titleModelId: config.titleModelId,
        columns: config.columns,
        rows,
        cells,
      };
    });
  }


  // Inject the new "New Batch Test" CTA into the layout topbar.
  useEffect(() => {
    setPageChrome({
      topbarRight: (
        <button type="button" className="btn btn-primary" onClick={openComposer}>
          <IconBox><IconPlay /></IconBox>
          New Batch Test
        </button>
      ),
    });
    return () => setPageChrome({});
  }, []);

  return (
    <>
      <ConfirmDialog
        open={pendingRemoval !== null}
        noun="batch job"
        onConfirm={() => {
          if (pendingRemoval) handleRemoveRun(pendingRemoval.id);
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
      <div className="body">
        <div className="batch-list">
          {history.length === 0 ? (
            <div className="hero" style={{ padding: 32, textAlign: 'center' }}>
              <div className="page-sub">
                No batch tests yet — hit "New Batch Test" to compare prompts and models.
              </div>
            </div>
          ) : (
            history.map((run) => {
              const isOpen = expandedTests.has(run.id);
              const tables = isOpen ? buildRunTables(run) : [];
              return (
                <div key={run.id} className={`batch-job ${isOpen ? 'open' : ''}`}>
                  <div className="batch-head" onClick={() => toggleExpand(run.id)}>
                    <div className="project-chev">
                      <IconBox size={12}><IconChev /></IconBox>
                    </div>
                    <div className="batch-titlewrap">
                      <div className="batch-title">{run.name}</div>
                      <div className="batch-sub">
                        <span className="batch-stamp">
                          {format(new Date(run.createdAt), 'MMM d, yyyy · HH:mm')}
                        </span>
                        {run.status === 'running' ? (
                          <span className="batch-pill running">
                            <span className="spin"><IconBox size={11}><IconSpinner /></IconBox></span>
                            In progress
                          </span>
                        ) : run.status === 'failed' ? (
                          <span className="batch-pill" style={{ color: 'var(--rose)' }}>
                            <CircleAlert size={11} />
                            Failed
                          </span>
                        ) : (
                          <span className="batch-pill ok">
                            <IconBox size={11}><IconCheck /></IconBox>
                            Complete
                          </span>
                        )}
                        <span className="batch-pill muted">{run.results.length} results</span>
                      </div>
                    </div>
                    <div className="batch-actions" style={{ display: 'flex', gap: 6 }} onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="icon-btn naked"
                        aria-label="Download batch test results"
                        title="Download HTML Report"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownloadRun(run);
                        }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn naked"
                        aria-label="Delete batch test"
                        title="Remove"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingRemoval({ id: run.id, name: run.name });
                        }}
                      >
                        <IconBox size={14}><IconTrash /></IconBox>
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="batch-body">
                      {tables.map((table) => (
                        <div className="batch-model" key={table.key}>
                          <div className="batch-model-head">
                            {table.titleModelId && (
                              <ProviderMarkInline model={getModel(table.titleModelId)} />
                            )}
                            <span className="batch-model-name">{table.title}</span>
                            <span className="batch-model-bar" />
                          </div>
                          <div
                            className="batch-matrix"
                            style={{
                              gridTemplateColumns: `260px repeat(${table.columns.length}, minmax(160px, 1fr))`,
                            }}
                          >
                            {(() => {
                              const hasImages = run.scenario.assetIds && run.scenario.assetIds.length > 0;
                              const hasTexts = run.scenario.userInput && run.scenario.userInput.trim().length > 0;
                              const headerLabel = hasImages && hasTexts ? 'Inputs' : hasImages ? 'Image References' : 'Text Inputs';
                              return <div className="batch-cell batch-cell-th">{headerLabel}</div>;
                            })()}
                            {table.columns.map((column) => (
                              <div key={column.id} className="batch-cell batch-cell-th">
                                {column.modelId && (
                                  <ProviderMarkInline model={getModel(column.modelId)} />
                                )}
                                {column.label}
                              </div>
                            ))}
                            {table.rows.map((row) => {
                              const asset = row.assetId ? getAsset(row.assetId) : undefined;
                              return (
                                <Fragment key={row.id}>
                                  <div className="batch-cell batch-cell-label" style={{ gap: 12 }}>
                                    {asset && (
                                      <div
                                        style={{
                                          width: 120,
                                          height: 120,
                                          borderRadius: 6,
                                          background: 'var(--bg-elev-3)',
                                          border: '1px solid var(--hairline)',
                                          backgroundImage: isRenderableImage(asset.source) ? `url(${asset.source})` : undefined,
                                          backgroundSize: 'cover',
                                          backgroundPosition: 'center',
                                          flexShrink: 0,
                                          cursor: 'pointer',
                                        }}
                                        title={asset.name}
                                        onClick={() => setPreviewImageSrc(asset.source)}
                                      />
                                    )}
                                    {(!asset || row.userInput) && (
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.userInput || row.label}
                                      </span>
                                    )}
                                  </div>
                                  {table.columns.map((column) => {
                                    const cell = table.cells.get(buildCellKey(row.id, column.id));
                                    return (
                                      <div key={column.id} className="batch-cell batch-cell-img">
                                        <BatchResultCell
                                          results={cell?.results ?? []}
                                          isRunning={run.status === 'running'}
                                          placeholderCount={
                                            run.scenario.assetIds &&
                                            run.scenario.assetIds.length > 0
                                              ? run.scenario.assetIds.length
                                              : 1
                                          }
                                          stickerize={Boolean(run.scenario.stickerize)}
                                          onPreviewImage={setPreviewImageSrc}
                                        />
                                      </div>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <BatchComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onRunCreated={(runId) => setExpandedTests((current) => new Set([runId, ...current]))}
      />

      {previewImageSrc ? (
        <div className="composer-backdrop" onClick={() => setPreviewImageSrc(null)}>
          <section
            className="surface-card image-preview-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-preview-close"
              onClick={() => setPreviewImageSrc(null)}
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>
            <img
              className="image-preview-sheet-image"
              src={previewImageSrc}
              alt="Generated output preview"
            />
          </section>
        </div>
      ) : null}
    </>
  );
}

/**
 * The New Batch Test modal, split out of `BatchTestPage` so the Prompts
 * tab can launch a run without navigating first. It owns every field in
 * the form plus the fan-out in `runBatch`; the host page only says when
 * it is open and what to do once a run has been created.
 *
 * Kept in this module rather than `components/` so the module-level
 * helpers it leans on (executeScenario's request shapes, toggleSelection,
 * the thinking-level options) stay in scope for both consumers.
 */
export function BatchComposer({
  open,
  onClose,
  initialPromptIds,
  onRunCreated,
  onLaunched,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-selected prompt versions, e.g. every version of one project. */
  initialPromptIds?: string[];
  /** Fired with the new run's id as soon as it is queued. */
  onRunCreated?: (runId: string) => void;
  /** Fired after a run starts, with its id — the Prompts tab uses it to
   * switch tabs and expand the new job on arrival. */
  onLaunched?: (runId: string) => void;
}) {
  const { promptProjects, promptVersions, assets, models, providerKeys, createRun, updateRun } =
    useAppContext();
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedImageReferenceIds, setSelectedImageReferenceIds] = useState<string[]>([]);
  const [selectedTextInputAssetIds, setSelectedTextInputAssetIds] = useState<string[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [stickerize, setStickerize] = useState(false);
  // Default to 'dynamic' — each provider's silent default kicks in, which
  // is roughly what every run before this knob existed used. Users can
  // pin a specific effort with the dropdown.
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('dynamic');
  const [thinkingDropdownOpen, setThinkingDropdownOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  function getModel(id: string) {
    return models.find((model) => model.id === id);
  }

  // Re-seed the selection each time the modal is opened from a project.
  useEffect(() => {
    if (open && initialPromptIds && initialPromptIds.length > 0) {
      setSelectedPromptIds(initialPromptIds);
    }
  }, [open, initialPromptIds]);

  const readyModels = useMemo(
    () => models.filter((model) => model.status === 'ready' && providerKeys[model.provider]?.hasKey),
    [models, providerKeys],
  );
  const orderPromptSelection = (ids: string[]) => {
    const byId = new Map(versionOptions.map((version) => [version.id, version]));
    const projectOrder = new Map<string, number>();
    ids.forEach((id) => {
      const projectId = byId.get(id)?.projectId ?? id;
      if (!projectOrder.has(projectId)) projectOrder.set(projectId, projectOrder.size);
    });

    return [...ids].sort((left, right) => {
      const a = byId.get(left);
      const b = byId.get(right);
      const aProject = projectOrder.get(a?.projectId ?? left) ?? 0;
      const bProject = projectOrder.get(b?.projectId ?? right) ?? 0;
      if (aProject !== bProject) return aProject - bProject;
      return (a?.version ?? 0) - (b?.version ?? 0);
    });
  };

  const versionOptions = useMemo(() => {
    // Projects stay ordered by most recent activity, but versions read
    // v1 → vN inside each one; sorting the flat list by `updatedAt`
    // interleaved projects and put the newest version on top.
    const projectRecency = new Map<string, number>();
    promptVersions.forEach((version) => {
      const stamp = new Date(version.updatedAt).getTime();
      projectRecency.set(version.projectId, Math.max(projectRecency.get(version.projectId) ?? 0, stamp));
    });

    return promptVersions
      .map((version) => {
        const project = promptProjects.find((entry) => entry.id === version.projectId);
        return {
          ...version,
          projectName: project?.name ?? 'Unknown Project',
        };
      })
      .sort((left, right) => {
        if (left.projectId !== right.projectId) {
          return (projectRecency.get(right.projectId) ?? 0) - (projectRecency.get(left.projectId) ?? 0);
        }
        return left.version - right.version;
      });
  }, [promptProjects, promptVersions]);
  const imageReferenceAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'image-reference'),
    [assets],
  );
  const textInputAssets = useMemo(
    () => assets.filter((asset) => asset.kind === 'text-inputs'),
    [assets],
  );

  // Prompt dropdown options — grouped by project name. The design uses
  // mono uppercase project names as section headers; we lowercase to
  // match the design's `dropdown-group-head` styling rule.
  const promptDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      versionOptions.map((prompt) => ({
        id: prompt.id,
        label: `v${prompt.version} · ${prompt.systemPrompt.slice(0, 64)}${
          prompt.systemPrompt.length > 64 ? '…' : ''
        }`,
        searchText: `${prompt.projectName.toLowerCase()} v${prompt.version} ${prompt.systemPrompt.toLowerCase()}`,
        group: prompt.projectId,
      })),
    [versionOptions],
  );

  // Project-name groups for the prompt dropdown.
  const promptGroups = useMemo<DropdownGroup[]>(
    () =>
      versionOptions
        .map((v) => ({ key: v.projectId, label: v.projectName }))
        .filter(
          (g, i, arr) => arr.findIndex((x) => x.key === g.key) === i,
        ),
    [versionOptions],
  );

  const imageReferenceDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      imageReferenceAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        searchText: asset.name.toLowerCase(),
      })),
    [imageReferenceAssets],
  );

  const textInputDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      textInputAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        searchText: asset.name.toLowerCase(),
      })),
    [textInputAssets],
  );

  // Model dropdown options — grouped by inferred type (text / image /
  // video). Type is inferred from the API model id since the catalog
  // doesn't carry an explicit `type` field.
  const modelDropdownOptions = useMemo<DropdownOption[]>(
    () =>
      readyModels.map((model) => {
        const id = model.apiModel.toLowerCase();
        const type = id.includes('image')
          ? 'image'
          : id.includes('sora') || id.includes('veo') || id.includes('video')
            ? 'video'
            : 'text';
        return {
          id: model.id,
          label: model.name,
          searchText: `${model.name.toLowerCase()} ${getProviderLabel(model.provider).toLowerCase()}`,
          group: type,
          // Reuse the dark-mode-aware ProviderMarkInline so the dropdown
          // icon swaps to openai_darkmode.png in dark theme — the older
          // getProviderIconSrc returned a single static asset that read
          // as a dark blob on the dark dropdown background.
          icon: <ProviderMarkInline model={model} />,
        };
      }),
    [readyModels],
  );

  useEffect(() => {
    setSelectedModelIds((current) => current.filter((id) => readyModels.some((model) => model.id === id)));
  }, [readyModels]);

  function closeComposer() {
    onClose();
    setErrorMessage('');
    // Close any open dropdown panels the user left expanded — the
    // selected value itself is preserved so reopening the modal keeps
    // the user's last pick.
    setThinkingDropdownOpen(false);
  }

  async function executeScenario(
    prompt: PromptVersion,
    selectedModels: typeof models,
    asset: AssetRecord | undefined,
    userInput?: string,
    shouldStickerize = true,
  ) {
    // Fan out one /api/batch-run request per model rather than batching
    // them all into a single POST. The server-side handler used to
    // Promise.all over the model list, which meant a slow provider
    // (e.g. OpenAI image-gen) blocked the response until the request
    // timeout aborted the whole thing — taking a fast Gemini result
    // down with it. With per-model requests, each one's timeout /
    // error is independent: GPT can fail and Gemini
    // still surfaces its result.
    const singleModelRequest = async (model: typeof selectedModels[number]) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), BATCH_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch('/api/batch-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            asset,
            models: [model],
            userInput: userInput?.trim() ? userInput : undefined,
            stickerize: shouldStickerize,
            // Map the user's pick into the request body so the serverless
            // function can route it to each provider's thinking knob.
            // 'dynamic' is omitted (provider default kicks in).
            thinkingLevel: thinkingLevel !== 'dynamic' ? thinkingLevel : undefined,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as
          | { results: ApiResult[]; errors?: ApiError[] }
          | { error?: string; details?: string };

        if (!response.ok || !('results' in payload)) {
          const failurePayload = payload as { error?: string; details?: string };
          const message =
            failurePayload.error || failurePayload.details || 'Batch run failed.';
          return {
            results: [] as ApiResult[],
            errors: [{ modelId: model.id, message }],
          };
        }

        return payload as { results: ApiResult[]; errors?: ApiError[] };
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === 'AbortError'
            ? 'Batch job timed out before the provider returned a result.'
            : error instanceof Error
              ? error.message
              : 'Batch run failed for an unknown reason.';
        return {
          results: [] as ApiResult[],
          errors: [{ modelId: model.id, message }],
        };
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const perModelResponses = await Promise.all(selectedModels.map(singleModelRequest));
    const merged: { results: ApiResult[]; errors: ApiError[] } = { results: [], errors: [] };
    perModelResponses.forEach((entry) => {
      merged.results.push(...entry.results);
      if (entry.errors) merged.errors.push(...entry.errors);
    });
    return merged;
  }

  async function runBatch() {
    // Selection order, not list order — `selectedIds` is append-ordered
    // and the dropdown summary reads back the same way.
    const pickInSelectionOrder = <T extends { id: string }>(ids: string[], pool: T[]) =>
      ids.map((id) => pool.find((entry) => entry.id === id)).filter((entry): entry is T => Boolean(entry));

    const selectedPrompts = pickInSelectionOrder(selectedPromptIds, versionOptions);
    const selectedModels = pickInSelectionOrder(selectedModelIds, readyModels);
    // A grouped asset is a set of images: run every one of them, in
    // order, as its own row.
    const selectedImageReferences = pickInSelectionOrder(
      selectedImageReferenceIds,
      imageReferenceAssets,
    ).flatMap((asset) => expandImageAsset(asset));
    const selectedUserInputs = textInputAssets
      .filter((asset) => selectedTextInputAssetIds.includes(asset.id))
      .flatMap((asset) => parseTextInputs(asset.source));
    const scenarioUserInputs = selectedUserInputs.length > 0 ? selectedUserInputs : [undefined];

    if (selectedPrompts.length === 0 || selectedModels.length === 0) {
      setErrorMessage(
        readyModels.length === 0
          ? 'Add at least one provider API key in the Models view before running a batch test.'
          : 'Select at least one system prompt and model before running.',
      );
      return;
    }

    const expandedImageReferenceIds = selectedImageReferences.map((entry) => entry.id);

    const draftScenario = {
      promptId: selectedPrompts[0].id,
      promptIds: selectedPrompts.map((prompt) => prompt.id),
      assetIds: expandedImageReferenceIds.length > 0 ? expandedImageReferenceIds : undefined,
      assetId: expandedImageReferenceIds[0],
      userInputAssetIds: selectedTextInputAssetIds.length > 0 ? selectedTextInputAssetIds : undefined,
      modelIds: selectedModelIds,
      userInput: selectedUserInputs.length > 0 ? selectedUserInputs.join(' | ') : undefined,
      stickerize,
      // Persist the user's exact pick — including 'dynamic' — so the
      // results header can render "GPT-5.5, Dynamic thinking" rather
      // than falling back to the legacy inferThinkingLevel heuristic
      // (which guesses "High" for gpt-5* and would mislabel the run).
      // Older runs without a thinkingLevel field still flow through the
      // inference fallback in formatModelLabel.
      thinkingLevel,
    };
    // Run name is the prompt-project name(s) — no version, no timestamp.
    // Sorted unique projects so the title stays stable across re-runs.
    const projectNames = (() => {
      const names = selectedPrompts
        .map((prompt) => {
          const project = promptProjects.find((entry) => entry.id === prompt.projectId);
          return project?.name;
        })
        .filter((name): name is string => Boolean(name));
      return Array.from(new Set(names));
    })();
    const draftRunName =
      projectNames.length === 0
        ? 'Batch run'
        : projectNames.length === 1
          ? projectNames[0]
          : projectNames.join(', ');

    const draftRun = createRun({
      name: draftRunName,
      status: 'running',
      errorMessage: undefined,
      scenario: draftScenario,
      results: [],
    });

    setRunning(true);
    setErrorMessage('');
    closeComposer();
    onRunCreated?.(draftRun.id);
    // The Prompts tab switches to Batch Test at this point; the run
    // keeps streaming results into context either way.
    onLaunched?.(draftRun.id);

    try {
      const imageReferenceScenarios = selectedImageReferences.length > 0 ? selectedImageReferences : [undefined];
      const scenarioQueue = selectedPrompts.flatMap((prompt) =>
        imageReferenceScenarios.flatMap((imageReference) =>
          scenarioUserInputs.map((userInput) => ({
            prompt,
            imageReference,
            userInput,
          })),
        ),
      );
      const results: TestResult[] = [];
      const errors: string[] = [];

      await Promise.all(
        scenarioQueue.map(async ({ prompt, imageReference, userInput }) => {
          try {
            const apiPayload = await executeScenario(
              prompt,
              selectedModels,
              imageReference,
              userInput,
              stickerize,
            );

            const nextResults = apiPayload.results.map((result, index) => ({
              id: `result-${prompt.id}-${result.modelId}-${Date.now()}-${results.length + index}`,
              promptId: prompt.id,
              modelId: result.modelId,
              assetId: imageReference?.id,
              userInput,
              output: result.output,
              outputImage: result.outputImage,
              latencyMs: result.latencyMs,
              score: result.score,
            }));

            results.push(...nextResults);

            const errorResults =
              apiPayload.errors?.map((error, index) => ({
                id: `result-error-${prompt.id}-${error.modelId}-${Date.now()}-${results.length + nextResults.length + index}`,
                promptId: prompt.id,
                modelId: error.modelId,
                assetId: imageReference?.id,
                userInput,
                output: `Error: ${error.message}`,
                outputImage: undefined,
                latencyMs: 0,
                score: 0,
              })) ?? [];

            results.push(...errorResults);

            apiPayload.errors?.forEach((error) => {
              const model = getModel(error.modelId);
              errors.push(`${model?.name ?? 'Unknown Model'}: ${error.message}`);
            });

            const uniqueErrors = [...new Set(errors)];
            updateRun(draftRun.id, {
              status: 'running',
              errorMessage: uniqueErrors.length > 0 ? uniqueErrors.join(' | ') : undefined,
              results: [...results],
            });
          } catch (error) {
            errors.push(
              error instanceof Error ? error.message : 'Batch run failed for an unknown reason.',
            );
            const uniqueErrors = [...new Set(errors)];
            updateRun(draftRun.id, {
              status: 'running',
              errorMessage: uniqueErrors.join(' | '),
              results: [...results],
            });
          }
        }),
      );

      const uniqueErrors = [...new Set(errors)];

      updateRun(draftRun.id, {
        status: uniqueErrors.length > 0 ? 'failed' : 'completed',
        errorMessage: uniqueErrors.length > 0 ? uniqueErrors.join(' | ') : undefined,
        results: [...results],
      });
    } catch (error) {
      updateRun(draftRun.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Batch run failed for an unknown reason.',
      });
    } finally {
      setRunning(false);
    }
  }

  return (
      <div
        className={`modal-overlay ${open ? '' : 'hidden'}`}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeComposer();
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }}>
          <div className="modal-head">
            <div>
              <div className="modal-title">New Batch Test</div>
              <div className="modal-sub">Compare models and prompts</div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeComposer}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={runBatch}
                disabled={running}
              >
                {running ? (
                  <span className="spin"><IconBox><IconSpinner /></IconBox></span>
                ) : (
                  <IconBox><IconPlay /></IconBox>
                )}
                {running ? 'Running…' : 'New Job'}
              </button>
            </div>
          </div>
          <div className="modal-body">
            <div className="field">
              <label className="field-label">
                <IconBox size={11}><IconCpu /></IconBox>
                Model<span className="req">*</span>
              </label>
              <MultiSelectDropdown
                options={modelDropdownOptions}
                selectedIds={selectedModelIds}
                onToggle={(id) => setSelectedModelIds((current) => toggleSelection(current, id))}
                emptyLabel="Select models…"
                searchPlaceholder="Search models…"
                groups={[
                  { key: 'text', label: MODEL_CATEGORY_LABELS.text },
                  { key: 'image', label: MODEL_CATEGORY_LABELS.image },
                  { key: 'video', label: MODEL_CATEGORY_LABELS.video },
                ]}
              />
            </div>

            <div className="field">
              <label className="field-label">
                <IconBox size={11}><IconCpu /></IconBox>
                Thinking
              </label>
              <div
                id="thinkingDropdown"
                className={`dropdown ${thinkingDropdownOpen ? 'open' : ''}`}
                data-value={thinkingLevel}
              >
                <button
                  type="button"
                  className="dropdown-trigger"
                  onClick={() => setThinkingDropdownOpen((open) => !open)}
                >
                  <span className="dropdown-label">
                    {THINKING_OPTIONS.find((option) => option.value === thinkingLevel)?.label}
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
                <div className="dropdown-menu" hidden={!thinkingDropdownOpen}>
                  {THINKING_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className={`dropdown-option ${
                        thinkingLevel === option.value ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setThinkingLevel(option.value);
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{option.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {option.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">
                <IconBox size={11}><IconDoc /></IconBox>
                System prompt<span className="req">*</span>
              </label>
              <MultiSelectDropdown
                options={promptDropdownOptions}
                selectedIds={selectedPromptIds}
                onToggle={(id) =>
                  setSelectedPromptIds((current) => orderPromptSelection(toggleSelection(current, id)))
                }
                emptyLabel="Select prompts…"
                searchPlaceholder="Search prompts…"
                groups={promptGroups}
              />
            </div>

            <div className="field">
              <label className="field-label">
                <IconBox size={11}><IconImage /></IconBox>
                Image reference
              </label>
              <MultiSelectDropdown
                options={imageReferenceDropdownOptions}
                selectedIds={selectedImageReferenceIds}
                onToggle={(id) =>
                  setSelectedImageReferenceIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Select images…"
                searchPlaceholder="Search images…"
              />
            </div>

            <div className="field">
              <label className="field-label">
                <IconBox size={11}><IconDoc /></IconBox>
                Text input
              </label>
              <MultiSelectDropdown
                options={textInputDropdownOptions}
                selectedIds={selectedTextInputAssetIds}
                onToggle={(id) =>
                  setSelectedTextInputAssetIds((current) => toggleSelection(current, id))
                }
                emptyLabel="Select text inputs…"
                searchPlaceholder="Search text inputs…"
              />
            </div>

            <div className="field">
              <label className="field-label">Stickerize</label>
              <div className="field-toggle-row">
                <div className="field-toggle-text">
                  Remove the background and add the white outline to generated image outputs.
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={stickerize}
                  className={`toggle ${stickerize ? 'on' : ''}`}
                  onClick={() => setStickerize((current) => !current)}
                />
              </div>
            </div>

            {errorMessage ? (
              <div
                style={{
                  padding: 12,
                  border: '1px solid oklch(0.72 0.18 22 / 0.4)',
                  borderRadius: 'var(--r-md)',
                  background: 'oklch(0.72 0.18 22 / 0.08)',
                  color: 'var(--rose)',
                  fontSize: 12.5,
                }}
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>

  );
}
