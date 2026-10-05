import { VERIFIED_DOMAINS, RISK_MODEL, bandFor, INSTITUTION } from './data/institution.js';
import { analyzeLink, domainSimilarityScore } from './services/urlReputationService.js';
import { simulateAuthentication } from './services/authenticationService.js';
import {
  detectSocialEngineering,
  detectPersonalisation,
  analyseCommunicationStyle,
  parseAddress,
} from './services/nlpService.js';
import { matchAnnouncement } from './services/announcementSource.js';
import { categorise } from './services/threatIntelService.js';

const SATURATION_K = 70;

const VERIFIED_DOMAINS_LIST = VERIFIED_DOMAINS.map((d) => d.domain.toLowerCase());

const FORM_HINTS = [
  'register', 'registration', 'signup', 'sign-up', 'apply', 'application',
  'verify', 'verification', 'form', 'submit', 'confirm', 'login', 'auth', 'account',
];

export function clamp(n, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n));
}

export function isInstitutionalDomain(domain, list = VERIFIED_DOMAINS_LIST) {
  const d = String(domain ?? '').toLowerCase();
  if (!d) return false;
  return list.some((v) => d === v || d.endsWith(`.${v}`));
}

export function isFormLink(url) {
  const u = String(url ?? '').toLowerCase();
  if (!u) return false;
  if (/[?&](?:form|submit|apply|register|verify|login)/.test(u)) return true;
  try {
    const path = new URL(u).pathname.toLowerCase();
    return FORM_HINTS.some((h) => path.includes(h));
  } catch {
    return FORM_HINTS.some((h) => u.includes(h));
  }
}

export function aggregate(indicators) {
  const rawScore = indicators.reduce((sum, i) => sum + i.weight, 0);
  if (rawScore <= 0) return { rawScore, score: 0 };
  const score = Math.round(100 * (1 - Math.exp(-rawScore / SATURATION_K)));
  return { rawScore, score: clamp(score) };
}

