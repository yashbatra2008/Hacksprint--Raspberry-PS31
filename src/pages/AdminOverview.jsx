import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar as RBar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { Badge, Dot, ErrorState, Loading, Panel, PanelBody, PanelHead } from '../components/ui.jsx';
import { shortTime, toneForLevel, toneForStatus } from '../lib/format.js';

const CATEGORY_COLORS = {
  'Institution Impersonation': '#ff4d6d',
  'Credential Phishing': '#f87171',
  'Malicious Link': '#fbbf24',
  'Social Engineering': '#a78bfa',
  'Suspicious Course Promotion': '#22d3ee',
  'Fake Placement Communication': '#60a5fa',
};

const LEVEL_COLORS = { CRITICAL: '#ff4d6d', HIGH: '#f87171', MEDIUM: '#fbbf24', LOW: '#34d399' };

export default function AdminOverview({ session }) {
  const navigate = useNavigate();
  const { push } = useToast();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .stats()
      .then((d) => {
        setStats(d);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const t = setInterval(() => {
      api.stats().then(setStats).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const resetDemo = async () => {
    setResetting(true);
    try {
      const res = await api.resetDemo();
      push({
        tone: 'warn',
        title: 'SYSTEM',
        message: 'Demo data reset.',
        lines: ['[+] Session analyses and reports cleared', '[+] Seeded incidents and watchlist restored', '[+] Verified announcements preserved'],
      });
      load();
    } catch (e) {
      push({ tone: 'danger', title: 'SYSTEM', message: e.message });
    } finally {
      setResetting(false);
    }
  };

  if (error) {
    return (
      <Panel>
        <PanelHead title="Security Operations" />
        <ErrorState message={error.message} detail={error.detail} onRetry={load} />
      </Panel>
    );
  }

  const kpis = stats?.kpis ?? {};
  const categoryData = (stats?.byCategory ?? []).map((c) => ({ name: c.category, count: c.count }));
  const levelData = (stats?.byLevel ?? []).map((l) => ({ name: l.level, value: l.count }));

  return (
    <div className="stack gap-24">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Security Operations Center</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.2rem)' }}>Threat Operations Overview</h1>
          <p className="dim" style={{ fontSize: 14 }}>
            {session?.title ?? 'Security Operations'} · {session?.email ?? 'soc@northstaruniversity.edu'}
          </p>
        </div>
        <div className="row gap-10 wrap">
          <span className="badge badge-danger">
            <Dot tone="danger" pulse />
            LIVE
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={resetDemo} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset Demo Data'}
          </button>
        </div>
      </div>

      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: -12 }}>
        {stats?.notice ?? 'Demo environment statistics — all values are fictional.'}
      </span>

      {}
      <div className="grid grid-kpi">
        {[
          { label: 'Emails Analyzed', value: kpis.emailsAnalyzed, tone: 'cyan', hint: 'Prototype-wide' },
          { label: 'High Risk Emails', value: kpis.highRiskEmails, tone: 'danger', hint: 'HIGH + CRITICAL' },
          { label: 'Impersonation Attempts', value: kpis.impersonationAttempts, tone: 'critical', hint: 'Institution impersonation' },
          { label: 'Student Reports', value: kpis.studentReports, tone: 'warn', hint: 'Filed to the queue' },
          { label: 'Verified Announcements', value: kpis.verifiedAnnouncements, tone: 'safe', hint: 'Trust anchor records' },
        ].map((k) => (
          <Panel key={k.label} className="kpi" interactive>
            <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
              <span className="mono-label">{k.label}</span>
              <Dot tone={k.tone} pulse={k.tone === 'critical' || k.tone === 'danger'} />
            </div>
            <div
              className="kpi-value"
              style={{
                color:
                  k.tone === 'safe' ? 'var(--green)'
                  : k.tone === 'danger' || k.tone === 'critical' ? 'var(--red)'
                  : 'var(--text)',
              }}
            >
              {loading ? '—' : (k.value ?? 0).toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3 }}>{k.hint}</div>
          </Panel>
        ))}
      </div>

      <div
        className="grid grid-split"
        style={{ '--split-a': 'minmax(0, 1.35fr)', '--split-b': 'minmax(300px, 1fr)', alignItems: 'stretch' }}
      >
        {}
        <Panel bracketed>
          <PanelHead title="Threat Monitor">
            <span className="row gap-6">
              <Dot tone="danger" pulse />
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--red)', letterSpacing: '0.12em' }}>LIVE FEED</span>
            </span>
          </PanelHead>
          {loading ? (
            <Loading label="CONNECTING TO THREAT ENGINE" />
          ) : (
            <div className="feed" style={{ maxHeight: 420 }}>
              {(stats?.threatMonitor ?? []).map((e) => (
                <div className="feed-item" key={e.id}>
                  <span className="feed-time">{shortTime(e.time)}</span>
                  <div className="feed-body">
                    <div className="feed-title">{e.summary}</div>
                    <div className="feed-meta">{e.category} · {e.sender}</div>
                  </div>
                  <Badge tone={toneForLevel(e.level)}>{e.level}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {}
        <Panel>
          <PanelHead title="Threat Categories" />
          <PanelBody style={{ paddingTop: 8 }}>
            {loading ? (
              <Loading label="LOADING DISTRIBUTION" />
            ) : (
              <>
                <div style={{ width: '100%', height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 4 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={{ fill: '#94a7c4', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(34,211,238,0.05)' }}
                        contentStyle={{
                          background: '#0b1220',
                          border: '1px solid #26354f',
                          borderRadius: 8,
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 11,
                          color: '#e6edf7',
                        }}
                        formatter={(v) => [`${v} events`, 'Count']}
                      />
                      <RBar dataKey="count" radius={[0, 4, 4, 0]} barSize={13}>
                        {categoryData.map((entry) => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#22d3ee'} fillOpacity={0.82} />
                        ))}
                      </RBar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="stack gap-2" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                  {categoryData.map((c) => (
                    <div className="row gap-10" key={c.name} style={{ justifyContent: 'space-between' }}>
                      <span className="row gap-8" style={{ minWidth: 0 }}>
                        <span
                          style={{
                            width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                            background: CATEGORY_COLORS[c.name] ?? '#22d3ee',
                          }}
                        />
                        <span className="dim" style={{ fontSize: 11.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{c.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid grid-2">
        {}
        <Panel>
          <PanelHead title="Risk Distribution" />
          <PanelBody>
            {loading ? (
              <Loading label="LOADING" />
            ) : (
              <div className="row gap-20 wrap" style={{ alignItems: 'center' }}>
                <div style={{ width: 180, height: 180, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={levelData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {levelData.map((entry) => (
                          <Cell key={entry.name} fill={LEVEL_COLORS[entry.name] ?? '#22d3ee'} fillOpacity={0.85} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0b1220',
                          border: '1px solid #26354f',
                          borderRadius: 8,
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 11,
                          color: '#e6edf7',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="stack gap-8 grow">
                  {levelData.map((l) => (
                    <div className="row gap-10" key={l.name} style={{ justifyContent: 'space-between' }}>
                      <span className="row gap-8">
                        <Dot tone={toneForLevel(l.name)} />
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
                          {l.name}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{l.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </PanelBody>
        </Panel>

        {}
        <Panel>
          <PanelHead title="System Health">
            <span className="row gap-6">
              <Dot tone="safe" pulse />
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--green)', letterSpacing: '0.12em' }}>NOMINAL</span>
            </span>
          </PanelHead>
          <PanelBody className="stack gap-10">
            {[
              ['Threat Engine', 'ONLINE', 'safe', 'Deterministic rule model · v' + (stats?.riskModel?.version ?? '1.2.0')],
              ['Context Engine', 'ONLINE', 'safe', 'Verified announcement matching active'],
              ['Domain Monitor', 'ONLINE', 'safe', `${kpis.verifiedDomains ?? 0} verified domains watched`],
              ['Verification', 'ONLINE', 'safe', `${kpis.verifiedAnnouncements ?? 0} announcement records loaded`],
              ['Database', 'ONLINE', 'safe', 'SQLite · local prototype store'],
              ['Watchlist', kpis.watchlistEntries ? 'ACTIVE' : 'EMPTY', 'warn', `${kpis.watchlistEntries ?? 0} monitored domains`],
              ['Threat Intel Feed', 'SIMULATED', 'warn', 'Fictional dataset — no external provider configured'],
              ['Mail Ingestion', 'DISCONNECTED', 'warn', 'No mailbox connected (by design in this prototype)'],
            ].map(([name, status, tone, note]) => (
              <div key={name} className="row gap-10" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stack gap-2" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12.8, color: 'var(--text)' }}>{name}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{note}</span>
                </div>
                <Badge tone={tone}>{status}</Badge>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>

      {}
      <Panel>
        <PanelHead title="Recent Incidents">
          <Link to="/admin/threats" className="btn btn-sm btn-ghost">Open threat queue →</Link>
        </PanelHead>
        <IncidentTable navigate={navigate} />
      </Panel>

      {}
      <Panel>
        <PanelHead title="Verified Sources">
          <Link to="/admin/settings" className="btn btn-sm btn-ghost">Manage →</Link>
        </PanelHead>
        <PanelBody className="grid grid-3" style={{ gap: 12 }}>
          <div className="stack gap-4">
            <span className="mono-label">Verified institutional domains</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--cyan)' }}>
              {kpis.verifiedDomains ?? '—'}
            </span>
          </div>
          <div className="stack gap-4">
            <span className="mono-label">Verified announcements</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
              {kpis.verifiedAnnouncements ?? '—'}
            </span>
          </div>
          <div className="stack gap-4">
            <span className="mono-label">Watchlist entries</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)' }}>
              {kpis.watchlistEntries ?? '—'}
            </span>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function IncidentTable({ navigate }) {
 const [rows, setRows] = useState(null);

 useEffect(() => {
   let alive = true;
   api
     .threats()
     .then((d) => {
       if (alive) setRows(d.threats.slice(0, 8));
     })
     .catch(() => {});
   return () => {
     alive = false;
   };
 }, []);

 if (!rows) return <Loading label="LOADING INCIDENTS" />;
 if (!rows.length) {
   return (
     <PanelBody>
       <span className="dim" style={{ fontSize: 13 }}>No incidents recorded.</span>
     </PanelBody>
   );
 }

 return (
   <div className="table-wrap">
     <table className="data">
       <thead>
         <tr>
           <th>Time</th>
           <th>Subject</th>
           <th>Sender</th>
           <th>Risk</th>
           <th>Category</th>
           <th>Status</th>
         </tr>
       </thead>
       <tbody>
         {rows.map((t) => (
           <tr key={t.id} className="clickable" onClick={() => navigate(`/admin/threats/${t.id}`)}>
             <td className="mono" style={{ fontSize: 11.5 }}>{shortTime(t.timestamp)}</td>
             <td style={{ color: 'var(--text)', maxWidth: 260 }}>{t.subject}</td>
             <td className="mono" style={{ fontSize: 11.5, maxWidth: 240, wordBreak: 'break-all' }}>{t.sender}</td>
             <td>
               <Badge tone={toneForLevel(t.riskLevel)}>{t.riskLevel ?? '—'}</Badge>
             </td>
             <td style={{ fontSize: 12.5 }}>{t.category}</td>
             <td><Badge tone={toneForStatus(t.status)}>{t.status}</Badge></td>
           </tr>
         ))}
       </tbody>
     </table>
   </div>
 );
}
