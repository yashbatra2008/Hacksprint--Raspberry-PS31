import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import {
  Alert, Badge, Dot, EmptyState, ErrorState, Loading, Panel, PanelBody, PanelHead,
} from '../components/ui.jsx';
import { prettyDateTime, toneForLevel, toneForStatus } from '../lib/format.js';

const OPEN_STATUSES = ['investigating', 'reported', 'escalated'];

export default function MyReports({ session }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api
      .threats()
      .then((d) => {
        setRows(d.threats);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const mine = (rows ?? []).filter(
    (r) => !session?.email || r.reportedBy === session.email || String(r.incidentId ?? '').startsWith('INC-'),
  );

  const openCount = mine.filter((r) => OPEN_STATUSES.includes(r.status)).length;

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Student Protection Center</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>My Reports</h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 720 }}>
            Emails you have submitted to Campus Security, and what Security Operations did with them.
          </p>
        </div>
        <div className="row gap-10 wrap">
          <Link to="/student/scan" className="btn btn-primary">Analyze an email</Link>
          <button type="button" className="btn btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="grid grid-kpi">
        {[
          { label: 'Reports Filed', value: mine.length, tone: 'cyan' },
          { label: 'Open Incidents', value: openCount, tone: 'warn' },
          { label: 'Awaiting Triage', value: mine.filter((r) => r.status === 'investigating').length, tone: 'danger' },
          { label: 'Closed / Reviewed', value: mine.filter((r) => ['reviewed', 'false-positive', 'closed'].includes(r.status)).length, tone: 'safe' },
        ].map((k) => (
          <Panel key={k.label} className="kpi" interactive>
            <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
              <span className="mono-label">{k.label}</span>
              <Dot tone={k.tone} />
            </div>
            <div className="kpi-value">{loading ? '—' : k.value}</div>
          </Panel>
        ))}
      </div>

      <Panel bracketed>
        <PanelHead title="Submitted Incidents">
          <Badge tone="neutral">{mine.length} TOTAL</Badge>
        </PanelHead>

        {loading ? (
          <Loading label="LOADING YOUR REPORTS" />
        ) : error ? (
          <ErrorState message={error.message} detail={error.detail} onRetry={load} />
        ) : mine.length === 0 ? (
          <EmptyState title="NO REPORTS YET" icon="⚑">
            Analyse a suspicious email and choose <strong>Report Suspicious Email</strong> — it will
            appear here and in the Security Operations queue.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Filed</th>
                  <th>Subject</th>
                  <th>Sender</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: 11.5, color: 'var(--cyan)' }}>{r.incidentId}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{prettyDateTime(r.timestamp)}</td>
                    <td style={{ color: 'var(--text)', maxWidth: 280, fontSize: 12.5 }}>{r.subject}</td>
                    <td className="mono" style={{ fontSize: 11, maxWidth: 240, wordBreak: 'break-all' }}>{r.sender}</td>
                    <td>
                      <div className="stack gap-4">
                        <Badge tone={toneForLevel(r.riskLevel)}>{r.riskLevel ?? '—'}</Badge>
                        {r.riskScore !== null ? (
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{r.riskScore}/100</span>
                        ) : null}
                      </div>
                    </td>
                    <td><Badge tone={toneForStatus(r.status)}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Alert tone="safe" title="What happens to a report">
        The message, its indicators and its prototype risk assessment are stored in the prototype
        database and become visible to Security Operations. No email is forwarded and no real incident
        system is contacted.
      </Alert>

      <div className="row gap-10 wrap">
        <Link to="/admin/threats" className="btn btn-ghost">View as Security Operations →</Link>
        <Link to="/threat-intelligence" className="btn btn-ghost">Threat Intelligence</Link>
      </div>
    </div>
  );
}
