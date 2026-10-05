import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import {
  Alert, Badge, Dot, EmptyState, ErrorState, Field, KV, Loading, Panel, PanelBody, PanelHead,
} from '../components/ui.jsx';
import { prettyDate, toneForStatus } from '../lib/format.js';

export default function Settings({ session }) {
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(() => {
    api
      .settings()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(setError);
  }, []);

  useEffect(load, [load]);

  const addDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setBusy(true);
    try {
      const res = await api.addVerifiedDomain({
        domain: newDomain.trim(),
        institution: data?.institution?.name,
        addedBy: session?.email,
      });
      push({ tone: 'safe', title: 'SYSTEM', message: res.message, lines: ['[+] Sender verification now accepts this domain.'] });
      setNewDomain('');
      load();
    } catch (err) {
      push({ tone: 'danger', title: 'SYSTEM', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const removeDomain = async (entry) => {
    setRemovingId(entry.id);
    try {
      const res = await api.removeVerifiedDomain(entry.id);
      push({ tone: 'warn', title: 'SYSTEM', message: res.message, lines: ['[+] Mail from this domain will now fail sender verification.'] });
      load();
    } catch (err) {
      push({ tone: 'danger', title: 'SYSTEM', message: err.message });
    } finally {
      setRemovingId(null);
    }
  };

  if (error) {
    return (
      <Panel>
        <PanelHead title="Trusted Sources" />
        <ErrorState message={error.message} detail={error.detail} onRetry={load} />
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel>
        <PanelHead title="Trusted Sources" />
        <Loading label="LOADING INSTITUTION CONFIGURATION" />
      </Panel>
    );
  }

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Security Administration</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>Trusted Sources</h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 780 }}>
            The reference data behind sender verification, context matching and student guidance.
            Changes here change what the engine considers legitimate.
          </p>
        </div>
        <div className="row gap-10 wrap">
          <Badge tone="warn">DEMO ENVIRONMENT</Badge>
          <button type="button" className="btn btn-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <Alert tone="warn" title="Prototype configuration">
        This console edits the prototype's local database only. In production these records would be
        synchronised from the institution's directory and CMS, with maker/checker approval.
      </Alert>

      {}
      <div className="grid grid-split" style={{ '--split-a': 'minmax(0, 1.25fr)', '--split-b': 'minmax(290px, 0.75fr)' }}>
        <Panel bracketed>
          <PanelHead title="Verified Institutional Domains">
            <Badge tone="cyan">{data.verifiedDomains.length} DOMAINS</Badge>
          </PanelHead>
          <PanelBody className="stack gap-14">
            <form onSubmit={addDomain} className="row gap-8">
              <input
                className="input grow"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="news.northstaruniversity.edu"
                spellCheck={false}
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !newDomain.trim()}>
                {busy ? 'Adding…' : 'Add Domain'}
              </button>
            </form>

            <div className="stack gap-0">
              {data.verifiedDomains.map((d) => (
                <div className="row-card" key={d.id}>
                  <span className="stack gap-3" style={{ minWidth: 0, flex: 1 }}>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{d.domain}</span>
                    <span className="dim" style={{ fontSize: 12 }}>{d.purpose}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{d.department}</span>
                  </span>
                  <Badge tone="safe">VERIFIED</Badge>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => removeDomain(d)}
                    disabled={removingId === d.id || d.domain === data.institution.primaryDomain}
                    title={
                      d.domain === data.institution.primaryDomain
                        ? 'The primary institutional domain cannot be removed'
                        : `Remove ${d.domain} from verified domains`
                    }
                  >
                    {removingId === d.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>

        <div className="stack gap-16">
          {}
          <Panel>
            <PanelHead title="Official Communication Channels">
              <Badge tone="cyan">{data.channels.length}</Badge>
            </PanelHead>
            <PanelBody className="stack gap-10">
              {data.channels.map((c) => (
                <div className="stack gap-3" key={c.id} style={{ paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
                  <span className="row gap-8" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{c.name}</span>
                    <Badge tone="neutral">{c.kind}</Badge>
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', wordBreak: 'break-all' }}>{c.url}</span>
                </div>
              ))}
              <Alert tone="safe" title="Shown to students">
                These are the channels CampusShield tells a student to use when a claim cannot be
                verified from the email itself.
              </Alert>
            </PanelBody>
          </Panel>

          {}
          <Panel>
            <PanelHead title="Verified Departments">
              <Badge tone="neutral">{data.departments.length}</Badge>
            </PanelHead>
            <PanelBody>
              <div className="row gap-6 wrap">
                {data.departments.map((d) => (
                  <span className="badge badge-neutral" key={d}>{d}</span>
                ))}
              </div>
              <p className="dim" style={{ fontSize: 12.3, marginTop: 12, lineHeight: 1.6 }}>
                Derived from the verified announcement records. A claim naming a department in this list
                scores higher on institutional context agreement.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </div>

      {}
      <Panel>
        <PanelHead title="Verified Announcement Records">
          <div className="row gap-8">
            <Badge tone="safe">{data.announcements.length} RECORDS</Badge>
            <Link to="/student/verify" className="btn btn-sm btn-ghost">Open verification console →</Link>
          </div>
        </PanelHead>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Department</th>
                <th>Type</th>
                <th>Official Sender</th>
                <th>Official URL</th>
                <th>Published</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.announcements.map((a) => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>{a.id}</td>
                  <td style={{ color: 'var(--text)', maxWidth: 300 }}>{a.title}</td>
                  <td style={{ fontSize: 12.5 }}>{a.department}</td>
                  <td><Badge tone="neutral">{a.announcement_type}</Badge></td>
                  <td className="mono" style={{ fontSize: 11 }}>{a.official_sender}</td>
                  <td className="mono" style={{ fontSize: 10.5, maxWidth: 250, wordBreak: 'break-all' }}>{a.official_url}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{a.publication_date}</td>
                  <td><Badge tone={toneForStatus(a.status)}>{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {}
      <Panel>
        <PanelHead title="Integration Status">
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
            FUTURE PROVIDERS
          </span>
        </PanelHead>
        <PanelBody className="grid grid-3" style={{ gap: 14 }}>
          {data.services.map((s) => (
            <div className="stack gap-6" key={s.id} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-panel-2)' }}>
              <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{s.name}</span>
                <Badge tone={s.mode === 'mock' || s.mode === 'simulated' ? 'warn' : 'safe'}>{s.mode}</Badge>
              </div>
              <span className="dim" style={{ fontSize: 11.8, lineHeight: 1.55 }}>{s.note}</span>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <div className="row gap-10 wrap">
        <Link to="/admin" className="btn btn-ghost">← Overview</Link>
        <Link to="/admin/watchlist" className="btn btn-ghost">Watchlist</Link>
      </div>
    </div>
  );
}
