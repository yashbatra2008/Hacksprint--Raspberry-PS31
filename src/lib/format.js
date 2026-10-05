export function toneForLevel(level) {
  switch (String(level ?? '').toUpperCase()) {
    case 'LOW':
      return 'safe';
    case 'MEDIUM':
      return 'warn';
    case 'HIGH':
      return 'danger';
    case 'CRITICAL':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function toneForStatus(status) {
  const s = String(status ?? '').toUpperCase();
  if (['PASS', 'PASSED', 'MATCH FOUND', 'CONSISTENT', 'TRUSTED', 'VERIFIED', 'YES', 'REVIEWED', 'CLOSED', 'NOT DETECTED', 'NONE DETECTED'].includes(s)) return 'safe';
  if (['FAIL', 'FAILED', 'MALICIOUS', 'INCONSISTENT', 'NO MATCH FOUND', 'NO', 'ESCALATED', 'DETECTED', 'INDICATORS DETECTED', 'SUSPICIOUS'].includes(s)) return 'danger';
  if (['PARTIAL MATCH', 'UNKNOWN', 'UNVERIFIED', 'UNVERIFIED-EXTERNAL', 'WARN', 'INVESTIGATING', 'MONITORING', 'NO RECORD'].includes(s)) return 'warn';
  if (['LOW', 'SAFE'].includes(s)) return 'safe';
  if (['MEDIUM'].includes(s)) return 'warn';
  if (['HIGH'].includes(s)) return 'danger';
  if (['CRITICAL'].includes(s)) return 'critical';
  return 'neutral';
}

export const badgeClass = (tone) =>
  ({ safe: 'badge badge-safe', warn: 'badge badge-warn', danger: 'badge badge-danger', critical: 'badge badge-critical', cyan: 'badge badge-cyan', purple: 'badge badge-purple', neutral: 'badge badge-neutral' })[tone] ?? 'badge';

export const barClass = (tone) =>
  ({ safe: 'bar-fill safe', warn: 'bar-fill warn', danger: 'bar-fill danger', critical: 'bar-fill danger', neutral: 'bar-fill' })[tone] ?? 'bar-fill';

export const alertClass = (tone) =>
  ({ safe: 'alert alert-safe', warn: 'alert alert-warn', danger: 'alert alert-danger', critical: 'alert alert-danger', cyan: 'alert alert-info', neutral: 'alert' })[tone] ?? 'alert';

export const dotClass = (tone) =>
  ({ safe: 'dot dot-safe', warn: 'dot dot-warn', danger: 'dot dot-danger', critical: 'dot dot-danger', cyan: 'dot dot-cyan', neutral: 'dot' })[tone] ?? 'dot';

export function shortTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value).slice(11, 16) || String(value);
  return d.toTimeString().slice(0, 5);
}

export function prettyDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function prettyDateTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return `${prettyDate(value)}, ${d.toTimeString().slice(0, 8)}`;
}

export function relativeTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function checkStatusLabel(status) {
  return String(status ?? '').toUpperCase();
}

export function riskLabel(level) {
  return `${String(level ?? '').toUpperCase()} RISK`;
}
