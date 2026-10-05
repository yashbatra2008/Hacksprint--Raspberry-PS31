import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { Dot } from '../components/ui.jsx';

function useTyped(lines, speed = 26) {
  const [text, setText] = useState('');
  useEffect(() => {
    let i = 0;
    let cancelled = false;
    const full = lines.join('\n');
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setText(full.slice(0, i));
      if (i < full.length) setTimeout(tick, speed);
    };
    const start = setTimeout(tick, 320);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [lines, speed]);
  return text;
}

const PIPELINE = [
  { key: 'email', label: 'EMAIL', icon: '✉', note: 'Sender · links · claim' },
  { key: 'analysis', label: 'THREAT ANALYSIS', icon: '⚙', note: '7 security checks' },
  { key: 'trust', label: 'TRUST VERIFICATION', icon: '✓', note: 'Verified announcement record' },
  { key: 'decision', label: 'SECURITY DECISION', icon: '▶', note: 'Explainable risk verdict' },
];

const CAPABILITIES = [
  {
    icon: '⌖',
    title: 'Sender Verification',
    body:
      'Every message is checked against the institution\'s verified domains, with look-alike and typosquat detection for addresses that merely resemble the real thing.',
  },
  {
    icon: '◈',
    title: 'Institutional Context Verification',
    body:
      'The claim is matched against the verified announcement record. A course, drive or notice that the institution never published cannot be verified — no matter how convincing the email looks.',
  },
  {
    icon: '⚖',
    title: 'Explainable Risk Detection',
    body:
      'Each indicator carries a documented weight and the evidence that triggered it. The verdict is auditable rather than a black-box score.',
  },
];

const SYSTEM_ROWS = [
  ['Threat Engine', 'ONLINE'],
  ['Context Engine', 'ONLINE'],
  ['Domain Monitor', 'ONLINE'],
  ['Verification', 'ONLINE'],
  ['Database', 'ONLINE'],
];

