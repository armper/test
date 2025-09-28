import { ReactNode, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Overview' },
  { to: '/areas', label: 'My Areas' },
  { to: '/custom-alerts', label: 'Custom Alerts' },
  { to: '/admin', label: 'Admin Dashboard', requiresAdmin: true },
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const toggleNav = () => setNavOpen((open) => !open);
  const closeNav = () => setNavOpen(false);

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      <header className="app-header">
        <button className="hamburger" aria-label="Toggle navigation" onClick={toggleNav}>
          <span />
          <span />
          <span />
        </button>
        <div className="header-title">
          <h1>Weather Alerts</h1>
          <small>{user?.email}</small>
        </div>
        <button className="signout" onClick={logout}>
          Sign out
        </button>
      </header>

      <aside className="app-nav">
        <div className="nav-header">
          <strong>Navigation</strong>
        </div>
        <nav>
          <ul>
            {NAV_LINKS.filter((link) => !link.requiresAdmin || user?.roles.includes('admin')).map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeNav}
                  end
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="app-content">
        <Outlet context={{ currentPath: location.pathname } satisfies Record<string, unknown>} />
      </main>

      {navOpen && <div className="nav-backdrop" onClick={closeNav} aria-hidden="true" />}
    </div>
  );
};

export default AppLayout;
