import { useState } from 'react';

import { Badge, KV, StatusBadge } from './ui.jsx';
import { toneForStatus } from '../lib/format.js';

const ICONS = {
  sender: '✉',
  auth: '⚿',
  context: '◈',
  link: '⛓',
  social: '⚑',
  student: '☰',
  pattern: '⟳',
};

export default function CheckCard({ check }) {
  const [open, setOpen] = useState(false);
  const tone = check.tone ?? toneForStatus(check.status);

  const hasDetail =
    (check.findings?.length ?? 0) > 0 ||
    (check.reasons?.length ?? 0) > 0 ||
    (check.signals?.length ?? 0) > 0 ||
    (check.details?.length ?? 0) > 0 ||
    (check.allLinks?.length ?? 0) > 1;

  return (
    <article className={`check-card tone-${tone}`}>
      <header className="check-head">
        <span className="check-icon" aria-hidden="true">{ICONS[check.icon] ?? '◇'}</span>
        <h3 className="check-title">{check.title}</h3>
        <StatusBadge status={check.status} />
      </header>

      <div className="check-body">
        {}
        {check.fields?.length ? (
          <div>
            {check.fields.map((f, i) => (
              <KV key={`${f.label}-${i}`} label={f.label} value={f.value} mono={f.mono} status={f.status} />
            ))}
          </div>
        ) : null}

        {}
        {check.simulated ? <div className="sim-note">⚠ {check.simulatedNote}</div> : null}

        {}
        {check.fields?.some((f) => f.evidence?.length) ? (
          <div className="stack gap-8">
            {check.fields
              .filter((f) => f.evidence?.length)
              .map((f) => (
                <div key={f.label} className="stack gap-5">
                  <span className="mono-label">{f.label} — evidence</span>
                  <div className="check-evidence">
                    {f.evidence.map((e, i) => (
                      <span className="evidence-chip" key={i}>{e}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : null}

        {}
        {check.explanation ? <p className="check-explanation">{check.explanation}</p> : null}

        {}
        {check.interpretation ? (
          <div
            className="mono"
            style={{
              fontSize: 11.5,
              lineHeight: 1.65,
              color: 'var(--text-dim)',
              padding: '9px 11px',
              borderRadius: 6,
              background: 'rgba(251,191,36,0.05)',
              border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            {check.interpretation}
          </div>
        ) : null}

        {check.detectedFields?.length ? (
          <div className="check-evidence">
            {check.detectedFields.map((f) => (
              <span className="evidence-chip" key={f.id}>{f.label}: “{f.matched}”</span>
            ))}
          </div>
        ) : null}

        {check.matchedRecipientFields?.length ? (
          <div className="stack gap-5">
            <span className="mono-label">Matched against recipient profile</span>
            <div className="check-evidence">
              {check.matchedRecipientFields.map((f) => (
                <span className="evidence-chip" key={f.label}>{f.label}</span>
              ))}
            </div>
          </div>
        ) : null}

        {check.score ? (
          <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
            <span className="mono-label">Pattern consistency score</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{check.score}</span>
          </div>
        ) : null}

        {}
        {hasDetail ? (
          <div className={`disclosure${open ? ' open' : ''}`}>
            <button type="button" className="disclosure-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <span className="disclosure-caret" aria-hidden="true">▶</span>
              TECHNICAL DETAIL
            </button>
            {open ? (
              <div className="disclosure-content">
                <div className="terminal" style={{ border: 'none', borderRadius: 0 }}>
                  <div className="terminal-body" style={{ maxHeight: 260 }}>
                    {check.reasons?.map((r, i) => (
                      <div className="term-line" key={`r${i}`}>
                        <span className="term-time">•</span>
                        <span className="term-msg">{r}</span>
                      </div>
                    ))}
                    {check.signals?.map((s, i) => (
                      <div className="term-line" key={`s${i}`}>
                        <span className="term-time">•</span>
                        <span className="term-msg">{s}</span>
                      </div>
                    ))}
                    {check.findings?.map((f, i) => (
                      <div className="term-line" key={`f${i}`}>
                        <span className="term-time">!</span>
                        <span className="term-msg term-warn">{f}</span>
                      </div>
                    ))}
                    {check.details?.map((d, i) => (
                      <div className="term-line" key={`d${i}`}>
                        <span className="term-time">•</span>
                        <span className="term-msg">{d}</span>
                      </div>
                    ))}
                    {(check.allLinks?.length ?? 0) > 1
                      ? check.allLinks.map((l, i) => (
                          <div className="term-line" key={`l${i}`}>
                            <span className="term-time">{l.institutional ? '✓' : '✕'}</span>
                            <span className={`term-msg ${l.institutional ? 'term-ok' : 'term-warn'}`}>
                              {l.host} — {l.status} ({l.reputation})
                            </span>
                          </div>
                        ))
                      : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
