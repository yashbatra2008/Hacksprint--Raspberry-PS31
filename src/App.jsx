import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Layout from './components/Layout.jsx';
import { api, getSession, setSession, clearSession } from './lib/api.js';

import Landing from './pages/Landing.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import EmailScanner from './pages/EmailScanner.jsx';
import AnalysisReport from './pages/AnalysisReport.jsx';
import Verification from './pages/Verification.jsx';
import MyReports from './pages/MyReports.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import ThreatQueue from './pages/ThreatQueue.jsx';
import ThreatDetail from './pages/ThreatDetail.jsx';
import Watchlist from './pages/Watchlist.jsx';
import Settings from './pages/Settings.jsx';
import ThreatIntel from './pages/ThreatIntel.jsx';

function BackgroundField() {
  return (
    <div className="bg-field" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-vignette" />
      <div className="bg-scan" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((c) => {
        if (alive) setConfig(c);
      })
      .catch(() => {

      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const login = useCallback((role) => {
    const next =
      role === 'admin'
        ? {
            role: 'admin',
            name: 'Yash B.',
            email: 'soc.lead@northstaruniversity.edu',
            title: 'Security Operations Lead',
          }
        : {
            role: 'student',
            name: 'Alex Kumar',
            email: 'alex.kumar@northstaruniversity.edu',
            studentId: 'stu-alex',
            title: 'B.Tech Computer Science · Semester 3',
          };
    setSession(next);
    setSessionState(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  const isLanding = location.pathname === '/';

  if (isLanding) {
    return (
      <>
        <BackgroundField />
        <Routes>
          <Route path="/" element={<Landing onLogin={login} config={config} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <BackgroundField />
      <Layout session={session} onLogout={logout} config={config}>
        <Routes>
          {}
          <Route
            path="/student"
            element={<StudentDashboard session={session} config={config} />}
          />
          <Route path="/student/scan" element={<EmailScanner session={session} />} />
          <Route path="/student/analysis/:id" element={<AnalysisReport session={session} />} />
          <Route path="/student/verify" element={<Verification />} />
          <Route path="/student/reports" element={<MyReports session={session} />} />

          {}
          <Route path="/threat-intelligence" element={<ThreatIntel />} />

          {}
          <Route path="/admin" element={<AdminOverview session={session} />} />
          <Route path="/admin/threats" element={<ThreatQueue session={session} />} />
          <Route path="/admin/threats/:id" element={<ThreatDetail session={session} />} />
          <Route path="/admin/watchlist" element={<Watchlist session={session} />} />
          <Route path="/admin/settings" element={<Settings session={session} />} />

          {}
          <Route path="*" element={<Navigate to={session?.role === 'admin' ? '/admin' : '/student'} replace />} />
        </Routes>
      </Layout>
    </>
  );
}
