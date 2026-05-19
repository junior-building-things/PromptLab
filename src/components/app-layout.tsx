import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

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
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
        <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
      </svg>
    ),
  },
  {
    to: '/models',
    screen: 'models',
    label: 'API Keys',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" />
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
    sub: 'Add your provider API keys, then prepare model presets before batch tests hit the network.',
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

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('promptlab-theme') === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      window.localStorage.setItem('promptlab-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
      window.localStorage.removeItem('promptlab-theme');
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((c) => (c === 'light' ? 'dark' : 'light')) };
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const chrome = usePageChrome();
  const { theme, toggle: toggleTheme } = useTheme();

  // Reset the chrome snapshot on every navigation so a stale topbar
  // action from the prior page doesn't bleed across. Pages immediately
  // call `setPageChrome` again in their own mount effect to populate
  // their content — a single repaint covers the transition.
  useEffect(() => {
    setPageChrome({});
  }, [location.pathname]);

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
            <div className="brand-mark">
              <img src="/assets/app-icon.png" alt="PromptLab" />
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
              <div className="avatar">{initials}</div>
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
              <button
                type="button"
                className="icon-btn"
                aria-label="Toggle theme"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                  </svg>
                )}
              </button>
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