export function analyzeEmail(email, context = {}) {
  const announcements = context.announcements ?? [];
  const watchlist =
    context.watchlist instanceof Set ? context.watchlist : new Set(context.watchlist ?? []);
  const student = context.student ?? null;
  const now = context.now instanceof Date ? context.now : new Date();

  const sender = parseAddress(email.from);
  const recipient = parseAddress(email.to ?? '');
  const links = (email.links ?? []).filter(Boolean);

  const senderVerified = sender.valid && isInstitutionalDomain(sender.domain);
  const similarity = sender.domain
    ? Math.max(...VERIFIED_DOMAINS_LIST.map((v) => domainSimilarityScore(sender.domain, v)))
    : 0;

  const authentication = simulateAuthentication(email, { knownBad: watchlist });

  const contextMatch = matchAnnouncement({ ...email, links }, announcements);

  const linkAnalysis = links.map((u) => analyzeLink(u, { watchlist }));

  const social = detectSocialEngineering(email);

  const personalisation = detectPersonalisation(email, student);

  const communicationStyle = analyseCommunicationStyle(email, { verifiedDomain: senderVerified });

  const indicators = [];
  const push = (id, label, weight, detail, evidence = []) =>
    indicators.push({ id, label, weight, detail, evidence });

  const linkDestinationsAllInstitutional =
    linkAnalysis.length > 0 && linkAnalysis.every((l) => l.institutional);
  if (senderVerified) {
    const fullCredit = linkAnalysis.length === 0 || linkDestinationsAllInstitutional;
    push(
      'verified_sender',
      fullCredit ? 'Sender domain is a verified institutional domain' : 'Sender domain is verified, but the destination link is not',
      fullCredit ? -25 : -8,
      fullCredit
        ? `${sender.domain} is a verified institutional domain.`
        : `${sender.domain} is a verified institutional domain, but the message does not link to an official institutional URL — consistent with a compromised mailbox or an injected link.`,
      [email.from],
    );
    if (!fullCredit) {
      push(
        'verified_sender_link_mismatch',
        'Verified sender used with a non-institutional destination link',
        20,
        'The sender is a genuine institutional address while the destination is not, which is the standard pattern for a compromised mailbox or a tampered message.',
        linkAnalysis.filter((l) => !l.institutional).map((l) => l.host),
      );
    }
  } else {
    push(
      'sender_domain_mismatch',
      'Sender domain does not match a verified institutional domain',
      25,
      `The message was sent from ${sender.domain || 'an unparseable address'}, which is not one of the institution's verified domains.`,
      [email.from].filter(Boolean),
    );
    if (similarity >= 60) {
      push(
        'lookalike_domain',
        "Sender domain closely resembles the institution's own domain",
        10,
        `Domain similarity of ${similarity}% to a verified institutional domain — consistent with a look-alike (typosquat) domain.`,
        [sender.domain],
      );
    }
  }

  if (contextMatch.status === 'MATCH FOUND' && contextMatch.best) {
    push(
      'verified_announcement',
      'Claim corresponds to a verified institutional announcement',
      -30,
      `Matched the verified record "${contextMatch.best.announcement.title}" published by ${contextMatch.best.announcement.department}.`,
      [contextMatch.best.announcement.official_url],
    );
  } else if (contextMatch.status === 'PARTIAL MATCH') {
    push(
      'partial_announcement_stub',
      'A similar announcement exists, but the sender or destination differs',
      8,
      contextMatch.best
        ? `The closest verified record is "${contextMatch.best.announcement.title}", but the sender or destination link does not match that record.`
        : 'No closely corresponding announcement was found.',
    );
  } else {
    push(
      'no_verified_announcement',
      'No corresponding announcement found in the verified database',
      20,
      'The claimed programme, drive or notice does not appear in the verified institutional announcement record.',
    );
  }

  const externalLinks = linkAnalysis.filter((l) => l.valid && !l.institutional);
  const formLinks = externalLinks.filter((l) => isFormLink(l.url));
  if (externalLinks.length) {
    push(
      'external_link',
      "Link destination is outside the institution's domains",
      12,
      `${externalLinks.length} link(s) point to non-institutional hosts.`,
      externalLinks.map((l) => l.host),
    );
  }
  if (formLinks.length) {
    push(
      'external_registration_link',
      'External registration / verification form',
      20,
      'The message routes registration, verification or document submission through a form hosted outside the institution.',
      formLinks.map((l) => l.url),
    );
  }
  if (linkAnalysis.some((l) => l.status === 'MALICIOUS')) {
    push(
      'malicious_link',
      'Destination appears in the fictional malicious-link dataset',
      15,
      'At least one destination matches known abuse infrastructure in the demo threat-intelligence set.',
      linkAnalysis.filter((l) => l.status === 'MALICIOUS').map((l) => l.host),
    );
  }
  if (senderVerified && linkAnalysis.length > 0 && linkAnalysis.every((l) => l.institutional)) {
    push('verified_official_link', 'All link destinations are official institutional URLs', -20, 'Every link in the message points at a verified institutional domain.');
  }

  if (!senderVerified && communicationStyle.status === 'INCONSISTENT') {
    push('communication_pattern', "Unusual institutional communication pattern", 10, communicationStyle.summary, communicationStyle.signals.slice(0, 4));
  } else if (senderVerified && communicationStyle.status === 'CONSISTENT') {
    push('consistent_pattern', "Consistent with the institution's normal communication pattern", -6, communicationStyle.summary);
  }

  const socialWeights = {
    urgency: 10,
    credential_request: 15,
    financial_request: 8,
    opportunity_bait: 6,
    pressure_language: 8,
    sensitive_data_request: 8,
  };
  for (const s of social) {
    if (s.status !== 'DETECTED') continue;
    push(`social_${s.id}`, s.label, socialWeights[s.id] ?? 5, s.explanation, s.evidence);
  }

  if (personalisation.detected) {
    push(
      'personalisation',
      'Student-specific information used in the message',
      10,
      personalisation.interpretation,
      personalisation.matchedRecipientFields
        .map((f) => `${f.label}: ${f.value}`)
        .concat(personalisation.fields.map((f) => f.matched))
        .slice(0, 6),
    );
  }

  if (watchlist.has(sender.domain)) {
    push('watchlisted_sender', 'Sender domain is on the institution watchlist', 15, `${sender.domain} is already on the security watchlist.`);
  }

  const { score, rawScore } = aggregate(indicators);
  const band = bandFor(score);

  return {
    model: RISK_MODEL,
    score,
    rawScore,
    level: band.level,
    band,
    category: categorise(indicators),
    confidence: band.level === 'LOW' ? 'LOW' : band.level === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
    indicators,
    scoreBreakdown: indicators.map((i) => ({ id: i.id, label: i.label, weight: i.weight })),
    checks: buildChecks({
      email, sender, recipient, senderVerified, similarity, authentication,
      contextMatch, linkAnalysis, social, personalisation, communicationStyle,
    }),
    linkAnalysis,
    authentication,
    contextMatch,
    communicationStyle,
    personalisation,
    sender: { ...sender, verified: senderVerified, similarity },
    recipient,
    verdict: buildVerdict({ email, indicators, band, score, contextMatch, personalisation, linkAnalysis, senderVerified }),
    analysisLog: buildLog({ sender, authentication, contextMatch, linkAnalysis, social, personalisation, communicationStyle, band, rawScore, score, now }),
    engine: { id: 'campusshield-context-engine', mode: 'rule-based', version: RISK_MODEL.version },
    generatedAt: now.toISOString(),
  };
}

