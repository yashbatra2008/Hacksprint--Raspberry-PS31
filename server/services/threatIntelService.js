export const FICTIONAL_CAMPAIGNS = [
  {
    id: 'CAM-2026-014',
    name: 'Northstar Career Programme Impersonation',
    firstSeen: '2026-08-29',
    domains: ['northstar-career-program.com', 'northstar-course-registration.example'],
    category: 'Institution Impersonation',
    confidence: 'high',
    summary:
      'Look-alike domain posing as a university career programme. Collects student details and a small "registration fee" before redirecting to a credential-harvesting page. (Fictional demo campaign.)',
  },
  {
    id: 'CAM-2026-021',
    name: 'Fake Placement Verification Wave',
    firstSeen: '2026-09-04',
    domains: ['northstar-placement.example', 'student-placement.example'],
    category: 'Credential Phishing',
    confidence: 'high',
    summary:
      'Emails impersonate the placement cell and impose a short verification deadline to push students onto an external login form. (Fictional demo campaign.)',
  },
  {
    id: 'CAM-2026-026',
    name: 'Scholarship Document Collection',
    firstSeen: '2026-09-11',
    domains: ['northstar-university-scholarship.example'],
    category: 'Social Engineering',
    confidence: 'medium',
    summary:
      'Requests marksheets, identity documents and banking details through an external form, using real-looking programme and semester details. (Fictional demo campaign.)',
  },
  {
    id: 'CAM-2026-031',
    name: 'Look-alike Workshop Invitations',
    firstSeen: '2026-09-19',
    domains: ['northstar-university-edu.com'],
    category: 'Suspicious Link',
    confidence: 'medium',
    summary:
      'Typosquatted domain inviting students to a workshop that genuinely exists, but routing registration and sign-in through the look-alike host. (Fictional demo campaign.)',
  },
];

export const THREAT_CATEGORIES = [
  'Institution Impersonation',
  'Credential Phishing',
  'Malicious Link',
  'Social Engineering',
  'Suspicious Course Promotion',
  'Fake Placement Communication',
];

export function categorise(indicators = []) {
  const ids = indicators.map((i) => i.id);
  if (ids.includes('credential_request')) return 'Credential Phishing';
  if (ids.includes('sender_domain_mismatch') || ids.includes('lookalike_domain') || ids.includes('brand_impersonation'))
    return 'Institution Impersonation';
  if (ids.includes('external_link') || ids.includes('malicious_link')) return 'Malicious Link';
  if (ids.includes('urgency') || ids.includes('personalisation')) return 'Social Engineering';
  if (ids.includes('opportunity_bait')) return 'Suspicious Course Promotion';
  if (ids.includes('no_verified_announcement')) return 'Fake Placement Communication';
  return 'Institution Impersonation';
}

export function createMockThreatIntelService() {
  return {
    id: 'threatIntel',
    mode: 'mock',
    label: 'Threat intelligence (mock)',
    description: 'Fictional campaign dataset. No external feed is queried.',

    async lookup(domain, ctx = {}) {
      const d = String(domain ?? '').toLowerCase();
      const campaigns = FICTIONAL_CAMPAIGNS.filter((c) => c.domains.includes(d));
      const onWatchlist = ctx.watchlist?.has(d) ?? false;

      if (campaigns.length || onWatchlist) {
        return {
          domain: d,
          reputation: campaigns.length ? 'known-abuse-infrastructure' : 'watchlisted',
          confidence: campaigns.some((c) => c.confidence === 'high') ? 'high' : 'medium',
          onWatchlist,
          campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, category: c.category, firstSeen: c.firstSeen })),
          summary: campaigns.length
            ? `Associated with ${campaigns.length} fictional campaign record(s) in the demo intelligence set.`
            : 'Domain is on the institution watchlist.',
          simulated: true,
        };
      }

      return {
        domain: d,
        reputation: 'no-record',
        confidence: 'low',
        onWatchlist: false,
        campaigns: [],
        summary: 'No record in the demo threat-intelligence dataset.',
        simulated: true,
      };
    },
  };
}
