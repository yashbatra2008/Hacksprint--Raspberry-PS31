import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { Badge, Dot, ErrorState, Loading, Panel, PanelHead } from '../components/ui.jsx';
import { prettyDateTime, toneForLevel, toneForStatus } from '../lib/format.js';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'investigating', label: 'Investigating' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'false-positive', label: 'False Positive' },
];

export default function ThreatQueue({ session }) {
  const navigate = useNavigate();
  const { push } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    api
      .threats()
      .then((d) => {
        setRows(d.threats);
        setError(null);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      return (
        String(r.subject ?? '').toLowerCase().includes(q) ||
        String(r.sender ?? '').toLowerCase().includes(q) ||
        String(r.incidentId ?? '').toLowerCase().includes(q) ||
        String(r.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, status, query]);

  const act = async (id, action, label) => {
    setBusyId(id);
    try {
      const res = await api.updateThreat(id, { action, actor: session?.email });
      push({
        tone: action === 'false_positive' ? 'warn' : action === 'escalate' ? 'danger' : 'safe',
        title: 'SYSTEM',
        message: res.message,
        lines: res.watchlistAdded ? [`[+] ${res.watchlisted} added to the watchlist`] : [],
      });
      load();
    } catch (e) {
      push({ tone: 'danger', title: 'SYSTEM', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const base = { all: rows?.length ?? 0 };
    for (const r of rows ?? []) base[r.status] = (base[r.status] ?? 0) + 1;
    return base;
  }, [rows]);

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Security Operations</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>Threat Queue</h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 720 }}>
            Every analysed report, with the indicators that triggered it. Triage actions update the
            incident status and are recorded in the audit trail.
          </p>
        </div>
        <div className="row gap-10 wrap">
          <span className="badge badge-danger"><Dot tone="danger" pulse />LIVE</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <ErrorState message={error.message} detail={error.detail} onRetry={load} /> : null}

      {}
      <Panel>
        <div className="row gap-12 wrap" style={{ padding: '13px 16px', justifyContent: 'space-between' }}>
          <div className="row gap-4 wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm${status === f.id ? ' btn-primary' : ' btn-ghost'}`}
                onClick={() => setStatus(f.id)}
              >
                {f.label}
                <span className="mono" style={{ fontSize: 10, opacity: 0.75 }}>{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ maxWidth: 320, minWidth: 200 }}
            placeholder="Search subject, sender, incident id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Panel>

      {}
      <Panel>
        <PanelHead title="Incidents">
          <Badge tone="neutral">{filtered?.length ?? 0} SHOWN</Badge>
        </PanelHead>

        {!filtered ? (
          <Loading label="LOADING THREAT QUEUE" />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <span className="mono-label">NO MATCHING INCIDENTS</span>
            <p className="dim" style={{ fontSize: 13, marginTop: 8 }}>
              Adjust the filters, or file a report from the student console to see it appear here.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Incident</th>
                  <th>Subject</th>
                  <th>Sender</th>
                  <th>Risk</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/admin/threats/${t.id}`)}>
                    <td className="mono" style={{ fontSize: 11 }} title={prettyDateTime(t.timestamp)}>
                      {String(t.timestamp).slice(11, 16)}
                    </td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>{t.incidentId}</td>
                    <td style={{ color: 'var(--text)', maxWidth: 250, fontSize: 12.5 }}>{t.subject}</td>
                    <td className="mono" style={{ fontSize: 11, maxWidth: 230, wordBreak: 'break-all' }}>{t.sender}</td>
                    <td>
                      <div className="stack gap-4">
                        <Badge tone={toneForLevel(t.riskLevel)}>{t.riskLevel ?? '—'}</Badge>
                        {t.riskScore !== null ? (
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{t.riskScore}/100</span>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{t.category}</td>
                    <td><Badge tone={toneForStatus(t.status)}>{t.status}</Badge></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          title="Mark reviewed"
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, 'review')}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          title="Mark false positive"
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, 'false_positive')}
                        >
                          ⊘
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          title="Escalate and watchlist the sender domain"
                          disabled={busyId === t.id}
                          onClick={() => act(t.id, 'escalate')}
                        >
                          ↑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="row gap-10 wrap">
        <Link to="/admin" className="btn btn-ghost">← Back to overview</Link>
        <Link to="/admin/watchlist" className="btn btn-ghost">Sender / Domain Watchlist</Link>
      </div>
    </div>
  );
}
