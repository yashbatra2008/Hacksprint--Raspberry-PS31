import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import {
  Alert, Badge, Dot, ErrorState, Loading, Panel, PanelBody, PanelHead,
} from '../components/ui.jsx';

const NODES = [
  { id: 'email', label: 'EMAIL', type: 'email', x: 50, y: 14, r: 20 },
  { id: 'sender', label: 'SENDER', type: 'sender', x: 21, y: 44, r: 22 },
  { id: 'domain', label: 'DOMAIN', type: 'domain', x: 50, y: 47, r: 24 },
  { id: 'url', label: 'URL', type: 'url', x: 79, y: 44, r: 20 },
  { id: 'threat', label: 'THREAT', type: 'threat', x: 33, y: 82, r: 24 },
  { id: 'institution', label: 'INSTITUTION', type: 'institution', x: 68, y: 82, r: 26 },
];

const LINKS = [
  ['email', 'sender'],
  ['email', 'domain'],
  ['email', 'url'],
  ['sender', 'domain'],
  ['url', 'domain'],
  ['sender', 'threat'],
  ['threat', 'institution'],
  ['domain', 'threat'],
  ['url', 'institution'],
  ['institution', 'domain'],
];

const NODE_COLOR = {
  email: '#22d3ee',
  sender: '#fbbf24',
  domain: '#a78bfa',
  url: '#60a5fa',
  threat: '#ff4d6d',
  institution: '#34d399',
};

const ACTIVITY = [
  { label: 'Institution Impersonation', count: 31, key: 'Institution Impersonation' },
  { label: 'Suspicious Links', count: 24, key: 'Malicious Link' },
  { label: 'Credential Phishing', count: 18, key: 'Credential Phishing' },
  { label: 'Social Engineering', count: 14, key: 'Social Engineering' },
];