function buildChecks({
  email, sender, recipient, senderVerified, similarity, authentication,
  contextMatch, linkAnalysis, social, personalisation, communicationStyle,
}) {
  const socialById = Object.fromEntries(social.map((s) => [s.id, s]));
  const externalLinks = linkAnalysis.filter((l) => l.valid && !l.institutional);
  const primaryLink = linkAnalysis[0] ?? null;

  return [
    {
      id: 'sender_verification',
      title: 'SENDER VERIFICATION',
      icon: 'sender',
      status: senderVerified ? 'PASSED' : 'FAILED',
      tone: senderVerified ? 'safe' : 'danger',
      fields: [
        { label: 'Sender', value: email.from || '—', mono: true },
        { label: 'Domain', value: sender.domain || 'unparseable', mono: true },
        { label: 'Verified institution', value: INSTITUTION.primaryDomain, mono: true },
        { label: 'Domain similarity', value: `${similarity}%`, mono: true },
        { label: 'Recipient', value: email.to || recipient.address || '—', mono: true },
      ],
      explanation: senderVerified
        ? 'The sender domain matches a verified institutional domain.'
        : 'The sender domain does not match a verified institutional domain.',
    },
    {
      id: 'email_authentication',
      title: 'EMAIL AUTHENTICATION',
      icon: 'auth',
      status: senderVerified ? 'PASSED' : authentication.spf.status === 'FAIL' ? 'FAILED' : 'UNKNOWN',
      tone: senderVerified ? 'safe' : authentication.spf.status === 'FAIL' ? 'danger' : 'warn',
      simulated: true,
      simulatedNote: 'Simulated authentication results for prototype — derived from the sender domain, not from live mail headers.',
      fields: [
        { label: 'SPF', value: authentication.spf.status, mono: true, status: authentication.spf.status },
        { label: 'DKIM', value: authentication.dkim.status, mono: true, status: authentication.dkim.status },
        { label: 'DMARC', value: authentication.dmarc.status, mono: true, status: authentication.dmarc.status },
        { label: 'From alignment', value: authentication.alignment.status, mono: true, status: authentication.alignment.status },
        { label: 'Header forensics', value: authentication.headerForensics.status, mono: true },
      ],
      explanation: authentication.spf.detail,
      details: [authentication.dkim.detail, authentication.dmarc.detail, authentication.headerForensics.detail],
    },
    {
      id: 'institutional_context',
      title: 'INSTITUTIONAL CONTEXT',
      icon: 'context',
      status: contextMatch.status,
      tone: contextMatch.status === 'MATCH FOUND' ? 'safe' : contextMatch.status === 'PARTIAL MATCH' ? 'warn' : 'danger',
      fields: [
        { label: 'Claim', value: email.subject || '—' },
        { label: 'Claimed department', value: email.claimedDepartment || 'not stated' },
        { label: 'Verified announcement', value: contextMatch.best ? contextMatch.best.announcement.title : 'Not found' },
        { label: 'Match confidence', value: `${contextMatch.best?.score ?? 0}%`, mono: true },
      ],
      explanation:
        contextMatch.status === 'MATCH FOUND'
          ? 'The claimed announcement exists in the verified institutional record.'
          : contextMatch.status === 'PARTIAL MATCH'
            ? 'A similar announcement exists in the verified record, but the sender or the destination link differs.'
            : 'The claimed announcement does not exist in the verified institutional record.',
      reasons: contextMatch.best?.reasons ?? [],
    },
    {
      id: 'link_analysis',
      title: 'LINK ANALYSIS',
      icon: 'link',
      status: primaryLink ? primaryLink.status : 'NO LINKS',
      tone: !primaryLink ? 'neutral' : primaryLink.institutional ? 'safe' : primaryLink.status === 'MALICIOUS' ? 'danger' : 'warn',
      simulated: true,
      simulatedNote: 'Simulated reputation values. The prototype never opens, fetches or resolves a link from an email.',
      fields: primaryLink
        ? [
            { label: 'Visible link', value: primaryLink.url, mono: true },
            { label: 'Destination domain', value: primaryLink.host, mono: true },
            { label: 'Institution domain match', value: primaryLink.institutional ? 'YES' : 'NO', mono: true, status: primaryLink.institutional ? 'PASS' : 'FAIL' },
            { label: 'HTTPS', value: primaryLink.https ? 'YES' : 'NO', mono: true, status: primaryLink.https ? 'PASS' : 'FAIL' },
            { label: 'Redirect risk', value: primaryLink.redirectRisk.toUpperCase(), mono: true },
            { label: 'Domain reputation', value: primaryLink.reputation, mono: true },
            { label: 'Domain similarity', value: `${primaryLink.similarity}%`, mono: true },
          ]
        : [{ label: 'Links found', value: 'none' }],
      explanation: primaryLink
        ? primaryLink.institutional
          ? 'The link destination is a verified institutional domain.'
          : 'The link destination is not a verified institutional domain.'
        : 'No links were present in the submitted message.',
      findings: primaryLink?.findings ?? [],
      allLinks: linkAnalysis,
      externalCount: externalLinks.length,
    },
    {
      id: 'social_engineering',
      title: 'SOCIAL ENGINEERING ANALYSIS',
      icon: 'social',
      status: social.some((s) => s.status === 'DETECTED') ? 'INDICATORS DETECTED' : 'NONE DETECTED',
      tone: social.some((s) => s.status === 'DETECTED') ? 'warn' : 'safe',
      fields: social.map((s) => ({
        label: s.label,
        value: s.status,
        mono: true,
        status: s.status === 'DETECTED' ? 'DETECTED' : 'PASS',
        evidence: s.evidence,
      })),
      explanation: social.some((s) => s.status === 'DETECTED')
        ? 'Language patterns commonly used in social engineering were detected. Individual indicators are listed above with the phrases that triggered them.'
        : 'No social-engineering language patterns were detected in this message.',
    },
    {
      id: 'student_information',
      title: 'STUDENT INFORMATION USAGE',
      icon: 'student',
      status: personalisation.detected ? 'DETECTED' : 'NOT DETECTED',
      tone: personalisation.detected ? 'warn' : 'safe',
      fields: [
        { label: 'Personalised fields', value: personalisation.fields.length ? personalisation.fields.map((f) => f.label).join(', ') : 'none' },
        { label: 'Matched to recipient profile', value: personalisation.matchedRecipientFields.length ? personalisation.matchedRecipientFields.map((f) => f.label).join(', ') : 'none' },
      ],
      explanation: personalisation.summary,
      interpretation: personalisation.interpretation,
      detectedFields: personalisation.fields,
      matchedRecipientFields: personalisation.matchedRecipientFields,
    },
    {
      id: 'communication_pattern',
      title: 'COLLEGE COMMUNICATION PATTERN',
      icon: 'pattern',
      status: communicationStyle.status,
      tone: communicationStyle.status === 'CONSISTENT' ? 'safe' : communicationStyle.status === 'INCONSISTENT' ? 'danger' : 'warn',
      fields: [
        { label: 'Sender pattern', value: senderVerified ? 'official domain' : 'unverified domain', mono: true },
        { label: 'Department match', value: email.claimedDepartment ? 'claimed' : 'not stated' },
        { label: 'Announcement type', value: email.claimedAnnouncementType || 'not stated' },
        { label: 'Official URL usage', value: linkAnalysis.some((l) => l.institutional) ? 'yes' : 'no', mono: true },
        { label: 'Existing announcement', value: contextMatch.status, mono: true },
      ],
      explanation: communicationStyle.summary,
      signals: communicationStyle.signals,
      score: `${communicationStyle.score}/${communicationStyle.maxScore}`,
    },
  ];
}

