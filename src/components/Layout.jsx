import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

import { api } from '../lib/api.js';
import { Dot } from './ui.jsx';

function ShieldMark({ size = 32 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="CampusShield">
      <path
        d="M16 2.2 4.6 7.1v8.6c0 6.6 4.8 11.9 11.4 13.4 6.6-1.5 11.4-6.8 11.4-13.4V7.1L16 2.2Z"
        fill="rgba(34,211,238,0.07)"
        stroke="#22d3ee"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 16.4l3.9 3.9 7.1-8.2"
        fill="none"
        stroke="#34d399"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Layout({ children, session, onLogout, config }) {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [threatCount, setThreatCount] = useState(null);
  const [watchCount, setWatchCount] = useState(null);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (session?.role !== 'admin') return undefined;
    let alive = true;
    const load = () => {
      api
        .threats()
        .then((d) => {
          if (!alive) return;
          setThreatCount(d.threats.filter((t) => ['investigating', 'escalated', 'reported'].includes(t.status)).length);
        })
        .catch(() => {});
      api
        .watchlist()
        .then((d) => {
          if (alive) setWatchCount(d.count);
        })
        .catch(() => {});
    };
    load();

    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session?.role]);

  const onAdminRoute = location.pathname.startsWith('/admin');
  const isAdmin = onAdminRoute || session?.role === 'admin';

  const studentNav = [
    { to: '/student', label: 'Overview', icon: '◉', end: true },
    { to: '/student/scan', label: 'Email Scanner', icon: '⌘' },
    { to: '/student/verify', label: 'Verify with College', icon: '✓' },
    { to: '/student/reports', label: 'My Reports', icon: '⚑' },
  ];

  const adminNav = [
    { to: '/admin', label: 'Overview', icon: '◉', end: true },
    { to: '/admin/threats', label: 'Threat Queue', icon: '⚑', count: threatCount },
    { to: '/admin/watchlist', label: 'Watchlist', icon: '⌖', count: watchCount },
    { to: '/admin/settings', label: 'Trusted Sources', icon: '⚙' },
  ];

  const sharedNav = [
    { to: '/threat-intelligence', label: 'Threat Intelligence', icon: '◈' },
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
        >
          {navOpen ? '✕' : '☰'}
        </button>

        <Link to={isAdmin ? '/admin' : '/student'} className="topbar-brand">
          <ShieldMark />
          <span className="brand-text">
            <span className="brand-name">CAMPUSSHIELD</span>
            <span className="brand-sub">
              {onAdminRoute ? 'Security Operations' : 'Student Protection Center'}
            </span>
          </span>
        </Link>

        <span className="topbar-spacer" />

        <span className="badge badge-warn" title="All data in this prototype is fictional.">
          DEMO MODE
        </span>

        {session ? (
          <div className="row gap-8 topbar-user">
            <div className="stack" style={{ alignItems: 'flex-end', lineHeight: 1.25 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{session.name}</span>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>
                {onAdminRoute ? 'SECURITY ADMIN' : 'STUDENT'}
              </span>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onLogout} title="Return to the role selector">
              Switch role
            </button>
          </div>
        ) : null}

        <span className="topbar-status">
          <Dot tone="safe" pulse />
          SYSTEM ONLINE
        </span>
      </header>

      {navOpen ? <div className="sidebar-scrim" onClick={() => {}} /> : null}

      <div className="layout">
        <aside className={`sidebar${navOpen ? ' open' : ''}`}>
          <nav className="stack gap-22" aria-label="Primary">
            <div>
              <div className="nav-group-label">{isAdmin ? 'Operations' : 'Protection'}</div>
              <div className="nav">
                {(isAdmin ? adminNav : studentNav).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    {item.label}
                    {item.count ? <span className="nav-count">{item.count}</span> : null}
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <div className="nav-group-label">Intelligence</div>
              <div className="nav">
                {sharedNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          <div style={{ marginTop: 'auto' }}>
            <div className="stack gap-8" style={{ padding: '0 10px' }}>
              <span className="mono-label">Threat Engine</span>
              <div className="stack gap-6">
                {['Threat Engine', 'Context Engine', 'Domain Monitor', 'Verification'].map((s) => (
                  <div key={s} className="row gap-8" style={{ fontSize: 11 }}>
                    <Dot tone="safe" />
                    <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 10.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}