export default function Landing({ onLogin, config }) {
  const [emails, setEmails] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .demoEmails()
      .then((d) => {
        if (alive) setEmails(d.emails.length);
      })
      .catch(() => {
        if (alive) setEmails(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const typed = useTyped([
    '> campusshield --verify incoming-message',
    '[+] sender domain ......... unverified',
    '[+] context match ......... NO VERIFIED MATCH',
    '[+] risk ................. 87/100  CRITICAL',
    '[!] potential institution impersonation',
  ]);

  const tagline = config?.product?.tagline ?? 'Verify before you trust.';
  const description =
    config?.product?.description ?? 'Context-aware protection against institution-impersonation phishing.';

  return (
    <div className="shell">
      {}
      <section className="hero">
        <div className="bg-circuit" aria-hidden="true" />
        <div className="hero-inner">
          <div>
            <span className="eyebrow">TrustShield · Campus Deployment</span>
            <h1 className="hero-wordmark gradient-text" style={{ marginTop: 14 }}>
              CAMPUSSHIELD
            </h1>
            <p className="hero-tagline">{tagline}</p>
            <p className="lede" style={{ maxWidth: 620, fontSize: '1.03rem' }}>
              {description}
            </p>

            <div className="pipeline" aria-label="Analysis pipeline">
              {PIPELINE.map((node, i) => (
                <div key={node.key}>
                  <div className="pipeline-node">
                    <span className="pipeline-node-icon" aria-hidden="true">{node.icon}</span>
                    <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                      <span className="pipeline-node-label">{node.label}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                        {node.note}
                      </span>
                    </div>
                  </div>
                  {i < PIPELINE.length - 1 ? <div className="pipeline-arrow" aria-hidden="true" /> : null}
                </div>
              ))}
            </div>

            <div className="row gap-12 wrap" style={{ marginTop: 26 }}>
              <Link to="/student" className="btn btn-primary btn-lg" onClick={() => onLogin('student')}>
                Enter Student Dashboard
              </Link>
              <Link to="/admin" className="btn btn-lg" onClick={() => onLogin('admin')}>
                Enter Security Dashboard
              </Link>
            </div>

            <p className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 16 }}>
              Prototype demonstration using fictional institutional and student data.
            </p>
          </div>

          {}
          <div className="stack gap-16">
            <div className="terminal">
              <div className="terminal-head">
                <span className="terminal-dots" aria-hidden="true">
                  <i /><i /><i />
                </span>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-mute)' }}>
                  THREAT ENGINE — LIVE PREVIEW
                </span>
              </div>
              <div className="terminal-body">
                <pre
                  className="mono"
                  style={{ fontSize: 11.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--text-dim)', margin: 0 }}
                >
                  {typed}
                  <span className="cursor" />
                </pre>
              </div>
            </div>

            <div className="status-panel">
              <div
                className="row gap-8"
                style={{
                  padding: '11px 15px',
                  borderBottom: '1px solid var(--line-soft)',
                  justifyContent: 'space-between',
                }}
              >
                <span className="mono-label" style={{ letterSpacing: '0.18em' }}>System Status</span>
                <span className="row gap-6">
                  <Dot tone="safe" pulse />
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--green)', letterSpacing: '0.12em' }}>
                    ALL SYSTEMS NOMINAL
                  </span>
                </span>
              </div>
              {SYSTEM_ROWS.map(([label, value]) => (
                <div className="status-row" key={label}>
                  <Dot tone="safe" pulse />
                  <span className="status-row-label">{label}</span>
                  <span className="status-row-value">{value}</span>
                </div>
              ))}
              <div className="status-row">
                <Dot tone="warn" />
                <span className="status-row-label">Demo Dataset</span>
                <span className="status-row-value warn">
                  {emails === null ? 'UNAVAILABLE' : `${emails} SCENARIOS`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="grid grid-3">
          {CAPABILITIES.map((c) => (
            <article className="capability" key={c.title}>
              <div className="capability-icon" aria-hidden="true">{c.icon}</div>
              <h3 className="h3" style={{ marginBottom: 7 }}>{c.title}</h3>
              <p className="dim" style={{ fontSize: 13.2, lineHeight: 1.62 }}>{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div
          className="panel bracketed"
          style={{
            padding: 'clamp(22px, 4vw, 38px)',
            background: 'linear-gradient(120deg, rgba(34,211,238,0.05), rgba(167,139,250,0.04), transparent)',
          }}
        >
          <span className="eyebrow">The Key Innovation</span>
          <h2 className="h2" style={{ margin: '12px 0 16px', maxWidth: 880 }}>
            Traditional phishing detection asks: <em style={{ color: 'var(--text-dim)' }}>is this email malicious?</em>
          </h2>
          <p className="lede" style={{ maxWidth: 880, fontSize: '1.05rem' }}>
            CampusShield additionally asks:{' '}
            <strong style={{ color: 'var(--cyan)' }}>
              does this communication make sense in the context of this institution?
            </strong>
          </p>
          <div className="grid grid-3" style={{ marginTop: 26 }}>
            {[
              ['Email Security', 'Sender, authentication posture, links and language.'],
              ['Institutional Context', 'Does the claimed announcement exist in the verified record?'],
              ['Student Information Usage', 'Is the message personalised, and what does that actually prove?'],
              ['Trusted Announcement Verification', 'The student can confirm the claim through an official channel.'],
              ['Explainable Risk Analysis', 'Every indicator shows its weight and its evidence.'],
              ['Privacy by Design', 'No mailbox connection, no credential collection, no real student data.'],
            ].map(([title, body]) => (
              <div key={title} className="stack gap-4">
                <span className="mono" style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {title}
                </span>
                <span className="dim" style={{ fontSize: 12.8, lineHeight: 1.6 }}>{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="stack gap-16">
          <div className="stack gap-6">
            <span className="eyebrow">Select Demo Role</span>
            <h2 className="h2">Choose an operations view</h2>
            <p className="dim" style={{ fontSize: 13.5, maxWidth: 700 }}>
              No credentials are required and no account is created. The prototype stores the selected
              demo identity locally so the workflow can be demonstrated end to end.
            </p>
          </div>

          <div className="role-grid">
            <Link to="/student" className="role-card" onClick={() => onLogin('student')}>
              <div className="row gap-10">
                <span className="capability-icon" style={{ margin: 0 }} aria-hidden="true">🎓</span>
                <div className="stack">
                  <span className="role-card-title">Student Demo</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    alex.kumar@northstaruniversity.edu
                  </span>
                </div>
              </div>
              <p className="dim" style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}>
                Paste a suspicious college email, run the analysis, verify the claim against the official
                announcement record, and report it to Campus Security.
              </p>
              <span className="badge badge-cyan">Open Student Dashboard →</span>
            </Link>

            <Link to="/admin" className="role-card admin" onClick={() => onLogin('admin')}>
              <div className="row gap-10">
                <span
                  className="capability-icon"
                  style={{ margin: 0, borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.07)', color: 'var(--purple)' }}
                  aria-hidden="true"
                >
                  🛡
                </span>
                <div className="stack">
                  <span className="role-card-title">Security Admin Demo</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    soc.lead@northstaruniversity.edu
                  </span>
                </div>
              </div>
              <p className="dim" style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}>
                Monitor the threat queue, triage student reports, action incidents, maintain the sender
                watchlist and manage verified institutional sources.
              </p>
              <span className="badge badge-purple">Open Security Operations →</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span>CAMPUSSHIELD · TRUSTSHIELD PROTOTYPE v{config?.riskModel?.version ?? '1.2.0'}</span>
          <span>
            FICTIONAL DATA ONLY · NO MAILBOX CONNECTION · NO CREDENTIALS COLLECTED
          </span>
        </div>
      </footer>
    </div>
  );
}