function buildVerdict({ email, indicators, band, score, contextMatch, personalisation, linkAnalysis, senderVerified }) {
  const positive = indicators.filter((i) => i.weight > 0).sort((a, b) => b.weight - a.weight);
  const negative = indicators.filter((i) => i.weight < 0);

  const reasons = positive.map((i) => i.detail);

  if (!positive.length) {
    return {
      headline: 'NO RISK INDICATORS DETECTED',
      tone: 'safe',
      summary:
        'CampusShield found no risk indicators for this message. The sender is a verified institutional domain and the claim corresponds to a verified announcement.',
      reasons: [
        'The sender domain matches a verified institutional domain.',
        'The claimed announcement exists in the verified announcement database.',
        'Link destinations resolve to official institutional URLs.',
        'No urgency, credential request or pressure language was detected.',
      ],
      corroborating: negative.map((i) => i.label),
      recommendedAction: [
        'The message is consistent with verified institutional communication.',
        'As always, only act on official links and never share credentials by email.',
      ],
    };
  }

  const recommendedAction = [];
  recommendedAction.push('Do not click any link contained in this email.');
  if (contextMatch.status !== 'MATCH FOUND') {
    recommendedAction.push('Verify the announcement through the official student portal or another trusted institutional channel.');
  }
  if (!senderVerified) {
    recommendedAction.push('If the message claims to come from a department, contact that department using the address published on the official website.');
  }
  if (positive.some((i) => i.id === 'credential_request')) {
    recommendedAction.push('Never enter your institutional password, OTP or portal credentials on a page reached from an email.');
  }
  if (positive.some((i) => i.id === 'financial_request')) {
    recommendedAction.push('Institutional notices never request a fee or banking details by email. Do not make any payment.');
  }
  if (positive.some((i) => i.id === 'personalisation')) {
    recommendedAction.push('Treat the personal details in the message as unverified: they do not prove the sender is the institution.');
  }
  recommendedAction.push('Report the message to Campus Security using the Report button below.');

  const headline =
    band.level === 'CRITICAL'
      ? 'CRITICAL RISK — POTENTIAL INSTITUTION IMPERSONATION'
      : band.level === 'HIGH'
        ? 'HIGH RISK — LIKELY IMPERSONATION ATTEMPT'
        : band.level === 'MEDIUM'
          ? 'MEDIUM RISK — UNABLE TO VERIFY'
          : 'LOW RISK — NO SIGNIFICANT INDICATORS';

  const summary =
    band.level === 'CRITICAL' || band.level === 'HIGH'
      ? `CampusShield identified ${positive.length} risk indicator${positive.length === 1 ? '' : 's'} consistent with institution-impersonation phishing. This is a potential impersonation attempt — CampusShield cannot confirm intent from the email alone.`
      : band.level === 'MEDIUM'
        ? `CampusShield detected ${positive.length} risk indicator${positive.length === 1 ? '' : 's'} and could not fully verify this message against the institutional record.`
        : 'CampusShield detected limited risk indicators. Review the individual checks before acting.';

  return {
    headline,
    tone: band.level === 'LOW' ? 'safe' : band.level === 'MEDIUM' ? 'warn' : 'danger',
    summary,
    reasons,
    corroborating: negative.map((i) => i.label),
    recommendedAction,
    uncertaintyNote:
      'This assessment describes risk indicators, not certainty. CampusShield reports "potential impersonation", "suspicious" or "unable to verify" — it does not claim to know the sender\'s intent.',
  };
}

