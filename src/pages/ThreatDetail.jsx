import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import RiskGauge from '../components/RiskGauge.jsx';
import CheckCard from '../components/CheckCard.jsx';
import {
  Alert, Badge, Dot, ErrorState, KV, Loading, Panel, PanelBody, PanelHead, StatusBadge,
} from '../components/ui.jsx';
import { prettyDateTime, shortTime, toneForLevel, toneForStatus } from '../lib/format.js';

const TIMELINE_ICON = { detected: '◉', analyzed: '⚙', reported: '⚑', action: '✓' };

export default function ThreatDetail({ session }) {
  const { id } = useParams();
  const { push } = useToast();

  const [report, setReport] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [email, setEmail] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const threats = await api.threats();
      const found = threats.threats.find((t) => String(t.id) === String(id));
      if (!found) {
        setError(new Error(`Incident ${id} was not found in the threat queue.`));
        return;
      }
      setReport(found);
      setError(null);

      if (found.emailId) {
        const detail = await api.getEmail(found.emailId);
        setEmail(detail.email);
        setAnalysis(detail.analysis);
      } else {
        setEmail(null);
        setAnalysis(null);
      }

      const tl = await api.threatTimeline(found.id);
      setTimeline(tl.timeline);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action, label) => {
    setBusy(action);
    try {
      const res = await api.updateThreat(report.id, { action, actor: session?.email });
      push({
        tone: action === 'escalate' ? 'danger' : action === 'false_positive' ? 'warn' : 'safe',
        title: 'SYSTEM',
        message: res.message,
        lines: res.watchlistAdded ? [`[+] ${res.watchlisted} added to the sender watchlist`] : [],
      });
      await load();
    } catch (e) {
      push({ tone: 'danger', title: 'SYSTEM', message: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Panel>
        <PanelHead title="Incident Detail" />
        <Loading label="LOADING INCIDENT RECORD" />
      </Panel>
    );
  }

  if (error || !report) {
    return (
      <Panel>
       <PanelHead title="Incident Detail" />
       <ErrorState message={error?.message ?? 'Incident not found.'} detail={error?.detail} onRetry={load} />
       <PanelBody>
         <Link to="/admin/threats" className="btn btn-sm btn-ghost">← Back to threat queue</Link>
       </PanelBody>
     </Panel>
   );
 }

 const tone = toneForLevel(report.riskLevel);

 return (
   <div className="stack gap-20">
     {}
     <div className="page-head">
       <div className="stack gap-6">
         <span className="eyebrow">Incident {report.incidentId}</span>
         <h1 className="h1" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)' }}>{report.subject || '(no subject)'}</h1>
         <div className="row gap-10 wrap">
           <StatusBadge status={report.status} />
           <Badge tone={tone}>{report.riskLevel ?? 'UNSCORED'}</Badge>
           {report.riskScore !== null ? <Badge tone="neutral">{report.riskScore}/100</Badge> : null}
           <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{prettyDateTime(report.timestamp)}</span>
         </div>
       </div>
       <Link to="/admin/threats" className="btn btn-ghost">← Threat queue</Link>
     </div>

     {}
     <Panel bracketed>
       <PanelHead title="Analyst Actions">
         <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
           ACTING AS {session?.email ?? 'soc.lead@northstaruniversity.edu'}
         </span>
       </PanelHead>
       <PanelBody>
         <div className="row gap-10 wrap">
           <button type="button" className="btn btn-success" disabled={busy !== null} onClick={() => act('review', 'reviewed')}>
             {busy === 'review' ? 'Working…' : 'Mark Reviewed'}
           </button>
           <button type="button" className="btn" disabled={busy !== null} onClick={() => act('false_positive', 'false positive')}>
             {busy === 'false_positive' ? 'Working…' : 'Mark False Positive'}
           </button>
           <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={() => act('escalate', 'escalated')}>
             {busy === 'escalate' ? 'Working…' : 'Escalate'}
           </button>
           <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => act('investigate', 'investigating')}>
             Reopen Investigation
           </button>
         </div>
         <p className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 12 }}>
           Escalating also adds the sender domain to the watchlist. Every action is written to the audit trail.
         </p>
       </PanelBody>
     </Panel>

     <div className="grid grid-split" style={{ '--split-a': 'minmax(280px, 330px)', '--split-b': 'minmax(0, 1fr)' }}>
       <div className="stack gap-16">
         {analysis ? (
           <Panel>
             <PanelBody>
               <RiskGauge
                 score={analysis.score}
                 level={analysis.level}
                 band={analysis.band ?? { min: 0, max: 100 }}
                 indicators={[
                   { id: 's', label: 'SENDER', mark: analysis.checks?.find((c) => c.id === 'sender_verification')?.status === 'PASSED' ? '✓' : '✕', tone: analysis.checks?.find((c) => c.id === 'sender_verification')?.status === 'PASSED' ? 'safe' : 'danger' },
                   { id: 'c', label: 'CONTEXT', mark: analysis.contextMatch?.status === 'MATCH FOUND' ? '✓' : '✕', tone: analysis.contextMatch?.status === 'MATCH FOUND' ? 'safe' : 'danger' },
                   { id: 'l', label: 'LINK', mark: analysis.linkAnalysis?.[0]?.institutional ? '✓' : '✕', tone: analysis.linkAnalysis?.[0]?.institutional ? 'safe' : 'danger' },
                   { id: 'p', label: 'PERSONAL', mark: analysis.personalisation?.detected ? '⚠' : '✓', tone: analysis.personalisation?.detected ? 'warn' : 'safe' },
                 ]}
                 animated={false}
               />
             </PanelBody>
           </Panel>
         ) : (
           <Panel>
             <PanelHead title="Risk Assessment" />
             <PanelBody>
               <Alert tone="warn" title="No linked analysis">
                 This incident was filed without a stored analysis record, so no risk breakdown is available.
               </Alert>
             </PanelBody>
           </Panel>
         )}

         {}
         <Panel>
           <PanelHead title="Report Metadata" />
           <PanelBody className="stack gap-2">
             <KV label="Incident ID" value={report.incidentId} />
             <KV label="Status" value={report.status} status={report.status} />
             <KV label="Reported by" value={report.reportedBy} />
             <KV label="Filed at" value={prettyDateTime(report.timestamp)} />
             <KV label="Category" value={report.category} mono={false} />
             <KV label="Sender" value={report.sender} />
             {email?.to ? <KV label="Recipient" value={email.to} /> : null}
             <KV label="Source" value={email?.source === 'eml' ? '.eml upload' : 'pasted text'} mono={false} />
           </PanelBody>
         </Panel>
       </div>

       <div className="stack gap-16">
         {}
         <Panel>
           <PanelHead title="Detected Indicators">
             <Badge tone="danger">{report.detectedIndicators?.length ?? 0}</Badge>
           </PanelHead>
           <PanelBody className="stack gap-2">
             {(report.detectedIndicators ?? []).length ? (
               report.detectedIndicators.map((ind, i) => (
                 <div className="action-item" key={i}>{ind}</div>
               ))
             ) : (
               <span className="dim" style={{ fontSize: 13 }}>No indicators recorded for this report.</span>
             )}
           </PanelBody>
         </Panel>

         {}
         <Panel>
           <PanelHead title="Incident Timeline" />
           <PanelBody>
             {timeline?.length ? (
               <div className="stack gap-0">
                 {timeline.map((t, i) => (
                   <div className="row gap-12" key={i} style={{ alignItems: 'flex-start', padding: '9px 0', borderBottom: i < timeline.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                     <span
                       className="mono"
                       style={{
                         width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0,
                         border: '1px solid var(--line-strong)', background: 'var(--bg-panel-2)', fontSize: 11,
                         color: t.kind === 'action' ? 'var(--green)' : t.kind === 'reported' ? 'var(--amber)' : 'var(--cyan)',
                       }}
                       aria-hidden="true"
                     >
                       {TIMELINE_ICON[t.kind] ?? '•'}
                     </span>
                     <div className="stack gap-2" style={{ minWidth: 0 }}>
                       <span style={{ fontSize: 12.8, color: 'var(--text)' }}>{t.label}</span>
                       <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                         {prettyDateTime(t.at)}
                       </span>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <span className="dim" style={{ fontSize: 13 }}>No timeline entries yet.</span>
             )}
           </PanelBody>
         </Panel>

         {}
         {email ? (
           <Panel>
             <PanelHead title="Submitted Email">
               <Badge tone="neutral">{email.from}</Badge>
             </PanelHead>
             <PanelBody className="stack gap-10">
               <KV label="Subject" value={email.subject} mono={false} />
               {email.links?.length ? (
                 <div className="stack gap-5">
                   <span className="mono-label">Links ({email.links.length}) — displayed only, never opened</span>
                   {email.links.map((l, i) => (
                     <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', wordBreak: 'break-all' }} key={i}>{l}</span>
                   ))}
                 </div>
               ) : null}
               <pre
                 className="mono"
                 style={{
                   fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-dim)', whiteSpace: 'pre-wrap',
                   wordBreak: 'break-word', background: 'var(--bg-input)', border: '1px solid var(--line)',
                   borderRadius: 6, padding: 12, maxHeight: 320, overflowY: 'auto', margin: 0,
                 }}
               >
                 {email.body}
               </pre>
             </PanelBody>
           </Panel>
         ) : null}
       </div>
     </div>

     {}
     {analysis?.checks?.length ? (
       <div className="stack gap-14">
         <div className="stack gap-4">
           <span className="eyebrow">Analysis Detail</span>
           <h2 className="h2" style={{ fontSize: '1.25rem' }}>Security checks</h2>
         </div>
         <div className="grid grid-checks">
           {analysis.checks.map((c) => (
             <CheckCard key={c.id} check={c} />
           ))}
         </div>
       </div>
     ) : null}

     {}
     {analysis?.contextMatch ? (
       <Panel>
         <PanelHead title="Institutional Verification">
           <StatusBadge status={analysis.contextMatch.status} />
         </PanelHead>
         <PanelBody className="stack gap-2">
           {analysis.contextMatch.best ? (
             <>
               <KV label="Closest verified record" value={analysis.contextMatch.best.title} mono={false} />
               <KV label="Department" value={analysis.contextMatch.best.department} mono={false} />
               <KV label="Official sender" value={analysis.contextMatch.best.official_sender} />
               <KV label="Official URL" value={analysis.contextMatch.best.official_url} />
               <KV label="Match confidence" value={`${analysis.contextMatch.best.score}%`} />
             </>
           ) : (
             <span className="dim" style={{ fontSize: 13 }}>
               No verified announcement corresponded to the claim in this message.
             </span>
           )}
         </PanelBody>
       </Panel>
     ) : null}

     {}
     {analysis?.analysisLog?.length ? (
       <Panel>
         <PanelHead title="Analysis Log" />
         <div className="terminal" style={{ border: 'none', borderRadius: 0 }}>
           <div className="terminal-body" style={{ maxHeight: 340 }}>
             {analysis.analysisLog.map((l, i) => (
               <div className={`term-line term-${l.level ?? 'info'}`} key={i}>
                 <span className="term-time">[{l.time}]</span>
                 <span className="term-msg">{l.message}</span>
               </div>
             ))}
           </div>
         </div>
       </Panel>
     ) : null}

     <Alert tone="cyan" title="Prototype limitation">
       Simulated authentication and threat-intelligence values shown here are generated by the
       prototype. They do not come from live mail headers, DNS lookups or a commercial threat feed.
     </Alert>
   </div>
 );
}
