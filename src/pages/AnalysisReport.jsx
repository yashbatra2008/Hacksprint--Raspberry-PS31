import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import RiskGauge from '../components/RiskGauge.jsx';
import CheckCard from '../components/CheckCard.jsx';
import {
  Alert, Badge, Dot, Loading, ErrorState, Panel, PanelBody, PanelHead, StatusBadge, KV,
} from '../components/ui.jsx';
import { toneForLevel, prettyDateTime } from '../lib/format.js';

function gaugeIndicators(result) {
  const byId = Object.fromEntries((result.checks ?? []).map((c) => [c.id, c]));
  const sender = byId.sender_verification;
  const context = byId.institutional_context;
  const link = byId.link_analysis;
  const personal = byId.student_information;
  const social = byId.social_engineering;

  const socialField = (label) => social?.fields?.find((f) => f.label.toLowerCase() === label.toLowerCase());

  const mk = (label, ok, warn = false) => ({
    id: label,
    label,
    mark: ok ? '✓' : warn ? '⚠' : '✕',
    tone: ok ? 'safe' : warn ? 'warn' : 'danger',
  });

  return [
    mk('SENDER', sender?.status === 'PASSED'),
    mk('DOMAIN', sender?.status === 'PASSED'),
    mk('CONTEXT', context?.status === 'MATCH FOUND', context?.status === 'PARTIAL MATCH'),
    mk('LINK', link?.tone === 'safe', link?.tone === 'warn'),
    mk('PERSONAL DATA', personal?.status !== 'DETECTED', personal?.status === 'DETECTED'),
    mk('URGENCY', socialField('Urgency')?.value !== 'DETECTED', socialField('Urgency')?.value === 'DETECTED'),
  ];
}