function buildLog({ sender, authentication, contextMatch, linkAnalysis, social, personalisation, communicationStyle, band, rawScore, score, now }) {
  const t = new Date(now.getTime());
  const stamp = () => {
    const s = t.toTimeString().slice(0, 8);
    t.setSeconds(t.getSeconds() + 1);
    return s;
  };
  const line = (msg, level = 'info') => ({ time: stamp(), level, message: msg });

  const log = [
    line('Initializing threat engine...'),
    line('Parsing email headers...'),
    line(`Sender address parsed: ${sender.address || 'unparseable'}`, sender.valid ? 'info' : 'warn'),
    line(`Sender domain analyzed: ${sender.domain || 'unknown'}`),
    line(
      sender.verified
        ? 'Sender domain matches a verified institutional domain.'
        : 'Institutional domain mismatch.',
      sender.verified ? 'ok' : 'fail',
    ),
    line(`Extracting URLs (${linkAnalysis.length} found)...`),
    ...linkAnalysis.map((l) =>
      line(
        l.institutional
          ? `Link verified as institutional: ${l.host}`
          : `External destination detected: ${l.host} (${l.status})`,
        l.institutional ? 'ok' : 'warn',
      ),
    ),
    line('Running simulated authentication checks (SPF/DKIM/DMARC)...'),
    line(`SPF=${authentication.spf.status} DKIM=${authentication.dkim.status} DMARC=${authentication.dmarc.status}`, authentication.spf.status === 'PASS' ? 'ok' : 'warn'),
    line('Running context verification against verified announcements...'),
    line(
      contextMatch.status === 'MATCH FOUND'
        ? `Verified announcement matched: ${contextMatch.best.announcement.title}`
        : contextMatch.status === 'PARTIAL MATCH'
          ? 'Partial match only — sender or link differs from the verified record.'
          : 'No matching announcement found.',
      contextMatch.status === 'MATCH FOUND' ? 'ok' : 'fail',
    ),
    line('Scanning message body for social-engineering indicators...'),
    ...social
      .filter((s) => s.status === 'DETECTED')
      .map((s) => line(`${s.label}: detected (${s.evidence.slice(0, 3).join(', ') || 'pattern match'})`, 'warn')),
    line('Scanning for student-specific information...'),
    line(
      personalisation.detected
        ? `Personalised institutional information detected (${personalisation.fields.length + personalisation.matchedRecipientFields.length} field(s)).`
        : 'No student-specific information detected.',
      personalisation.detected ? 'warn' : 'ok',
    ),
    line(`Comparing against normal institutional communication patterns: ${communicationStyle.status}`),
    line(`Risk assessment complete. Raw indicator weight: ${rawScore >= 0 ? '+' : ''}${rawScore}.`),
    line(`Prototype Risk Score: ${score}/100 — ${band.level} band (${band.min}–${band.max}).`, band.level === 'LOW' ? 'ok' : 'fail'),
  ];
  return log;
}

