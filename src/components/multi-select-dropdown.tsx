import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Multi-select dropdown matching the Claude Design PromptLab.html mockup
 * exactly:
 *
 *   .dropdown
 *     .dropdown-trigger (button)        → opens / closes the menu
 *     .dropdown-menu
 *       .dropdown-search (sticky)       → live-filter across options
 *       .dropdown-options
 *         .dropdown-group               → mono-uppercase section header
 *           .dropdown-option            → empty checkbox ::before
 *             .multi-selected           → filled checkbox + check ::before
 *
 * Behaviour:
 *  - Click outside closes the menu.
 *  - Click inside (search input, options) keeps it open.
 *  - Esc closes.
 *  - Filtering hides options whose `searchText` doesn't include the
 *    query; entire groups hide if they have no visible members.
 */

export type DropdownOption = {
  id: string;
  label: string;
  /** Lowercased haystack the search input matches against. Defaults to
   * `label` lowercased, but model options pass id + provider name etc. */
  searchText?: string;
  /** Optional leading icon (provider mark, file glyph, etc.) — rendered
   * in front of the checkbox mark. */
  icon?: ReactNode;
  /** Group key for grouped lists (model type, project name). Options
   * with no `group` are rendered in a single anonymous bucket above
   * any grouped sections. */
  group?: string;
};

export type DropdownGroup = {
  /** Stable identifier — also used as React key. */
  key: string;
  label: string;
};

export type MultiSelectDropdownProps = {
  /** Optional leading icon for the field label above the dropdown. */
  labelIcon?: ReactNode;
  /** Optional field label rendered above the dropdown. Omit when the
   * surrounding form already provides one (e.g. New Batch modal). */
  label?: string;
  options: DropdownOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Placeholder shown when nothing is selected. */
  emptyLabel: string;
  /** Search input placeholder. Defaults to "Search…". */
  searchPlaceholder?: string;
  /** Group definitions in render order. Options without a matching
   * `group` value are dropped from the grouped path. If omitted, all
   * options render as a flat list. */
  groups?: DropdownGroup[];
};

export function MultiSelectDropdown({
  labelIcon,
  label,
  options,
  selectedIds,
  onToggle,
  emptyLabel,
  searchPlaceholder = 'Search…',
  groups,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Esc closes; opening focuses the search input.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    // Defer focus until the menu has actually rendered.
    const id = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', handler);
      cancelAnimationFrame(id);
      setQuery('');
    };
  }, [open]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const triggerLabel = useMemo(() => {
    if (selectedIds.length === 0) return emptyLabel;
    return options
      .filter((o) => selectedIdSet.has(o.id))
      .map((o) => o.label)
      .join(', ');
  }, [selectedIds, selectedIdSet, options, emptyLabel]);

  // Filter + group.
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (option: DropdownOption) => {
      if (!q) return true;
      const haystack = option.searchText ?? option.label.toLowerCase();
      return haystack.includes(q);
    };

    if (!groups) {
      return [
        {
          key: '__flat__',
          label: '',
          items: options.filter(match),
        },
      ];
    }

    return groups
      .map((group) => ({
        key: group.key,
        label: group.label,
        items: options.filter((o) => o.group === group.key && match(o)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, options, query]);

  const handleToggle = useCallback(
    (id: string) => {
      onToggle(id);
      // Bring focus back to search so subsequent keystrokes filter rather
      // than scroll the dropdown.
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
    [onToggle],
  );

  return (
    <div className="field" style={label ? undefined : { gap: 0 }}>
      {label ? (
        <label className="field-label">
          {labelIcon ? <span style={{ display: 'inline-flex' }}>{labelIcon}</span> : null}
          {label}
        </label>
      ) : null}
      <div ref={rootRef} className={`dropdown ${open ? 'open' : ''}`}>
        <button
          type="button"
          className="dropdown-trigger"
          onClick={() => setOpen((o) => !o)}
        >
          <span
            className="dropdown-label"
            style={selectedIds.length === 0 ? { color: 'var(--text-dim)' } : undefined}
          >
            {triggerLabel}
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
        <div className="dropdown-menu" hidden={!open}>
          <div className="dropdown-search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="dropdown-options">
            {visibleGroups.length === 0 ? (
              <div
                style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  fontSize: 12,
                }}
              >
                No matches.
              </div>
            ) : (
              visibleGroups.map((group) => (
                <div key={group.key} className="dropdown-group">
                  {group.label ? (
                    <div className="dropdown-group-head">{group.label}</div>
                  ) : null}
                  {group.items.map((option) => {
                    const isSelected = selectedIdSet.has(option.id);
                    return (
                      <div
                        key={option.id}
                        className={`dropdown-option dropdown-option-model ${
                          isSelected ? 'multi-selected' : ''
                        }`}
                        onClick={() => handleToggle(option.id)}
                      >
                        {option.icon ? (
                          <span
                            className="dd-provider-icon"
                            style={{ flexShrink: 0 }}
                          >
                            {option.icon}
                          </span>
                        ) : null}
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {option.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
