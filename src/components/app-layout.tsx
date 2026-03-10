import { Bot, Cpu, ImageIcon, LogOut, PlaySquare, Sparkles } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

const navItems = [
  { to: '/', label: 'Prompts', icon: Sparkles },
  { to: '/assets', label: 'Assets', icon: ImageIcon },
  { to: '/models', label: 'Models', icon: Cpu },
  { to: '/batch-test', label: 'Batch Test', icon: PlaySquare },
];

export function AppLayout() {
  const { user, logout } = useAuth();

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

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="sidebar-user-avatar" />
            ) : (
              <div className="sidebar-user-avatar sidebar-user-avatar-fallback">
                {user?.name?.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="sidebar-user-copy">
              <strong>{user?.name}</strong>
              <span>{user?.email || 'Signed In With Google'}</span>
            </div>
          </div>

          <button type="button" className="button button-secondary sidebar-logout" onClick={() => void logout()}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

      </aside>

      <main className="main-panel">
        <div className="main-panel-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