export default function ThreatIntel() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);
  const [elapsed, setElapsed] = useState(0);

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
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 2600);
    return () => clearInterval(t);
  }, []);

  const activity = useMemo(() => {
    const live = new Map((stats?.byCategory ?? []).map((c) => [c.category, c.count]));
    return ACTIVITY.map((a) => ({
      ...a,

      value: Math.max(a.count, live.get(a.key) ?? 0),
    }));
  }, [stats]);

  const max = Math.max(...activity.map((a) => a.value), 1);
  const campaigns = stats?.campaigns ?? [];

  if (error) {
    return (
      <Panel>
        <PanelHead title="Threat Intelligence" />
        <ErrorState message={error.message} detail={error.detail} />
      </Panel>
    );
  }

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Threat Intelligence</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>Threat Activity</h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 780 }}>
            Relationships between the senders, domains and destinations seen in this deployment, and the
            campaigns they belong to.
          </p>
        </div>
        <div className="row gap-10 wrap">
          <span className="badge badge-warn">
            <Dot tone="warn" pulse />
            SIMULATED INTEL
          </span>
          <Link to="/admin" className="btn btn-ghost">SOC Overview →</Link>
        </div>
      </div>

      <Alert tone="warn" title="Simulated threat intelligence">
        All campaign records, reputation values and relationship edges below are fictional demo data.
        No commercial threat feed is queried by this prototype.
      </Alert>

      <div className="grid grid-split" style={{ '--split-a': 'minmax(300px, 0.85fr)', '--split-b': 'minmax(0, 1.15fr)' }}>
        {}
        <Panel bracketed>
          <PanelHead title="Threat Activity">
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
              DEMO
            </span>
          </PanelHead>
          <PanelBody className="stack gap-16">
            {activity.map((a) => (
              <div className="stack gap-6" key={a.label}>
                <div className="row gap-10" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{a.label}</span>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan)' }}>{a.value}</span>
                </div>
                <div className="bar" style={{ height: 9 }}>
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(a.value / max) * 100}%`,
                      background: 'linear-gradient(90deg, #0e7490, #22d3ee)',
                      transition: 'width 700ms cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </div>
              </div>
            ))}

            <div style={{ paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.6, display: 'block' }}>
                Counts combine illustrative demo baselines with events recorded in this session.
              </span>
            </div>
          </PanelBody>
        </Panel>

        {}
        <Panel>
          <PanelHead title="Relationship Graph">
            <div className="row gap-6 wrap">
              {Object.entries(NODE_COLOR).map(([k, c]) => (
                <span className="row gap-4" key={k} style={{ fontSize: 9.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  <span className="mono" style={{ color: 'var(--text-faint)', letterSpacing: '0.06em' }}>{k.toUpperCase()}</span>
                </span>
              ))}
            </div>
          </PanelHead>
          <div className="graph-wrap" style={{ height: 400 }}>
            <svg className="graph-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img"
                 aria-label="Relationship graph linking email, sender, domain, URL, threat and institution">
              <defs>
                <radialGradient id="glow">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx="50" cy="50" r="46" fill="url(#glow)" />

              {}
              {[22, 34, 46].map((r) => (
                <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#1b2740" strokeWidth="0.2" />
              ))}

              {}
              {LINKS.map(([a, b], i) => {
                const na = NODES.find((n) => n.id === a);
                const nb = NODES.find((n) => n.id === b);
                const active = hover === a || hover === b;
                return (
                  <line
                    key={`${a}-${b}`}
                    className="graph-link"
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke={active ? '#22d3ee' : '#26354f'}
                    strokeWidth={active ? 0.7 : 0.35}
                    strokeOpacity={active ? 1 : 0.75}
                    style={{ animationDuration: `${1.4 + (i % 4) * 0.35}s` }}
                  />
                );
              })}

              {}
              {NODES.map((n) => {
                const color = NODE_COLOR[n.type];
                const active = hover === n.id;
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={active ? n.r / 7.5 : n.r / 9}
                      fill={`${color}22`}
                      stroke={color}
                      strokeWidth={active ? 0.9 : 0.5}
                    />
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.r / 22}
                      fill={color}
                      opacity={active ? 1 : 0.85}
                    >
                      <animate
                        attributeName="opacity"
                        values={active ? '1;0.55;1' : '0.85;0.45;0.85'}
                        dur={`${2.2 + (n.x % 5) * 0.3}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                    <text
                      className="graph-node-label"
                      x={n.x}
                      y={n.y + n.r / 5.2}
                      textAnchor="middle"
                      style={{ fill: active ? '#e6edf7' : '#94a7c4', fontSize: 3.1 }}
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}

              {}
              <circle r="1" fill="#34d399">
                <animateMotion dur="5s" repeatCount="indefinite" path={`M ${NODES[0].x} ${NODES[0].y} L ${NODES[2].x} ${NODES[2].y} L ${NODES[5].x} ${NODES[5].y}`} />
                <animate attributeName="opacity" values="0;1;1;0" dur="5s" repeatCount="indefinite" />
              </circle>
            </svg>

            <span className="mono" style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 9.5, color: 'var(--text-faint)' }}>
              hover a node · beat {elapsed}
            </span>
          </div>
        </Panel>
      </div>

      {}
      <Panel>
        <PanelHead title="Campaign Records">
          <Badge tone="purple">{campaigns.length} CAMPAIGNS</Badge>
        </PanelHead>
        {!stats ? (
          <Loading label="LOADING CAMPAIGN RECORDS" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>First Seen</th>
                  <th>Domains</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>{c.id}</td>
                    <td style={{ color: 'var(--text)' }}>{c.name}</td>
                    <td><Badge tone="neutral">{c.category}</Badge></td>
                    <td className="mono" style={{ fontSize: 11 }}>{c.firstSeen}</td>
                    <td className="mono" style={{ fontSize: 10.5, maxWidth: 300, wordBreak: 'break-all' }}>
                      <div className="stack gap-3">
                        {c.domains.map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge tone={c.confidence === 'high' ? 'danger' : 'warn'}>{c.confidence}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {}
      <div className="grid grid-2">
        {campaigns.map((c) => (
          <Panel key={`n-${c.id}`} interactive>
            <PanelHead title={c.name}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{c.id}</span>
            </PanelHead>
            <PanelBody className="stack gap-10">
              <p className="dim" style={{ fontSize: 13, lineHeight: 1.62 }}>{c.summary}</p>
              <div className="row gap-6 wrap">
                <Badge tone="neutral">{c.category}</Badge>
                <Badge tone="warn">first seen {c.firstSeen}</Badge>
                <Badge tone={c.confidence === 'high' ? 'danger' : 'warn'}>{c.confidence} confidence</Badge>
              </div>
              <div className="stack gap-4">
                <span className="mono-label">Infrastructure</span>
                {c.domains.map((d) => (
                  <span className="mono" key={d} style={{ fontSize: 11.5, color: 'var(--red)', wordBreak: 'break-all' }}>
                    ✕ {d}
                  </span>
                ))}
              </div>
            </PanelBody>
          </Panel>
        ))}
      </div>

      <div className="row gap-10 wrap">
        <Link to="/admin/threats" className="btn btn-ghost">Threat queue →</Link>
        <Link to="/admin/watchlist" className="btn btn-ghost">Watchlist →</Link>
      </div>
    </div>
  );
}