export function verifyClaim(email, announcements) {
  const result = matchAnnouncement(email, announcements);
  const best = result.best;

  const record = best
    ? {
        id: best.announcement.id,
        title: best.announcement.title,
        department: best.announcement.department,
        announcement_type: best.announcement.announcement_type,
        official_sender: best.announcement.official_sender,
        official_domain: best.announcement.official_domain,
        official_url: best.announcement.official_url,
        publication_date: best.announcement.publication_date,
        description: best.announcement.description,
      }
    : null;

  if (result.status === 'MATCH FOUND') {
    return {
      outcome: 'VERIFIED',
      headline: 'VERIFIED ANNOUNCEMENT',
      message: 'This email appears to correspond to an announcement in the verified institutional database.',
      record,
      matchScore: best?.score ?? 0,
      reasons: best?.reasons ?? [],
      mismatches: [],
      recommendation:
        'The claim matches the official record. Continue to use only official channels when acting on this announcement.',
      engine: { id: 'campusshield-context-engine', mode: 'rule-based', version: RISK_MODEL.version },
      candidates: result.candidates.slice(0, 3).map((c) => ({
        id: c.announcement.id,
        title: c.announcement.title,
        department: c.announcement.department,
        score: c.score,
      })),
    };
  }

  if (result.status === 'PARTIAL MATCH') {
    return {
      outcome: 'PARTIAL',
      headline: 'PARTIAL MATCH',
      message: 'A similar announcement exists, but the sender or the destination link differs from the verified record.',
      record,
      matchScore: best?.score ?? 0,
      reasons: best?.reasons ?? [],
      mismatches: best
        ? [
            !best.senderMatch
              ? `Sender ${email.from || 'unknown'} does not match the official sender ${best.announcement.official_sender}.`
              : null,
            !best.urlMatch
              ? `The destination link does not match the official URL ${best.announcement.official_url}.`
              : null,
          ].filter(Boolean)
        : [],
      recommendation:
        'Do not act on the link in this email. Open the official announcement through the student portal or the institutional website instead.',
      engine: { id: 'campusshield-context-engine', mode: 'rule-based', version: RISK_MODEL.version },
      candidates: result.candidates.slice(0, 3).map((c) => ({
        id: c.announcement.id,
        title: c.announcement.title,
        department: c.announcement.department,
        score: c.score,
      })),
    };
  }

  return {
    outcome: 'NO_MATCH',
    headline: 'NO VERIFIED MATCH',
    message: 'No corresponding announcement was found in the verified institutional announcement database.',
    record: null,
    matchScore: best?.score ?? 0,
    reasons: [],
    mismatches: [],
    recommendation:
      'Do not use the link contained in the email. Verify through the official student portal or another trusted institutional channel.',
    engine: { id: 'campusshield-context-engine', mode: 'rule-based', version: RISK_MODEL.version },
    candidates: result.candidates.slice(0, 3).map((c) => ({
      id: c.announcement.id,
      title: c.announcement.title,
      department: c.announcement.department,
      score: c.score,
    })),
  };
}

export function analyzeMany(emails, context = {}) {
  return emails.map((e) => analyzeEmail(e, context));
}
