import { badgeClass, alertClass, dotClass, toneForStatus } from '../lib/format.js';

export function Badge({ children, tone = 'neutral', title }) {
  return (
    <span className={badgeClass(tone)} title={title}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, prefix = '' }) {
  const tone = toneForStatus(status);
  return (
    <Badge tone={tone}>
      {prefix}
      {String(status ?? '—')}
    </Badge>
  );
}

export function Dot({ tone = 'neutral', pulse = false }) {
  return <span className={`${dotClass(tone)}${pulse ? ' dot-pulse' : ''}`} aria-hidden="true" />;
}

export function Panel({ children, className = '', bracketed = false, interactive = false, ...rest }) {
  const classes = [
    'panel',
    bracketed ? 'bracketed' : '',
    interactive ? 'panel-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} {...rest}>
      {children}
    </section>
  );
}

export function PanelHead({ title, children, icon }) {
  return (
    <header className="panel-head">
      <h3 className="panel-title">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {title}
      </h3>
      {children ? <div className="row gap-8 wrap">{children}</div> : null}
    </header>
  );
}

export function PanelBody({ children, className = '' }) {
  return <div className={`panel-body ${className}`}>{children}</div>;
}

export function Alert({ tone = 'neutral', icon, children, title }) {
  const glyph = icon ?? { safe: '✓', warn: '!', danger: '✕', critical: '✕', cyan: '›', neutral: 'i' }[tone] ?? 'i';
  return (
    <div className={alertClass(tone)} role={tone === 'danger' || tone === 'critical' ? 'alert' : undefined}>
      <span className="alert-icon" aria-hidden="true">
        {glyph}
      </span>
      <div className="stack gap-4">
        {title ? <strong style={{ color: 'inherit' }}>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, mono = false }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <span style={{ color: 'var(--text-faint)', letterSpacing: 0, textTransform: 'none' }}>{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Bar({ value, max = 100, tone = 'neutral', height }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100));
  return (
    <div className="bar" style={height ? { height } : undefined} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={tone === 'critical' ? 'bar-fill danger' : tone === 'neutral' ? 'bar-fill' : `bar-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function KV({ label, value, mono = true, status, tone }) {
  const valueTone = tone ?? (status ? toneForStatus(status) : null);
  const color =
    valueTone === 'safe' ? 'var(--green)'
    : valueTone === 'warn' ? 'var(--amber)'
    : valueTone === 'danger' ? 'var(--red)'
    : valueTone === 'critical' ? 'var(--critical)'
    : 'var(--text)';
  return (
    <div
      className="row gap-12"
      style={{ justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--line-soft)', gap: 12 }}
    >
      <span className="mono-label" style={{ flexShrink: 0 }}>
        {label}
      </span>
      <span
        className={mono ? 'mono' : ''}
        style={{ color, fontSize: 12.5, textAlign: 'right', wordBreak: 'break-word', minWidth: 0 }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <span className="row gap-8" role="status">
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span> : null}
    </span>
  );
}

export function Loading({ label = 'LOADING' }) {
  return (
    <div className="stack gap-12" style={{ padding: 24 }} role="status" aria-live="polite">
      <span className="mono-label">{label}</span>
      <div className="skeleton" style={{ height: 14, width: '70%' }} />
      <div className="skeleton" style={{ height: 14, width: '92%' }} />
      <div className="skeleton" style={{ height: 14, width: '48%' }} />
    </div>
  );
}

export function ErrorState({ message, detail, onRetry }) {
  return (
    <div className="stack gap-12" style={{ padding: 20 }}>
      <Alert tone="danger" title="Request failed">
        {message}
        {detail ? (
          <div className="mono" style={{ fontSize: 11.5, marginTop: 6, color: 'var(--text-mute)' }}>
            {String(detail).slice(0, 240)}
          </div>
        ) : null}
      </Alert>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children, icon = '◇' }) {
  return (
    <div className="stack gap-8" style={{ padding: '34px 20px', alignItems: 'center', textAlign: 'center' }}>
      <span style={{ fontSize: 26, color: 'var(--text-faint)' }} aria-hidden="true">
        {icon}
      </span>
      <span className="mono-label">{title}</span>
      {children ? <p className="dim" style={{ fontSize: 13, maxWidth: 420 }}>{children}</p> : null}
    </div>
  );
}

export function DemoTag({ label = 'DEMO ENVIRONMENT' }) {
  return (
    <span className="badge badge-warn" title="All data in this prototype is fictional.">
      <Dot tone="warn" pulse />
      {label}
    </span>
  );
}

export function SectionTitle({ eyebrow, title, description, actions }) {
  return (
    <div className="row gap-16 wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
      <div className="stack gap-6">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2 className="h2">{title}</h2>
        {description ? <p className="dim" style={{ fontSize: 13.5, maxWidth: 720 }}>{description}</p> : null}
      </div>
      {actions ? <div className="row gap-8 wrap">{actions}</div> : null}
    </div>
  );
}
