import { all } from '../db.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'at', 'with', 'your', 'you', 'we', 'is', 'are',
  'be', 'this', 'that', 'it', 'as', 'by', 'from', 'will', 'has', 'have', 'been', 'was', 'were', 'not', 'no',
  'official', 'university', 'college', 'northstar', 'students', 'student', 'all', 'our', 'new', 'please',
]);

export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function tokenSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = new Set([...setA, ...setB]).size;
  return Math.round((inter / union) * 100);
}

export const VERIFICATION_THRESHOLDS = {

  topicFloor: 30,

  topicMatch: 45,

  topicPartial: 30,
};

export function scoreAnnouncement(email, announcement) {
  const claim = `${email.subject ?? ''} ${email.body ?? ''}`;
  const haystack = `${announcement.title} ${announcement.announcement_type} ${announcement.department} ${announcement.description ?? ''} ${announcement.keywords ?? ''}`;

  const reasons = [];

  const lexical = tokenSimilarity(claim, haystack);

  const keywordTokens = tokenize(announcement.keywords ?? '');
  const claimTokens = new Set(tokenize(claim));
  const hits = keywordTokens.filter((k) => claimTokens.has(k));
  const keywordCoverage = keywordTokens.length ? hits.length / keywordTokens.length : 0;

  const topicScore = Math.max(0, Math.min(100, Math.round(lexical * 0.6 + keywordCoverage * 45)));

  if (lexical > 0) reasons.push(`Topical overlap with the verified record: ${lexical}%.`);
  if (hits.length) reasons.push(`Shared announcement keywords: ${hits.slice(0, 6).join(', ')}.`);

  const claimedDept = (email.claimedDepartment ?? '').toLowerCase().trim();
  const dept = (announcement.department ?? '').toLowerCase();
  const departmentAgreement = Boolean(claimedDept) && (dept.includes(claimedDept) || claimedDept.includes(dept));
  if (departmentAgreement) reasons.push(`Claimed department "${announcement.department}" matches the verified record.`);

  const claimedType = (email.claimedType ?? email.claimedAnnouncementType ?? '').toLowerCase().trim();
  const type = (announcement.announcement_type ?? '').toLowerCase();
  const typeAgreement = Boolean(claimedType) && (type.includes(claimedType) || claimedType.includes(type));
  if (typeAgreement) reasons.push(`Announcement type "${announcement.announcement_type}" matches the verified record.`);

  const senderDomain = String(email.from ?? '').split('@')[1]?.toLowerCase() ?? '';
  const senderMatch = Boolean(senderDomain) && senderDomain === (announcement.official_domain ?? '').toLowerCase();
  if (senderMatch) reasons.push(`Sender domain matches the official sender ${announcement.official_sender}.`);

  const links = email.links ?? [];
  const urlMatch = links.some((l) => {
    const a = String(l).toLowerCase().replace(/\/$/, '');
    const b = String(announcement.official_url ?? '').toLowerCase().replace(/\/$/, '');
    return a === b || a.startsWith(b) || b.startsWith(a);
  });
  if (urlMatch) reasons.push(`Link destination matches the official announcement URL ${announcement.official_url}.`);

  return {
    announcement,
    topicScore,

    score: topicScore,
    lexical,
    keywordCoverage: Math.round(keywordCoverage * 100),
    senderMatch,
    urlMatch,
    departmentAgreement,
    typeAgreement,
    keywordHits: hits,
    reasons,
  };
}

export function matchAnnouncement(email, announcements) {
  const scored = announcements
    .map((a) => scoreAnnouncement(email, a))
    .sort((a, b) => b.topicScore - a.topicScore);

  const best = scored[0] ?? null;
  const threshold = VERIFICATION_THRESHOLDS;

  if (!best) {
    return { status: 'NO MATCH FOUND', best: null, candidates: [], threshold };
  }

  const candidates = scored.slice(0, 3);

  if (
    best.topicScore >= threshold.topicMatch &&
    best.senderMatch &&
    best.urlMatch &&
    best.departmentAgreement
  ) {
    return { status: 'MATCH FOUND', best, candidates, threshold };
  }

  const anchoredToInstitution = best.senderMatch || best.urlMatch;
  const statesInstitutionalClaim = best.departmentAgreement && best.typeAgreement;
  if (anchoredToInstitution && statesInstitutionalClaim) {
    return { status: 'PARTIAL MATCH', best, candidates, threshold };
  }

  if (best.senderMatch && !best.urlMatch) {
    return { status: 'PARTIAL MATCH', best, candidates, threshold };
  }

  return { status: 'NO MATCH FOUND', best: null, candidates, threshold };
}

export function createMockAnnouncementSource() {
  return {
    id: 'announcementSource',
    mode: 'local',
    label: 'Institutional announcement source (local database)',
    description:
      'Reads verified announcements from the local prototype database. Replace with the institution CMS/ERP feed in production.',
    async list() {
      return all('SELECT * FROM verified_announcements ORDER BY publication_date DESC');
    },
    async match(email, announcements) {
      return matchAnnouncement(email, announcements ?? (await this.list()));
    },
  };
}
