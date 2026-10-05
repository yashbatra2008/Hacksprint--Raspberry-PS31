import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { Alert, Badge, Dot, Field, Loading, Panel, PanelBody, PanelHead, KV } from '../components/ui.jsx';
import { prettyDate } from '../lib/format.js';

const EMPTY = { from: '', subject: '', body: '', claimedDepartment: '', claimedType: '' };

export default function Verification() {
  const { push } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [announcements, setAnnouncements] = useState(null);
  const [demos, setDemos] = useState([]);

  useEffect(() => {
    let alive = true;
    api.verifiedAnnouncements().then((d) => alive && setAnnouncements(d)).catch(() => {});
    api.demoEmails().then((d) => alive && setDemos(d.emails)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const verify = async (e) => {
    e?.preventDefault?.();
    if (!form.from && !form.subject && !form.body) {
      push({ tone: 'warn', title: 'SYSTEM', message: 'Provide at least a sender, subject or body to verify a claim.' });
      return;
    }
    setBusy(true);
    try {
      const res = await api.verifyAnnouncement(form);
      setResult(res.verification);
      push({
        tone: res.verification.outcome === 'VERIFIED' ? 'safe' : res.verification.outcome === 'PARTIAL' ? 'warn' : 'danger',
        title: 'VERIFICATION COMPLETE',
        message: res.verification.headline,
      });
    } catch (err) {
      push({ tone: 'danger', title: 'SYSTEM', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const loadDemo = (demo) => {
    setForm({
      from: demo.email.from,
      subject: demo.email.subject,
      body: demo.email.body,
      claimedDepartment: demo.email.claimedDepartment ?? '',
      claimedType: demo.email.claimedAnnouncementType ?? '',
    });
    setResult(null);
  };

  const tone = result?.outcome === 'VERIFIED' ? 'safe' : result?.outcome === 'PARTIAL' ? 'warn' : 'danger';

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Trust Verification</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>Verify with College</h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 760 }}>
            Check whether a claimed course, placement drive, scholarship or notice exists in the
            institution's verified announcement record.
          </p>
        </div>
        <Badge tone="warn">DEMO ENVIRONMENT</Badge>
      </div>

      <div className="grid grid-2">
        <Panel bracketed>
          <PanelHead title="Claim to Verify" />
          <PanelBody className="stack gap-14">
            <Field label="Quick fill from a demo scenario">
              <select className="select" defaultValue="" onChange={(e) => loadDemo(demos.find((d) => d.id === e.target.value) ?? {})}>
                <option value="">— select a scenario —</option>
                {demos.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Sender">
              <input className="input" value={form.from} onChange={set('from')} placeholder="training@northstaruniversity.edu" spellCheck={false} />
            </Field>
            <Field label="Subject">
              <input className="input" value={form.subject} onChange={set('subject')} placeholder="Official AI Certification Programme — Student Registration" spellCheck={false} />
            </Field>
            <Field label="Message body">
              <textarea className="textarea" value={form.body} onChange={set('body')} placeholder="Paste the body of the message…" spellCheck={false} />
            </Field>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <Field label="Claimed department" hint="optional">
                <input className="input" value={form.claimedDepartment} onChange={set('claimedDepartment')} placeholder="Training and Development" />
              </Field>
              <Field label="Claimed type" hint="optional">
                <input className="input" value={form.claimedType} onChange={set('claimedType')} placeholder="Certification Programme" />
              </Field>
            </div>

            <div className="row gap-10 wrap">
              <button type="button" className="btn btn-primary btn-lg" onClick={verify} disabled={busy}>
                {busy ? 'Checking official record…' : 'Verify Claim'}
              </button>
              <button
                type="button"
                className="btn btn-lg btn-ghost"
                onClick={() => {
                  setForm(EMPTY);
                  setResult(null);
                }}
              >
                Clear
              </button>
            </div>
          </PanelBody>
        </Panel>

        <div className="stack gap-16">
          {result ? (
            <>
              <div className={`verdict-banner ${tone}`}>
                <div className="row gap-10" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="row gap-10" style={{ alignItems: 'center' }}>
                    <Dot tone={tone} pulse />
                    <h2 className="verdict-headline">{result.headline}</h2>
                  </div>
                  <Badge tone={tone}>{result.matchScore}% MATCH</Badge>
                </div>
                <p className="dim" style={{ fontSize: 13.4, marginTop: 12, lineHeight: 1.65 }}>{result.message}</p>
              </div>

              {result.record ? (
                <Panel>
                  <PanelHead title="Official Announcement Record" />
                  <PanelBody className="stack gap-2">
                    <KV label="Title" value={result.record.title} mono={false} />
                    <KV label="Department" value={result.record.department} mono={false} />
                    <KV label="Type" value={result.record.announcement_type} mono={false} />
                    <KV label="Official sender" value={result.record.official_sender} />
                    <KV label="Official domain" value={result.record.official_domain} />
                    <KV label="Official URL" value={result.record.official_url} />
                    <KV label="Published" value={prettyDate(result.record.publication_date)} />
                    {result.record.description ? (
                      <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.65, marginTop: 10 }}>
                        {result.record.description}
                      </p>
                    ) : null}
                  </PanelBody>
                </Panel>
              ) : null}

              {result.mismatches?.length ? (
                <Alert tone="warn" title="What differs from the verified record">
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {result.mismatches.map((m, i) => (
                      <li key={i} style={{ fontSize: 12.5, lineHeight: 1.6 }}>{m}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}

              {result.reasons?.length ? (
                <Panel>
                  <PanelHead title="Matching Signals" />
                  <PanelBody className="stack gap-5">
                    {result.reasons.map((r, i) => (
                      <span key={i} className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                        • {r}
                      </span>
                    ))}
                  </PanelBody>
                </Panel>
              ) : null}

              {result.candidates?.length ? (
                <Panel>
                  <PanelHead title="Closest Records Considered" />
                  <PanelBody className="stack gap-2">
                    {result.candidates.map((c) => (
                      <KV key={c.id} label={`${c.score}%`} value={`${c.title} — ${c.department}`} mono={false} />
                    ))}
                  </PanelBody>
                </Panel>
              ) : null}

              <Alert tone={tone} title="Recommended action">
                {result.recommendation}
              </Alert>

              <Link to="/student/scan" className="btn btn-ghost">Run a full email analysis →</Link>
            </>
          ) : (
            <Panel>
              <PanelHead title="How Verification Works" />
              <PanelBody className="stack gap-14">
                <div className="stack gap-8">
                  <span className="row gap-8"><Dot tone="safe" /><span className="mono" style={{ fontSize: 11.5, color: 'var(--green)', letterSpacing: '0.08em' }}>VERIFIED ANNOUNCEMENT</span></span>
                  <p className="dim" style={{ fontSize: 12.8, lineHeight: 1.6 }}>
                    The claim corresponds to a record in the verified institutional database, from the
                    official sender and with the official destination link.
                  </p>
                </div>
                <div className="stack gap-8">
                  <span className="row gap-8"><Dot tone="warn" /><span className="mono" style={{ fontSize: 11.5, color: 'var(--amber)', letterSpacing: '0.08em' }}>PARTIAL MATCH</span></span>
                  <p className="dim" style={{ fontSize: 12.8, lineHeight: 1.6 }}>
                    A similar announcement exists, but the sender or the destination link differs from
                    the verified record. This is what a compromised institutional mailbox looks like.
                  </p>
                </div>
                <div className="stack gap-8">
                  <span className="row gap-8"><Dot tone="danger" /><span className="mono" style={{ fontSize: 11.5, color: 'var(--red)', letterSpacing: '0.08em' }}>NO VERIFIED MATCH</span></span>
                  <p className="dim" style={{ fontSize: 12.8, lineHeight: 1.6 }}>
                    Nothing in the verified record corresponds to the claim. Do not use any link in the
                    message — verify through the official student portal instead.
                  </p>
                </div>

                <div className="stack gap-8" style={{ paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
                  <span className="mono-label">Verified announcement database</span>
                  {announcements ? (
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      {announcements.count} verified records available for matching
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>loading…</span>
                  )}
                </div>
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>

      {/* ---------------------------------------------- announcement database */}
      <Panel>
        <PanelHead title="Verified Announcement Database">
          <Badge tone="safe">{announcements?.count ?? '—'} RECORDS</Badge>
        </PanelHead>
        {announcements ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Official Sender</th>
                  <th>Published</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {announcements.announcements.map((a) => (
                  <tr key={a.id}>
                    <td style={{ color: 'var(--text)', maxWidth: 320 }}>{a.title}</td>
                    <td>{a.department}</td>
                    <td><Badge tone="neutral">{a.announcement_type}</Badge></td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{a.official_sender}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{a.publication_date}</td>
                    <td><Badge tone="safe">{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Loading label="LOADING VERIFIED ANNOUNCEMENTS" />
        )}
      </Panel>
    </div>
  );
}
