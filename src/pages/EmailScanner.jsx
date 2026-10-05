import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Dot, Field, Panel, PanelBody, PanelHead } from '../components/ui.jsx';

const SCAN_STEPS = [
  { id: 'init', label: 'INITIALIZING ANALYSIS ENGINE' },
  { id: 'sender', label: 'CHECKING SENDER' },
  { id: 'auth', label: 'CHECKING AUTHENTICATION' },
  { id: 'domain', label: 'CHECKING DOMAIN' },
  { id: 'content', label: 'ANALYZING CONTENT' },
  { id: 'links', label: 'CHECKING LINKS' },
  { id: 'context', label: 'VERIFYING CONTEXT' },
  { id: 'personal', label: 'CHECKING PERSONALIZATION' },
  { id: 'score', label: 'COMPUTING RISK SCORE' },
];

const EMPTY = {
  from: '',
  to: 'alex.kumar@northstaruniversity.edu',
  subject: '',
  body: '',
  links: '',
  claimedDepartment: '',
  claimedType: '',
};

function meter(pct, width = 18) {
  const filled = Math.round((pct / 100) * width);
  return (
    <>
      <span>[</span>
      <span>{'█'.repeat(filled)}</span>
      <span className="scan-meter-empty">{'░'.repeat(Math.max(0, width - filled))}</span>
      <span>] {String(Math.round(pct)).padStart(3, ' ')}%</span>
    </>
  );
}

