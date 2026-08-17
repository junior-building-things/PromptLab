import { Bot } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { IconBox, IconCheck, IconMonitor, IconMoon, IconSun } from './icons';
import {
  applyTheme,
  readThemeMode,
  resolveTheme,
  storeThemeMode,
  type ThemeMode,
} from '../lib/theme';

/**
 * App-shell ported verbatim from the Claude Design PromptLab.html mockup:
 *
 *   .app  ───  232px frosted sidebar  +  1fr main panel
 *           ─  12 px gap, 12 px padding, full viewport height
 *
 * The sidebar carries the brand mark (with a 3.2 s pulsing violet halo),
 * the "Workspace" nav (Prompts / API Keys / Assets / Batch Test), and a
 * footer with the signed-in user + Sign out action.
 *
 * The main panel hosts the page's topbar (title + sub + theme toggle +
 * page-specific action buttons), an optional toolbar (search bar, filter
 * chips), and the scrollable page body. Pages slot their own
 * topbar-actions / toolbar / content via the `usePageChrome` mechanism
 * below — that's what the design's `PAGES` table in plain JS does, just
 * translated to React.
 */

const NAV_ITEMS = [
  {
    to: '/',
    screen: 'prompts',
    label: 'Prompts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    to: '/models',
    screen: 'models',
    label: 'API Keys',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="M10.7 12.3L21 2" />
        <path d="M17 6l3 3M14.5 8.5l3 3" />
      </svg>
    ),
  },
  {
    to: '/assets',
    screen: 'assets',
    label: 'Assets',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M3 17l5-4 6 5 7-6" />
      </svg>
    ),
  },
  {
    to: '/batch-test',
    screen: 'batch',
    label: 'Batch Test',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    ),
  },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/': {
    title: 'Prompt Library',
    sub: 'Organize prompts as projects, version iterations, and keep the latest candidate easy to test.',
  },
  '/models': {
    title: 'API Keys',
    sub: 'Add your provider API keys. All keys are stored encrypted.',
  },
  '/assets': {
    title: 'Assets',
    sub: 'Store reusable text inputs and image references for batch testing.',
  },
  '/batch-test': {
    title: 'Batch Test',
    sub: 'Run and review previous batch tests.',
  },
};

/**
 * Convention for pages to inject content into the layout shell's slots:
 *   - `topbar-right`  → buttons that sit next to the theme toggle (primary
 *                       CTA like "New project", "Upload asset"…)
 *   - `toolbar`       → the optional row beneath the topbar (search bar
 *                       + filter chips)
 *
 * Pages render `<div id="page-topbar-actions" />` and `<div id="page-toolbar" />`
 * via React portals would normally be cleaner, but to keep churn low we
 * instead expose a global "chrome bus" that pages call into via window
 * events. Layout listens and re-renders.
 */

type PageChromeSnapshot = {
  topbarRight?: ReactNode;
  toolbar?: ReactNode;
};

let activeChrome: PageChromeSnapshot = {};
const chromeSubscribers = new Set<(snap: PageChromeSnapshot) => void>();

export function setPageChrome(next: PageChromeSnapshot) {
  activeChrome = next;
  chromeSubscribers.forEach((fn) => fn(next));
}

function usePageChrome(): PageChromeSnapshot {
  const [snapshot, setSnapshot] = useState<PageChromeSnapshot>(activeChrome);
  useEffect(() => {
    chromeSubscribers.add(setSnapshot);
    setSnapshot(activeChrome);
    return () => {
      chromeSubscribers.delete(setSnapshot);
    };
  }, []);
  return snapshot;
}

const THEME_MODES: Array<{ id: ThemeMode; label: string; icon: ReactNode }> = [
  { id: 'system', label: 'System', icon: <IconMonitor /> },
  { id: 'light', label: 'Light', icon: <IconSun /> },
  { id: 'dark', label: 'Dark', icon: <IconMoon /> },
];

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());

  useEffect(() => {
    applyTheme(mode);
    storeThemeMode(mode);
  }, [mode]);

  // On System, follow the OS as it flips (macOS auto-dark at dusk).
  useEffect(() => {
    if (mode !== 'system') return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);

  return { mode, setMode };
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const chrome = usePageChrome();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  // Lark's CDN can refuse a hotlink; fall back to initials rather than a broken image.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Each page owns its own chrome lifecycle — its mount effect calls
  // setPageChrome({ … }) and the cleanup clears it. A parent-level
  // reset here would race against the child effects (parents run
  // *after* children in React) and wipe the just-set topbar buttons
  // on every navigation. Don't add one back.

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) setThemeMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [themeMenuOpen]);

  const activeThemeMode = THEME_MODES.find((option) => option.id === themeMode) ?? THEME_MODES[0];

  const meta = PAGE_META[location.pathname] ?? PAGE_META['/'];
  const initials = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return 'TO';
    return name
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('');
  }, [user?.name]);
  const firstName = user?.name?.trim().split(/\s+/)[0] || user?.name || 'Thomas';

  return (
    <>
      <div className="app-bg" />
      <div className="app">
        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark" aria-label="PromptLab">
              <Bot strokeWidth={2} />
            </div>
            <div>
              <div className="brand-name">PromptLab</div>
              <div className="brand-sub">v2.2</div>
            </div>
          </div>

          <div className="nav-label">Workspace</div>
          <nav className="nav-section" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);
              return (
                <button
                  key={item.to}
                  type="button"
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  data-screen={item.screen}
                  onClick={() => navigate(item.to)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-foot">
            <div className="user-row">
              {user?.avatarUrl && !avatarFailed ? (
                <img
                  className="avatar"
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="avatar">{initials}</div>
              )}
              <div>
                <div className="user-name">{firstName}</div>
                <button type="button" className="user-logout" onClick={() => void logout()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ============ MAIN ============ */}
        <section className="main">
          <header className="topbar">
            <div>
              <div className="page-title">{meta.title}</div>
              <div className="page-sub">{meta.sub}</div>
            </div>
            <div className="topbar-actions">
              {chrome.topbarRight}
              <div ref={themeMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Theme: ${activeThemeMode.label}`}
                  title={`Theme: ${activeThemeMode.label}`}
                  onClick={() => setThemeMenuOpen((open) => !open)}
                >
                  <IconBox>{activeThemeMode.icon}</IconBox>
                </button>
                {themeMenuOpen ? (
                  <div className="theme-menu">
                    {THEME_MODES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="theme-menu-item"
                        onClick={() => {
                          setThemeMode(option.id);
                          setThemeMenuOpen(false);
                        }}
                      >
                        <IconBox>{option.icon}</IconBox>
                        <span style={{ flex: 1, textAlign: 'left' }}>{option.label}</span>
                        {themeMode === option.id ? (
                          <IconBox size={11}><IconCheck /></IconBox>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          {chrome.toolbar}
          <div className="scroll">
            <Outlet />
          </div>
        </section>
      </div>
    </>
  );
}
