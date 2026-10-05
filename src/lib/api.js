const BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail ?? null;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the CampusShield API. Is the server running?', 0, String(err?.message ?? err));
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError('The API returned an unreadable response.', res.status, text.slice(0, 200));
  }

  if (!res.ok) {
    throw new ApiError(json?.error ?? `Request failed (${res.status}).`, res.status, json?.detail ?? null);
  }
  return json;
}

export const api = {
  health: () => request('/health'),
  config: () => request('/config'),

  demoEmails: () => request('/demo-emails'),
  demoAttack: () => request('/demo/attack'),
  resetDemo: () => request('/demo/reset', { method: 'POST' }),

  analyzeEmail: (payload) => request('/analyze-email', { method: 'POST', body: payload }),
  parseEml: (raw) => request('/parse-eml', { method: 'POST', body: { raw } }),
  getEmail: (id) => request(`/emails/${id}`),

  verifiedAnnouncements: () => request('/verified-announcements'),
  verifyAnnouncement: (payload) => request('/verify-announcement', { method: 'POST', body: payload }),

  threats: (status) => request(`/threats${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  reportThreat: (payload) => request('/threats/report', { method: 'POST', body: payload }),
  updateThreat: (id, payload) => request(`/threats/${id}`, { method: 'PATCH', body: payload }),
  threatTimeline: (id) => request(`/threats/${id}/timeline`),

  stats: () => request('/dashboard/stats'),

  watchlist: () => request('/watchlist'),
  addWatchlist: (payload) => request('/watchlist', { method: 'POST', body: payload }),
  removeWatchlist: (id) => request(`/watchlist/${id}`, { method: 'DELETE' }),

  settings: () => request('/settings'),
  addVerifiedDomain: (payload) => request('/settings/domains', { method: 'POST', body: payload }),
  removeVerifiedDomain: (id) => request(`/settings/domains/${id}`, { method: 'DELETE' }),
};

const SESSION_KEY = 'campusshield.session';

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {

  }
}

export function clearSession() {
  setSession(null);
}