export default function AnalysisReport({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(null);
  const [revealed, setRevealed] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getEmail(id)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!data?.analysis) return undefined;
    const total = data.analysis.verdict?.reasons?.length ?? 0;
    setRevealed(0);
    const timers = [];
    for (let i = 1; i <= total; i += 1) {
      timers.push(setTimeout(() => setRevealed(i), 220 * i));
    }
    return () => timers.forEach(clearTimeout);
  }, [data]);

  const runVerification = async () => {
    if (!data?.email) return;
    setVerifying(true);
    try {
      const res = await api.verifyAnnouncement({
        from: data.email.from,
        to: data.email.to,
        subject: data.email.subject,
        body: data.email.body,
        links: data.email.links,
        claimedDepartment: data.email.claimedDepartment,
        claimedType: data.email.claimedType,
      });
      setVerification(res.verification);
      push({
        tone: res.verification.outcome === 'VERIFIED' ? 'safe' : res.verification.outcome === 'PARTIAL' ? 'warn' : 'danger',
        title: 'VERIFICATION COMPLETE',
        message: res.verification.headline,
      });
    } catch (e) {
      push({ tone: 'danger', title: 'SYSTEM', message: e.message });
    } finally {
      setVerifying(false);
    }
  };

  const submitReport = async () => {
    if (!data?.analysis) return;
    setReporting(true);
    try {
      const res = await api.reportThreat({
        analysisId: data.analysis.id,
        emailId: data.email.id,
        reportedBy: session?.email ?? 'student@northstaruniversity.edu',
        notes: `Reported from the student console. Prototype Risk Score ${data.analysis.score}/100.`,
      });
      setReported(res);
      push({
        tone: 'safe',
        title: 'SYSTEM',
        message: 'Threat report successfully submitted.',
        lines: [`[+] Incident ID: ${res.incidentId}`, '[+] Status: investigating — visible in the Security Operations queue'],
      });
    } catch (e) {
      push({ tone: 'danger', title: 'SYSTEM', message: e.message });
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <Panel>
        <PanelHead title="Email Security Analysis" />
        <Loading label="LOADING ANALYSIS RECORD" />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <PanelHead title="Email Security Analysis" />
        <ErrorState message={error.message} detail={error.detail} onRetry={load} />
      </Panel>
    );
  }

  const { email, analysis } = data;
  const tone = toneForLevel(analysis.level);
  const verdict = analysis.verdict ?? {};

  return (
    <div className="stack gap-20">
      {}
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Email Security Analysis</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)' }}>{email.subject || '(no subject)'}</h1>
          <div className="row gap-10 wrap">
            <Badge tone="neutral">ANL-{String(analysis.id).padStart(6, '0')}</Badge>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
              {email.from}
            </span>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
              {prettyDateTime(analysis.createdAt)}
            </span>
          </div>
        </div>
        <div className="row gap-8 wrap">
          <Link to="/student/scan" className="btn btn-ghost">Analyze another</Link>
          <Badge tone="warn">DEMO ENVIRONMENT</Badge>
        </div>
      </div>

      {}
      <div className="grid grid-split" style={{ '--split-a': 'minmax(280px, 340px)', '--split-b': 'minmax(0, 1fr)' }}>
        <Panel bracketed>
          <PanelBody>
            <RiskGauge
              score={analysis.score}
              level={analysis.level}
              band={analysis.band ?? { min: 0, max: 100 }}
              indicators={gaugeIndicators(analysis)}
              disclaimer={analysis.model?.disclaimer}
            />
          </PanelBody>
        </Panel>

        <div className="stack gap-16">
          <div className={`verdict-banner ${tone}`}>
            <div className="row gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack gap-6" style={{ minWidth: 0 }}>
                <span className="mono-label">Explainable Verdict</span>
                <h2 className="verdict-headline">{verdict.headline ?? `${analysis.level} RISK`}</h2>
              </div>
              <Badge tone={tone}>{analysis.confidence} CONFIDENCE</Badge>
            </div>
            <p className="dim" style={{ fontSize: 13.4, lineHeight: 1.65, marginTop: 12 }}>
              {verdict.summary}
            </p>
            {verdict.uncertaintyNote ? (
              <p className="mono" style={{ fontSize: 10.8, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.6 }}>
                {verdict.uncertaintyNote}
              </p>
            ) : null}
          </div>

          <Panel>
            <PanelHead title="Why did CampusShield flag this email?">
              <Badge tone={tone}>{analysis.indicators?.filter((i) => i.weight > 0).length ?? 0} INDICATORS</Badge>
            </PanelHead>
            <PanelBody className="stack gap-2">
              {(verdict.reasons ?? []).map((r, i) => (
                <div className="reason" key={i} style={{ opacity: i < revealed ? 1 : 0, animationDelay: `${i * 60}ms` }}>
                  <span className="reason-num">{i + 1}</span>
                  <span className="reason-text">{r}</span>
                </div>
              ))}
              {!(verdict.reasons ?? []).length ? (
                <p className="dim" style={{ fontSize: 13 }}>
                  No risk indicators were identified for this message.
                </p>
              ) : null}
            </PanelBody>
          </Panel>

          {}
          <Panel>
            <PanelHead title="Recommended Action" />
            <PanelBody className="stack gap-2">
              {(verdict.recommendedAction ?? []).map((a, i) => (
                <div className="action-item" key={i}>{a}</div>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </div>

      {}
      <Panel>
        <PanelHead title="Prototype Risk Model — Indicator Breakdown">
          <Badge tone="purple">{analysis.model?.version ?? 'prototype'}</Badge>
        </PanelHead>
        <PanelBody>
          <p className="dim" style={{ fontSize: 12.5, marginBottom: 14, lineHeight: 1.6 }}>
            Every indicator that contributed to the score, with its documented weight. The raw sum is
            shown for auditability; the headline score saturates so it stays comparable between messages.
          </p>
          <div className="grid grid-2" style={{ gap: '0 26px' }}>
            {(analysis.indicators ?? []).map((ind) => (
              <div className="breakdown-row" key={ind.id} title={ind.detail}>
                <span
                  className="breakdown-weight"
                  style={{ color: ind.weight > 0 ? 'var(--red)' : 'var(--green)' }}
                >
                  {ind.weight > 0 ? `+${ind.weight}` : ind.weight}
                </span>
                <span className="stack" style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ color: 'var(--text)', fontSize: 12.8 }}>{ind.label}</span>
                  <span className="dim" style={{ fontSize: 11.8, lineHeight: 1.55 }}>{ind.detail}</span>
                </span>
              </div>
            ))}
          </div>
          {!(analysis.indicators ?? []).length ? (
            <span className="dim" style={{ fontSize: 13 }}>No indicators contributed to this assessment.</span>
          ) : null}
          <div
            className="row gap-12"
            style={{ justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}
          >
            <span className="mono-label">Raw indicator weight</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
              {(analysis.scoreBreakdown ?? []).reduce((s, i) => s + i.weight, 0)}
            </span>
          </div>
        </PanelBody>
      </Panel>

      {}
      <div className="stack gap-14">
        <div className="row gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="stack gap-4">
            <span className="eyebrow">Security Modules</span>
            <h2 className="h2" style={{ fontSize: '1.3rem' }}>Individual security checks</h2>
          </div>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
            7 checks · deterministic rule model
          </span>
        </div>
        <div className="grid grid-checks">
          {(analysis.checks ?? []).map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
        </div>
      </div>

      {}
      <div className="grid grid-2">
        <Panel bracketed>
          <PanelHead title="Verify with College">
            <Badge tone="cyan">TRUST ANCHOR</Badge>
          </PanelHead>
          <PanelBody className="stack gap-14">
            <p className="dim" style={{ fontSize: 13, lineHeight: 1.65 }}>
              Compare the claim in this email against the institution's verified announcement record —
              the announcements the institution actually published.
            </p>

            {!verification ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={runVerification} disabled={verifying}>
                {verifying ? 'Checking official record…' : 'Verify with College'}
              </button>
            ) : (
              <div className="stack gap-14">
                <div
                  className={`verdict-banner ${verification.outcome === 'VERIFIED' ? 'safe' : verification.outcome === 'PARTIAL' ? 'warn' : 'danger'}`}
                >
                  <div className="row gap-10" style={{ alignItems: 'center' }}>
                    <Dot tone={verification.outcome === 'VERIFIED' ? 'safe' : verification.outcome === 'PARTIAL' ? 'warn' : 'danger'} pulse />
                    <h3 className="verdict-headline" style={{ fontSize: '1.1rem' }}>{verification.headline}</h3>
                  </div>
                  <p className="dim" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>{verification.message}</p>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 8 }}>
                    Best match confidence: {verification.matchScore}% · engine {verification.engine?.mode}
                  </div>
                </div>

                {verification.record ? (
                  <div className="stack gap-2">
                    <span className="mono-label">Official record</span>
                    <KV label="Title" value={verification.record.title} mono={false} />
                    <KV label="Department" value={verification.record.department} mono={false} />
                    <KV label="Type" value={verification.record.announcement_type} mono={false} />
                    <KV label="Official sender" value={verification.record.official_sender} />
                    <KV label="Official URL" value={verification.record.official_url} />
                    <KV label="Published" value={verification.record.publication_date} />
                  </div>
                ) : null}

                {verification.mismatches?.length ? (
                  <Alert tone="warn" title="Mismatches against the verified record">
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {verification.mismatches.map((m, i) => (
                        <li key={i} style={{ fontSize: 12.5, lineHeight: 1.6 }}>{m}</li>
                      ))}
                    </ul>
                  </Alert>
                ) : null}

                {verification.reasons?.length ? (
                  <div className="stack gap-5">
                    <span className="mono-label">Matching signals</span>
                    {verification.reasons.map((r, i) => (
                      <span key={i} className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                        • {r}
                      </span>
                    ))}
                  </div>
                ) : null}

                <Alert tone={verification.outcome === 'VERIFIED' ? 'safe' : 'warn'} title="Recommended action">
                  {verification.recommendation}
                </Alert>

                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setVerification(null)} style={{ alignSelf: 'flex-start' }}>
                  Re-run verification
                </button>
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title="Report to Campus Security" />
          <PanelBody className="stack gap-14">
            <p className="dim" style={{ fontSize: 13, lineHeight: 1.65 }}>
              Submitting this report adds the message, its indicators and its risk assessment to the
              Security Operations queue, where an analyst can triage it.
            </p>

            {reported ? (
              <div className="terminal">
                <div className="terminal-head">
                  <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-mute)' }}>
                    SYSTEM
                  </span>
                </div>
                <div className="terminal-body">
                  <div className="term-line"><span className="term-time">[+]</span><span className="term-msg term-ok">Threat report successfully submitted.</span></div>
                  <div className="term-line"><span className="term-time">[+]</span><span className="term-msg">Incident ID: {reported.incidentId}</span></div>
                  <div className="term-line"><span className="term-time">[+]</span><span className="term-msg">Status: {reported.status}</span></div>
                  <div className="term-line"><span className="term-time">[+]</span><span className="term-msg">Queue: Security Operations — Threat Queue</span></div>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className="btn btn-danger btn-lg" onClick={submitReport} disabled={reporting}>
                  {reporting ? 'Submitting…' : 'Report Suspicious Email'}
                </button>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                  Reported as: {session?.email ?? 'demo.student@northstaruniversity.edu'}
                </span>
              </>
            )}

            {reported ? (
              <div className="row gap-10 wrap">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/admin/threats')}>
                  View in Security Operations →
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/student/reports')}>
                  My Reports
                </button>
              </div>
            ) : null}

            <Alert tone="cyan" title="What happens next">
              Reports are stored in the prototype database with the indicators that triggered them.
              No email is forwarded, and no real incident system is contacted.
            </Alert>
          </PanelBody>
        </Panel>
      </div>

      {}
      <div className="grid grid-2">
        <Panel>
          <PanelHead title="Submitted Email">
            <Badge tone="neutral">{email.source === 'eml' ? '.EML' : 'PASTED'}</Badge>
          </PanelHead>
          <PanelBody className="stack gap-10">
            <KV label="From" value={email.from} />
            <KV label="To" value={email.to} />
            <KV label="Subject" value={email.subject} mono={false} />
            <KV label="Claimed department" value={email.claimedDepartment || 'not stated'} mono={false} />
            <KV label="Claimed type" value={email.claimedType || 'not stated'} mono={false} />
            {email.links?.length ? (
              <div className="stack gap-5">
                <span className="mono-label">Links ({email.links.length})</span>
                {email.links.map((l, i) => (
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', wordBreak: 'break-all' }} key={i}>
                    {l}
                  </span>
                ))}
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                  Displayed only — never opened by the prototype.
                </span>
              </div>
            ) : null}
            <div className="stack gap-5" style={{ marginTop: 6 }}>
              <span className="mono-label">Body</span>
              <pre
                className="mono"
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  color: 'var(--text-dim)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: 12,
                  maxHeight: 280,
                  overflowY: 'auto',
                  margin: 0,
                }}
              >
                {email.body}
              </pre>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title="Analysis Log">
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
              TERMINAL DETAIL
            </span>
          </PanelHead>
          <div className="terminal" style={{ border: 'none', borderRadius: 0 }}>
            <div className="terminal-body" style={{ maxHeight: 460 }}>
              {(analysis.analysisLog ?? []).map((l, i) => (
                <div className={`term-line term-${l.level ?? 'info'}`} key={i}>
                  <span className="term-time">[{l.time}]</span>
                  <span className="term-msg">{l.message}</span>
                </div>
              ))}
              <div className="term-line">
                <span className="term-time">[--:--:--]</span>
                <span className="term-msg cursor" />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {}
      <Panel>
        <PanelHead title="Institutional Context Detail">
          <StatusBadge status={analysis.contextMatch?.status ?? 'UNKNOWN'} />
        </PanelHead>
        <PanelBody className="grid grid-2" style={{ gap: 18 }}>
          <div className="stack gap-2">
            <span className="mono-label">Closest verified record</span>
            {analysis.contextMatch?.best ? (
              <>
                <KV label="Title" value={analysis.contextMatch.best.title} mono={false} />
                <KV label="Department" value={analysis.contextMatch.best.department} mono={false} />
                <KV label="Official sender" value={analysis.contextMatch.best.official_sender} />
                <KV label="Official URL" value={analysis.contextMatch.best.official_url} />
                <KV label="Match confidence" value={`${analysis.contextMatch.best.score}%`} />
              </>
            ) : (
              <span className="dim" style={{ fontSize: 12.8, marginTop: 6 }}>
                No verified announcement corresponded to the claim in this message.
              </span>
            )}
          </div>
          <div className="stack gap-2">
            <span className="mono-label">Other candidate records considered</span>
            {(analysis.contextMatch?.candidates ?? []).length ? (
              analysis.contextMatch.candidates.map((c) => (
                <KV key={c.id} label={`${c.score}%`} value={`${c.title} — ${c.department}`} mono={false} />
              ))
            ) : (
              <span className="dim" style={{ fontSize: 12.8, marginTop: 6 }}>No candidates were close enough to list.</span>
            )}
          </div>
        </PanelBody>
      </Panel>

      {}
      <Alert tone="cyan" title="Prototype limitation">
        {analysis.model?.disclaimer} Simulated SPF/DKIM/DMARC values and threat-intelligence reputation
        values are generated by the prototype and are clearly labelled as simulated wherever they appear.
      </Alert>

      <div className="row gap-10 wrap">
        <Link to="/student/scan" className="btn">Analyze another email</Link>
        <Link to="/threat-intelligence" className="btn btn-ghost">Threat Intelligence</Link>
      </div>
    </div>
  );
}
