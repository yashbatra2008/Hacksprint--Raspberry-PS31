import { VERIFIED_DOMAINS, INSTITUTION } from '../data/institution.js';

const VERIFIED = VERIFIED_DOMAINS.map((d) => d.domain.toLowerCase());

const BRAND_TOKENS = (INSTITUTION.brandTokens ?? []).map((t) => t.toLowerCase());

const KNOWN_BAD = {
  'northstar-course-registration.example': {
    reputation: 'malicious',
    note: 'Known credential-harvesting registration page (fictional demo intelligence).',
  },
  'student-placement.example': {
    reputation: 'malicious',
    note: 'Known fake placement verification form (fictional demo intelligence).',
  },
  'northstar-university-edu.com': {
    reputation: 'suspicious',
    note: 'Typosquatted look-alike domain (fictional demo intelligence).',
  },
  'northstar-scholarship-portal.example': {
    reputation: 'suspicious',
    note: 'Unregistered scholarship document-collection form (fictional demo intelligence).',
  },
  'northstar-univ-portal.example': {
    reputation: 'malicious',
    note: 'Look-alike accounts portal used in fee-payment campaigns (fictional demo intelligence).',
  },
};

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'shorturl.at', 'rb.gy'];
const REDIRECT_PARAMS = ['url=', 'redirect=', 'next=', 'continue=', 'target=', 'return='];
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.zip', '.country', '.gq', '.tk', '.work'];

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function registrableish(host) {
  const parts = host.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : host;
}

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

export function domainSimilarityScore(candidate, reference) {
  const c = String(candidate ?? '').toLowerCase();
  const r = String(reference ?? '').toLowerCase();
  if (!c || !r) return 0;
  const dist = editDistance(c, r);
  const maxLen = Math.max(c.length, r.length);
  let score = Math.round((1 - dist / maxLen) * 100);

  const reusedBrandToken = BRAND_TOKENS.some((t) => c.includes(t));
  if (reusedBrandToken && c !== r) {
    score = Math.max(score, 78);

    if (/university|college|edu|campus|portal|student|scholarship/.test(c)) score = Math.max(score, 88);
  }

  const strip = (s) => s.replace(/[^a-z0-9]/g, '').replace(/^(?:www)?/, '');
  const cStripped = strip(c);
  const rStripped = strip(r);
  const rNoTld = strip(r.split('.').slice(0, -1).join('.'));
  if (cStripped === rStripped) score = 100;
  else if (rNoTld.length >= 8 && cStripped.includes(rNoTld)) score = Math.max(score, 90);
  else if (rStripped.length >= 8 && cStripped.includes(rStripped)) score = Math.max(score, 95);

  return Math.max(0, Math.min(100, score));
}

export function analyzeLink(rawUrl, ctx = {}) {
  const url = String(rawUrl ?? '').trim();
  const host = hostOf(url);
  if (!host) {
    return {
      url,
      host: null,
      valid: false,
      https: false,
      institutional: false,
      status: 'UNPARSEABLE',
      reputation: 'unknown',
      redirectRisk: 'unknown',
      similarity: 0,
      findings: ['Link could not be parsed as a URL.'],
    };
  }

  const institutional = VERIFIED.some((d) => host === d || host.endsWith(`.${d}`));
  const known = KNOWN_BAD[host];
  const findings = [];

  const https = url.toLowerCase().startsWith('https://');
  if (!https) findings.push('Destination is not served over HTTPS.');

  if (institutional) {
    return {
      url,
      host,
      valid: true,
      https,
      institutional: true,
      status: 'TRUSTED',
      reputation: 'trusted-institutional',
      redirectRisk: 'low',
      similarity: 100,
      findings: ['Destination host is a verified institutional domain.'],
      simulated: true,
    };
  }

  const base = registrableish(host);
  const similarity = Math.max(
    ...VERIFIED.map((d) => domainSimilarityScore(base, d)),
    ...VERIFIED.map((d) => domainSimilarityScore(host, d)),
  );

  if (similarity >= 60) findings.push(`Destination host closely resembles a verified institutional domain (similarity ${similarity}%).`);
  if (VERIFIED.some((d) => host.includes(d)) && !institutional)
    findings.push('Institutional domain name appears as a subdomain of an unrelated host (deceptive subdomain pattern).');
  if (host.startsWith('xn--') || /[^\x00-\x7F]/.test(host)) findings.push('Host uses internationalised/punycode characters.');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) findings.push('Destination is a bare IP address rather than a domain name.');
  if (SHORTENERS.includes(base)) findings.push('Destination uses a URL shortener, hiding the final target.');
  if (REDIRECT_PARAMS.some((p) => url.toLowerCase().includes(p))) findings.push('Link contains an open-redirect style parameter.');
  if (SUSPICIOUS_TLDS.some((t) => host.endsWith(t))) findings.push('Destination uses a TLD frequently abused for throwaway phishing infrastructure.');

  const status = known
    ? known.reputation === 'malicious'
      ? 'MALICIOUS'
      : 'SUSPICIOUS'
    : similarity >= 60
      ? 'SUSPICIOUS'
      : findings.length > 0
        ? 'SUSPICIOUS'
        : 'UNVERIFIED';

  if (known) findings.unshift(known.note);
  if (!findings.length) findings.push('Destination is not an institutional domain and could not be verified.');

  const redirectRisk = REDIRECT_PARAMS.some((p) => url.toLowerCase().includes(p)) || SHORTENERS.includes(base) ? 'high' : 'medium';

  return {
    url,
    host,
    valid: true,
    https,
    institutional: false,
    status,
    reputation: known?.reputation ?? 'unverified-external',
    redirectRisk,
    similarity,
    findings,
    simulated: true,
  };
}

export function createMockUrlReputationService() {
  return {
    id: 'urlReputation',
    mode: 'simulated',
    label: 'URL reputation (simulated)',
    description:
      'String-level link analysis against the verified-domain list and a fictional reputation seed. URLs are never fetched.',
    async analyze(urls, ctx = {}) {
      return (urls ?? []).filter(Boolean).map((u) => analyzeLink(u, ctx));
    },
  };
}
