import { Bot, Cpu, ImageIcon, PlaySquare, Sparkles } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Prompts', icon: Sparkles },
  { to: '/assets', label: 'Assets', icon: ImageIcon },
  { to: '/models', label: 'Models', icon: Cpu },
  { to: '/batch-test', label: 'Batch Test', icon: PlaySquare },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="brand-icon">
            <Bot size={22} />
          </div>
          <div>
            <h1>PromptLab</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

      </aside>

      <main className="main-panel">
        <div className="main-panel-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
