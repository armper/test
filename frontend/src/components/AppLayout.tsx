import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_SECTIONS = [
  {
    title: 'Alerts',
    links: [
      { to: '/custom-alerts', label: 'Custom Alerts', description: 'Create and manage your custom triggers' },
      { to: '/', label: 'NOAA Overview', description: 'See official weather advisories', end: true },
    ],
  },
  {
    title: 'Management',
    links: [
      { to: '/areas', label: 'My Areas', description: 'Draw and refine coverage regions' },
      { to: '/admin', label: 'Admin Dashboard', description: 'System insights', requiresAdmin: true },
    ],
  },
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
          {NAV_SECTIONS.map((section) => {
            const links = section.links.filter((link) => !link.requiresAdmin || user?.roles.includes('admin'));
            if (!links.length) return null;
            return (
              <div className="nav-section" key={section.title}>
                <strong>{section.title}</strong>
                <ul>
                  {links.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={closeNav}
                        end={link.end}
                      >
                        <span className="nav-label">{link.label}</span>
                        {link.description ? <span className="nav-description">{link.description}</span> : null}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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
