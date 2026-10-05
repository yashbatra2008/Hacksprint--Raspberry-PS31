import { VERIFIED_DOMAINS } from '../data/institution.js';

const VERIFIED = new Set(VERIFIED_DOMAINS.map((d) => d.domain.toLowerCase()));

const IMPERSONATION_SUFFIXES = ['.example', '.com', '.org', '.net', '.xyz', '.top'];

function isVerified(domain) {
  return VERIFIED.has(String(domain ?? '').toLowerCase());
}

export function simulateAuthentication(message, ctx = {}) {
  const domain = String(message.from ?? '').split('@')[1]?.toLowerCase() ?? '';
  const verified = isVerified(domain);
  const knownBad = ctx.knownBad?.has(domain) ?? false;

  const seed = [...domain].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  if (verified) {
    return {
      simulated: true,
      note: 'Simulated authentication results for prototype — derived from the sender domain, not from live mail headers.',
      domain,
      spf: { status: 'PASS', detail: `SPF policy for ${domain} lists this sending infrastructure.` },
      dkim: { status: 'PASS', detail: `Valid DKIM signature aligned with ${domain}.` },
      dmarc: { status: 'PASS', detail: `DMARC alignment passed (policy p=reject).` },
      alignment: { status: 'PASS', detail: 'From-domain aligns with the authenticated domain.' },
      headerForensics: {
        status: 'CONSISTENT',
        detail: 'Reply-To matches From and no anomalous relay hops were observed.',
      },
    };
  }

  const spfStatus = knownBad ? 'FAIL' : seed % 3 === 0 ? 'FAIL' : 'UNKNOWN';
  const dkimStatus = knownBad ? 'FAIL' : seed % 4 === 0 ? 'FAIL' : 'UNKNOWN';
  const dmarcStatus = knownBad || spfStatus === 'FAIL' ? 'FAIL' : 'UNKNOWN';

  return {
    simulated: true,
    note: 'Simulated authentication results for prototype — derived from the sender domain, not from live mail headers.',
    domain,
    spf: {
      status: spfStatus,
      detail:
        spfStatus === 'FAIL'
          ? `${domain} does not authorise this sending infrastructure.`
          : `No SPF evaluation available for ${domain} in the prototype.`,
    },
    dkim: {
      status: dkimStatus,
      detail:
        dkimStatus === 'FAIL'
          ? `No valid DKIM signature aligned with ${domain}.`
          : `DKIM signature could not be validated in the prototype.`,
    },
    dmarc: {
      status: dmarcStatus,
      detail:
        dmarcStatus === 'FAIL'
          ? `${domain} publishes no usable DMARC enforcement record.`
          : `DMARC posture unknown for ${domain} in the prototype.`,
    },
    alignment: {
      status: spfStatus === 'FAIL' ? 'FAIL' : 'UNKNOWN',
      detail: 'Sender domain does not align with any verified institutional domain.',
    },
    headerForensics: {
      status: 'SUSPICIOUS',
      detail: `Unverified external domain ${IMPERSONATION_SUFFIXES.some((s) => domain.endsWith(s)) ? 'resembling an institutional identity' : 'used as sender'} — treat with caution.`,
    },
  };
}

export function createMockAuthenticationService() {
  return {
    id: 'authentication',
    mode: 'simulated',
    label: 'Email authentication (simulated)',
    description:
      'Deterministic SPF/DKIM/DMARC simulation. Real deployments read the receiving platform authentication verdicts.',
    async check(message, ctx) {
      return simulateAuthentication(message, ctx);
    },
  };
}
