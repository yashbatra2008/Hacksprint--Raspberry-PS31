import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import {
  Alert, Badge, Dot, EmptyState, ErrorState, Field, Loading, Panel, PanelBody, PanelHead, StatusBadge,
} from '../components/ui.jsx';
import { prettyDate } from '../lib/format.js';

const EMPTY = { domain: '', reason: '' };

export default function Watchlist({ session }) {
  const { push } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    api
      .watchlist()
      .then((d) => {
        setRows(d.watchlist);
        setError(null);
      })
      .catch(setError);
  }, []);

  useEffect(load, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.domain.trim()) return;
    setBusy(true);
    try {
      const res = await api.addWatchlist({
        domain: form.domain.trim(),
        reason: form.reason.trim() || 'Added manually by security operations.',
        addedBy: session?.email,
      });
      push({ tone: 'safe', title: 'SYSTEM', message: res.message, lines: ['[+] Watchlisted domains now contribute a risk indicator.'] });
      setForm(EMPTY);
      load();
    } catch (err) {
      push({ tone: 'danger', title: 'SYSTEM', message: err.message });
      if (err.status === 409) setForm((f) => ({ ...f, domain: '' }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry) => {
    setRemovingId(entry.id);
    try {
      const res = await api.removeWatchlist(entry.id);
      push({ tone: 'warn', title: 'SYSTEM', message: res.message, lines: ['[+] Risk indicator will no longer be applied to this domain.'] });
      load();
    } catch (err) {
      push({ tone: 'danger', title: 'SYSTEM', message: err.message });
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = (rows ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.domain.toLowerCase().includes(q) ||
      String(r.reason ?? '').toLowerCase().includes(q) ||
      String(r.status ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Security Operations</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>Sender / Domain Watchlist</h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 760 }}>
            Domains flagged by analysts. A match adds a risk indicator to every subsequent analysis, so
            the next message from that infrastructure scores higher automatically.
          </p>
        </div>
        <Link to="/admin" className="btn btn-ghost">← Overview</Link>
      </div>

      <div className="grid grid-split" style={{ '--split-a': 'minmax(300px, 380px)', '--split-b': 'minmax(0, 1fr)' }}>
        {}
        <Panel bracketed>
          <PanelHead title="Add to Watchlist" />
          <PanelBody className="stack gap-14">
            <form onSubmit={add} className="stack gap-14">
              <Field label="Domain" hint="required">
                <input
                  className="input"
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder="northstar-career-program.com"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <Field label="Reason">
                <textarea
                  className="textarea"
                  style={{ minHeight: 96 }}
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Repeated institution impersonation"
                />
              </Field>
              <button type="submit" className="btn btn-primary btn-block" disabled={busy || !form.domain.trim()}>
                {busy ? 'Adding…' : 'Add Domain'}
              </button>
            </form>

            <Alert tone="cyan" title="Effect on analysis">
              The risk model applies a documented <span className="mono">+15</span> indicator for a
              watchlisted sender domain, visible in the report's indicator breakdown.
            </Alert>
          </PanelBody>
        </Panel>

        {/* ---------------------------------------------------------- table */}
        <Panel>
          <PanelHead title="Watchlisted Domains">
            <div className="row gap-8">
              <input
                className="input"
                style={{ maxWidth: 240, minWidth: 150 }}
                placeholder="Filter…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Badge tone="neutral">{filtered.length}</Badge>
            </div>
          </PanelHead>

          {error ? (
            <ErrorState message={error.message} detail={error.detail} onRetry={load} />
          ) : !rows ? (
            <Loading label="LOADING WATCHLIST" />
          ) : filtered.length === 0 ? (
            <EmptyState title="NO WATCHLIST ENTRIES" icon="⌖">
              {rows.length === 0
                ? 'Add a domain, or escalate an incident from the threat queue to populate it automatically.'
                : 'No entries match the current filter.'}
            </EmptyState>
          ) : (
            <div>
              {filtered.map((r) => (
                <div className="row-card" key={r.id}>
                  <span className="stack gap-4" style={{ minWidth: 0, flex: 1 }}>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>
                      {r.domain}
                    </span>
                    <span className="dim" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{r.reason}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                      added {prettyDate(r.created_at)} · by {r.added_by ?? 'unknown'}
                    </span>
                  </span>

                  <div className="stack gap-4" style={{ alignItems: 'flex-end' }}>
                    <StatusBadge status={r.status} />
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => remove(r)}
                      disabled={removingId === r.id}
                      title={`Remove ${r.domain} from the watchlist`}
                    >
                      {removingId === r.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Seed Watchlist (fictional demo data)" />
        <PanelBody className="stack gap-8">
          <span className="dim" style={{ fontSize: 12.8, lineHeight: 1.6 }}>
            The prototype ships with entries so the demo has continuity across pages. Escalating an
            incident from the threat queue adds the sender domain here automatically.
          </span>
          <div className="row gap-6 wrap">
            {(rows ?? []).map((r) => (
              <span className="badge badge-neutral" key={`chip-${r.id}`}>{r.domain}</span>
            ))}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