export default function EmailScanner({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();

  const [tab, setTab] = useState(location.state?.autorun ? 'paste' : new URLSearchParams(location.search).get('tab') === 'eml' ? 'eml' : 'form');
  const [form, setForm] = useState(EMPTY);
  const [emlRaw, setEmlRaw] = useState('');
  const [demos, setDemos] = useState([]);
  const [demoId, setDemoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [stepResults, setStepResults] = useState({});
  const [pct, setPct] = useState(0);

  const resultRef = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    let alive = true;
    api
      .demoEmails()
      .then((d) => {
        if (alive) setDemos(d.emails);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const loadDemo = useCallback((demo) => {
    if (!demo) return;
    setForm({
      from: demo.email.from ?? '',
      to: demo.email.to ?? EMPTY.to,
      subject: demo.email.subject ?? '',
      body: demo.email.body ?? '',
      links: (demo.email.links ?? []).join('\n'),
      claimedDepartment: demo.email.claimedDepartment ?? '',
      claimedType: demo.email.claimedAnnouncementType ?? '',
    });
    setDemoId(demo.id);
    setError(null);
  }, []);

  useEffect(() => {
    const demo = location.state?.demo;
    if (!demo) return;
    loadDemo(demo);
    if (location.state?.autorun) {

      const t = setTimeout(() => document.getElementById('analyze-btn')?.click(), 420);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location.state, loadDemo]);

  const payload = useMemo(() => {
    if (tab === 'eml') return null;
    return {
      from: form.from.trim(),
      to: form.to.trim(),
      subject: form.subject.trim(),
      body: form.body.trim(),
      links: form.links
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      claimedDepartment: form.claimedDepartment.trim(),
      claimedType: form.claimedType.trim(),
      studentId: session?.studentId,
      source: 'paste',
      submittedBy: session?.email,
    };
  }, [tab, form, session]);

  const canSubmit = tab === 'eml' ? emlRaw.trim().length > 20 : Boolean(form.from.trim() && (form.body.trim() || form.subject.trim()));

  const runScanAnimation = () =>
    new Promise((resolve) => {
      clearTimers();
      setScanning(true);
      setStepIndex(0);
      setStepResults({});
      setPct(0);

      const stepMs = 170;
      SCAN_STEPS.forEach((s, i) => {
        const t = setTimeout(() => {
          setStepIndex(i);
          setPct(Math.round(((i + 1) / SCAN_STEPS.length) * 96));
        }, i * stepMs);
        timers.current.push(t);
      });
      const done = setTimeout(resolve, SCAN_STEPS.length * stepMs);
      timers.current.push(done);
    });

  const applyResults = (result) => {
    const byId = Object.fromEntries((result.checks ?? []).map((c) => [c.id, c]));
    const mark = (check) => {
      if (!check) return { text: 'UNKNOWN', tone: 'warn' };
      const status = String(check.status).toUpperCase();
      if (status === 'PASSED' || status === 'MATCH FOUND' || status === 'CONSISTENT' || status === 'TRUSTED') {
        return { text: 'PASS', tone: 'safe' };
      }
      if (status === 'FAILED' || status === 'MALICIOUS' || status === 'INCONSISTENT' || status === 'NO MATCH FOUND') {
        return { text: 'FAIL', tone: 'danger' };
      }
      if (status === 'DETECTED' || status === 'INDICATORS DETECTED') return { text: 'DETECTED', tone: 'warn' };
      if (status === 'NOT DETECTED' || status === 'NONE DETECTED') return { text: 'CLEAR', tone: 'safe' };
      return { text: status, tone: 'warn' };
    };

    const sender = byId.sender_verification;
    const auth = byId.email_authentication;
    const domain = byId.link_analysis;
    const context = byId.institutional_context;
    const social = byId.social_engineering;
    const personal = byId.student_information;

    setStepResults({
      init: { text: 'READY', tone: 'cyan' },
      sender: mark(sender),
      auth: auth?.simulated ? { text: `${auth.fields?.[0]?.value ?? 'UNKNOWN'}`, tone: auth.status === 'PASSED' ? 'safe' : 'warn' } : mark(auth),
      domain: mark(domain),
      content: social?.status === 'INDICATORS DETECTED' ? { text: 'INDICATORS', tone: 'warn' } : { text: 'CLEAR', tone: 'safe' },
      links: mark(domain),
      context: mark(context),
      personal: personal?.status === 'DETECTED' ? { text: 'DETECTED', tone: 'warn' } : { text: 'CLEAR', tone: 'safe' },
      score: { text: `${result.score}/100 ${result.level}`, tone: result.level === 'LOW' ? 'safe' : result.level === 'MEDIUM' ? 'warn' : 'danger' },
    });
    setPct(100);
  };

  const analyze = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);

    try {
      let request;
      if (tab === 'eml') {
        const parsed = await api.parseEml(emlRaw);
        request = api.analyzeEmail({
          from: parsed.email.from,
          to: parsed.email.to,
          subject: parsed.email.subject,
          body: parsed.email.body,
          links: parsed.email.links,
          source: 'eml',
          studentId: session?.studentId,
          submittedBy: session?.email,
        });
      } else {
        request = api.analyzeEmail(payload);
      }

      const [response] = await Promise.all([request, runScanAnimation()]);
      resultRef.current = response;
      applyResults(response.result);

      setTimeout(() => {
        setScanning(false);
        push({
          tone: response.result.level === 'LOW' ? 'safe' : 'danger',
          title: 'ANALYSIS COMPLETE',
          message: `${response.result.level} risk · Prototype Risk Score ${response.result.score}/100`,
          lines: [`Analysis ID: ANL-${String(response.analysisId).padStart(6, '0')}`],
        });
        navigate(`/student/analysis/${response.analysisId}`);
      }, 900);
    } catch (err) {
      clearTimers();
      setScanning(false);
      setError(err);
      push({ tone: 'danger', title: 'SYSTEM', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setEmlRaw('');
    setDemoId('');
    setError(null);
    setStepResults({});
    setStepIndex(-1);
    setPct(0);
  };

  const selectedDemo = demos.find((d) => d.id === demoId);

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Email Threat Analyzer</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>
            <span className="mono" style={{ color: 'var(--cyan)' }}>&gt;</span> Analyze an incoming message
          </h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 760 }}>
            Paste the email exactly as you received it. Nothing is sent anywhere and no link is opened.
          </p>
        </div>
        <Badge tone="warn">DEMO ENVIRONMENT</Badge>
      </div>

      {error ? (
        <Alert tone="danger" title="Analysis could not be completed">
          {error.message}
          {error.detail ? <div className="mono" style={{ fontSize: 11, marginTop: 4 }}>{String(error.detail).slice(0, 200)}</div> : null}
        </Alert>
      ) : null}

      <div className="scan-grid">
        {}
        <Panel bracketed>
          <PanelHead title="Email Contents">
            <div className="row gap-4">
              {[
                ['form', 'Structured'],
                ['paste', 'Raw paste'],
                ['eml', '.eml upload'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-sm${tab === key ? ' btn-primary' : ' btn-ghost'}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </PanelHead>

          <PanelBody className="stack gap-16">
            {}
            <Field label="Use Demo Email" hint="fictional scenarios">
              <select
                className="select"
                value={demoId}
                onChange={(e) => {
                  setDemoId(e.target.value);
                  loadDemo(demos.find((d) => d.id === e.target.value));
                }}
              >
                <option value="">— select a preconfigured scenario —</option>
                {demos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>

            {selectedDemo ? (
              <Alert tone={selectedDemo.tag === 'safe' ? 'safe' : selectedDemo.tag === 'attack' ? 'danger' : 'warn'} title={selectedDemo.expected}>
                {selectedDemo.summary}
              </Alert>
            ) : null}

            {tab === 'eml' ? (
              <>
                <Field label="Paste raw .eml content" hint="parsed locally, never uploaded">
                  <textarea
                    className="textarea"
                    value={emlRaw}
                    onChange={(e) => setEmlRaw(e.target.value)}
                    placeholder={'From: someone@example.com\nTo: you@northstaruniversity.edu\nSubject: ...\n\nmessage body'}
                    spellCheck={false}
                  />
                </Field>
                <div className="row gap-10">
                  <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer' }}>
                    Choose .eml file
                    <input
                      type="file"
                      accept=".eml,message/rfc822,text/plain"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 512 * 1024) {
                          push({ tone: 'warn', title: 'SYSTEM', message: 'File is larger than the 512 KB prototype limit.' });
                          return;
                        }
                        setEmlRaw(await file.text());
                        push({ tone: 'info', title: 'SYSTEM', message: `${file.name} loaded into the parser.` });
                      }}
                    />
                  </label>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', alignSelf: 'center' }}>
                    Max 512 KB · parsed in the browser-to-server request only
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <Field label="From">
                    <input className="input" value={form.from} onChange={set('from')} placeholder="courses@example.com" spellCheck={false} />
                  </Field>
                  <Field label="To">
                    <input className="input" value={form.to} onChange={set('to')} placeholder="you@northstaruniversity.edu" spellCheck={false} />
                  </Field>
                </div>

                <Field label="Subject">
                  <input className="input" value={form.subject} onChange={set('subject')} placeholder="URGENT: You Have Been Selected" spellCheck={false} />
                </Field>

                <Field label="Email Body">
                  <textarea className="textarea" value={form.body} onChange={set('body')} placeholder="Paste the full message body here…" spellCheck={false} />
                </Field>

                <Field label="Links" hint="one per line — auto-detected from the body too">
                  <textarea
                    className="textarea"
                    style={{ minHeight: 78 }}
                    value={form.links}
                    onChange={set('links')}
                    placeholder="https://example.com/register"
                    spellCheck={false}
                  />
                </Field>

                {tab === 'paste' ? null : (
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <Field label="Claimed Department" hint="optional">
                      <input className="input" value={form.claimedDepartment} onChange={set('claimedDepartment')} placeholder="Training and Development" />
                    </Field>
                    <Field label="Claimed Announcement Type" hint="optional">
                      <input className="input" value={form.claimedType} onChange={set('claimedType')} placeholder="Certification Programme" />
                    </Field>
                  </div>
                )}
              </>
            )}

            <div className="row gap-10 wrap" style={{ paddingTop: 4 }}>
              <button
                id="analyze-btn"
                type="button"
                className="btn btn-primary btn-lg"
                onClick={analyze}
                disabled={!canSubmit || busy}
              >
                {busy ? 'Analyzing…' : 'Analyze Email'}
              </button>
              <button type="button" className="btn btn-lg btn-ghost" onClick={reset} disabled={busy}>
                Clear
              </button>
            </div>

            {!canSubmit ? (
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                A sender address and either a subject or a body are required.
              </span>
            ) : null}
          </PanelBody>
        </Panel>

        {}
        <Panel bracketed>
          <PanelHead title="Threat Analysis">
            {scanning ? (
              <span className="row gap-6">
                <Dot tone="cyan" pulse />
                <span className="mono" style={{ fontSize: 9.5, color: 'var(--cyan)', letterSpacing: '0.12em' }}>SCANNING</span>
              </span>
            ) : (
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.12em' }}>IDLE</span>
            )}
          </PanelHead>

          <PanelBody className="stack gap-16">
            <div className="terminal">
              <div className="terminal-head">
                <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-mute)' }}>
                  ANALYSIS ENGINE
                </span>
              </div>
              <div className="terminal-body" style={{ maxHeight: 300 }}>
                <div className="scan-meter" style={{ marginBottom: 12 }}>
                  {scanning || pct > 0 ? meter(pct) : <span className="mute">awaiting submission…</span>}
                </div>

                <div className="scan-steps">
                  {SCAN_STEPS.map((step, i) => {
                    const state = !scanning && pct === 0 ? 'idle' : i < stepIndex || pct === 100 ? 'done' : i === stepIndex ? 'running' : 'idle';
                    const res = stepResults[step.id];
                    return (
                      <div key={step.id} className={`scan-step ${state}`}>
                        <span className="scan-step-label">{step.label}</span>
                        <span className="scan-dots">{'.'.repeat(Math.max(3, 30 - step.label.length))}</span>
                        <span
                          className="scan-step-result"
                          style={{
                            color:
                              res?.tone === 'safe' ? 'var(--green)'
                              : res?.tone === 'danger' ? 'var(--red)'
                              : res?.tone === 'warn' ? 'var(--amber)'
                              : res?.tone === 'cyan' ? 'var(--cyan)'
                              : 'var(--text-faint)',
                          }}
                        >
                          {res?.text ?? (state === 'running' ? 'SCANNING' : '—')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {pct === 100 ? (
                  <div className="stack gap-2" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                    <span className="mono term-ok" style={{ fontSize: 11.5, color: 'var(--green)' }}>
                      ✓ Risk assessment complete — opening report
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      Deterministic rule model · reproducible result
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <Alert tone="cyan" title="Nothing leaves this prototype">
              Links inside a submitted email are analysed as text only. CampusShield never opens, fetches
              or resolves them, and never connects to a real mailbox.
            </Alert>

            <div className="stack gap-8">
              <span className="mono-label">Checks performed</span>
              <div className="row gap-6 wrap">
                {[
                  'Sender Verification',
                  'Authentication',
                  'Institutional Context',
                  'Link Analysis',
                  'Social Engineering',
                  'Student Information',
                  'Communication Pattern',
                ].map((c) => (
                  <span className="badge badge-neutral" key={c}>{c}</span>
                ))}
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
