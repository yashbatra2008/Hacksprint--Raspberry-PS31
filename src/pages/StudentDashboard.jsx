import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Dot, Panel, PanelBody, PanelHead, StatusBadge, Loading } from '../components/ui.jsx';
import { shortTime, toneForLevel } from '../lib/format.js';

export default function StudentDashboard({ session }) {
  const navigate = useNavigate();
  const { push } = useToast();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .stats()
      .then((d) => {
        if (alive) {
          setStats(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const runLiveDemo = async () => {
    setRunning(true);
    try {
      const d = await api.demoAttack();
      push({
        tone: 'warn',
        title: 'DEMO EMAIL LOADED',
        message: d.demo.label,
        lines: [`Expected prototype outcome: ${d.demo.expected}`],
      });
      navigate('/student/scan', { state: { demo: d.demo, autorun: true } });
    } catch (e) {
      push({ tone: 'danger', title: 'SYSTEM', message: e.message });
    } finally {
      setRunning(false);
    }
  };

  const monitor = stats?.threatMonitor ?? [];
  const kpis = stats?.kpis;

  return (
    <div className="stack gap-24">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Student Protection Center</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.2rem)' }}>
            Welcome, {session?.name?.split(' ')[0] ?? 'Student'}
          </h1>
          <p className="dim" style={{ maxWidth: 700, fontSize: 14 }}>
            {session?.title ?? 'Student'} · Analyse a suspicious college email before clicking anything in it.
          </p>
        </div>
        <Badge tone="warn">DEMO ENVIRONMENT</Badge>
      </div>

      {}
      <Panel bracketed style={{ background: 'linear-gradient(115deg, rgba(34,211,238,0.06), rgba(167,139,250,0.035), transparent)' }}>
        <PanelBody>
          <div className="row gap-20 wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stack gap-8" style={{ maxWidth: 620 }}>
              <h2 className="h2">Analyze a suspicious college email before clicking.</h2>
              <p className="dim" style={{ fontSize: 13.5 }}>
                CampusShield checks the sender, the links and the message content — and then verifies
                whether the announcement actually exists in the institution's official record.
              </p>
            </div>
            <div className="row gap-10 wrap">
              <Link to="/student/scan" className="btn btn-primary btn-lg">
                Paste Email
              </Link>
              <Link to="/student/scan?tab=eml" className="btn btn-lg">
                Upload .eml
              </Link>
              <button type="button" className="btn btn-lg btn-success" onClick={runLiveDemo} disabled={running}>
                {running ? 'Loading…' : 'Run Live Demo'}
              </button>
            </div>
          </div>
        </PanelBody>
      </Panel>

      {error ? (
        <Alert tone="danger" title="Cannot reach the analysis backend">
          {error.message}
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------------- KPIs */}
      <div className="grid grid-kpi">
        {[
          { label: 'Emails Analyzed', value: kpis?.emailsAnalyzed, tone: 'cyan', hint: 'Prototype-wide' },
          { label: 'High-Risk Communications', value: kpis?.highRiskEmails, tone: 'danger', hint: 'HIGH + CRITICAL' },
          { label: 'Impersonation Attempts', value: kpis?.impersonationAttempts, tone: 'critical', hint: 'Institution impersonation' },
          { label: 'Verified Announcements', value: kpis?.verifiedAnnouncements, tone: 'safe', hint: 'Official record' },
        ].map((k) => (
          <Panel key={k.label} className="kpi" interactive>
            <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
              <span className="mono-label">{k.label}</span>
              <Dot tone={k.tone} pulse={k.tone === 'danger' || k.tone === 'critical'} />
            </div>
            <div className="kpi-value" style={{ color: k.tone === 'safe' ? 'var(--green)' : k.tone === 'danger' || k.tone === 'critical' ? 'var(--red)' : 'var(--text)' }}>
              {loading ? '—' : (k.value ?? 0).toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3 }}>
              {k.hint}
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid grid-2">
        {/* --------------------------------------------------- threat monitor */}
        <Panel bracketed>
          <PanelHead title="Live Threat Activity">
            <span className="row gap-6">
              <Dot tone="danger" pulse />
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--red)', letterSpacing: '0.12em' }}>LIVE</span>
            </span>
          </PanelHead>
          {loading ? (
            <Loading label="CONNECTING TO THREAT ENGINE" />
          ) : (
            <div className="feed">
              {monitor.map((e) => (
                <div className="feed-item" key={e.id}>
                  <span className="feed-time">{shortTime(e.time)}</span>
                  <div className="feed-body">
                    <div className="feed-title">{e.summary}</div>
                    <div className="feed-meta">
                      {e.category} · {e.sender}
                    </div>
                  </div>
                  <Badge tone={toneForLevel(e.level)}>{e.level}</Badge>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)' }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              Demo events — fictional institutional and student data.
            </span>
          </div>
        </Panel>

        {/* ------------------------------------------------------ quick guide */}
        <div className="stack gap-16">
          <Panel>
            <PanelHead title="How Verification Works" />
            <PanelBody className="stack gap-14">
              <p className="dim" style={{ fontSize: 13, lineHeight: 1.65 }}>
                A convincing email is not proof that the institution sent it. CampusShield gives you a
                second opinion by checking the claim against the official announcement record.
              </p>
              {[
                ['1', 'Paste the email', 'Include the sender, subject, body and any links.'],
                ['2', 'Run the analysis', 'Seven security checks produce an explainable risk verdict.'],
                ['3', 'Verify with College', 'Compare the claim against verified announcements.'],
                ['4', 'Report if suspicious', 'Send it to Campus Security with one click.'],
              ].map(([n, title, body]) => (
                <div className="row gap-12" key={n} style={{ alignItems: 'flex-start' }}>
                  <span
                    className="mono"
                    style={{
                      width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center',
                      border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.07)',
                      color: 'var(--cyan)', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    {n}
                  </span>
                  <div className="stack gap-2">
                    <span style={{ fontSize: 13.2, fontWeight: 600 }}>{title}</span>
                    <span className="dim" style={{ fontSize: 12.5 }}>{body}</span>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title="What CampusShield Does Not Do" />
            <PanelBody className="stack gap-10">
              <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                <Dot tone="safe" />
                <span className="dim" style={{ fontSize: 12.8 }}>
                  It never connects to your mailbox and never asks for your password.
                </span>
              </div>
              <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                <Dot tone="safe" />
                <span className="dim" style={{ fontSize: 12.8 }}>
                  It never opens, fetches or resolves a link contained in an email.
                </span>
              </div>
              <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
                <Dot tone="safe" />
                <span className="dim" style={{ fontSize: 12.8 }}>
                  It reports risk indicators, not certainty. A low score is not a guarantee of safety.
                </span>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
