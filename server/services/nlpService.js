export const LEXICONS = {
  urgency: [
    'urgent', 'immediately', 'immediate action', 'within 1 hour', 'within 2 hours', 'within 24 hours',
    'last chance', 'expires today', 'expires tonight', 'act now', 'final notice', 'time sensitive',
    'before it is too late', 'deadline today', 'as soon as possible', 'respond now',
  ],
  credential: [
    'password', 'login', 'log in', 'sign in', 'verify account', 'verify your account', 'username',
    'otp', 'one time password', 'credentials', 'authenticate', 're-enter your', 'confirm your password',
    'student portal login', 'university account',
  ],
  financial: [
    'payment', 'fee', 'registration fee', 'transfer', 'bank', 'bank account', 'upi', 'card details',
    'refundable deposit', 'processing charge', 'pay now', 'net banking',
  ],

  opportunity: [
    'you have been selected', 'you have been chosen', 'you are selected', 'has been selected',
    'congratulations', 'limited seats', 'limited number of seats', 'only a limited number',
    'exclusive', 'shortlisted', 'waiting list', 'guaranteed placement', 'selected for',
  ],
  pressure: [
    'failure to', 'may affect', 'will be released', 'cannot be considered', 'will be cancelled',
    'eligibility will', 'without further notice', 'no extensions', 'strictly', 'mandatory',
  ],
  dataRequest: [
    'marksheet', 'identity document', 'aadhaar', 'pan card', 'bank account details', 'upload your',
    'submit your documents', 'scanned copy', 'photograph', 'date of birth',
  ],
};

export const PERSONALISATION_FIELDS = [

  { id: 'student_name', label: 'Student name', pattern: /\b(?:student[ \t]*name|name of (?:the[ \t]+)?student|dear[ \t]+[A-Z][a-z]+[ \t]+[A-Z][a-z]+)\b/i },
  { id: 'program', label: 'Program', pattern: /\b(?:program(?:me)?|course|branch)\s*[:\-]/i },
  { id: 'semester', label: 'Semester', pattern: /\bsemester\s*[:\-]|\b\d(?:st|nd|rd|th)\s+semester\b/i },
  { id: 'roll_number', label: 'Roll number', pattern: /\broll\s*(?:no|number|#)?\s*[:\-]/i },
  { id: 'student_id', label: 'Student ID', pattern: /\b(?:student|enrol(?:l)?ment)\s*(?:id|no|number)\s*[:\-]/i },
  { id: 'department', label: 'Department', pattern: /\bdepartment\s*[:\-]/i },
  { id: 'college', label: 'College name', pattern: /\b(?:college|university|institute)\s*name\s*[:\-]/i },

  { id: 'registration_no', label: 'Registration number', pattern: /\bregistration\s*(?:no|number|#|id)\s*[:\-]\s*[A-Z0-9][A-Z0-9\-/]{3,}/i },
];

const ROLE_ADDRESSES = [
  'placement', 'placements', 'training', 'scholarship', 'scholarships', 'accounts', 'library',
  'academic', 'academic.office', 'research', 'studentaffairs', 'student.affairs', 'cs.dept',
  'careers', 'innovation', 'admin', 'registrar', 'examination', 'hostel', 'support', 'helpdesk',
  'verify', 'verification', 'info', 'no-reply', 'noreply', 'security',
];

const URGENT_SUBJECT_PATTERNS = [
  /\bURGENT\b/i, /\bIMMEDIATE ACTION\b/i, /\bFINAL (?:NOTICE|REMINDER|WARNING)\b/i,
  /\bLAST (?:CHANCE|DATE)\b/i, /\bEXPIRES?\b/i, /\bACT NOW\b/i, /!{2,}/,
];

const NEGATION_CUES = [
  'no ', 'not ', 'never ', 'without ', 'cannot ', 'can not ', 'do not ', 'does not ',
  "don't ", "doesn't ", 'is not ', 'are not ', 'will not ', 'no charge', 'free of',
];

function findPhrases(text, phrases) {
  const lower = String(text ?? '').toLowerCase();
  const hits = [];
  for (const p of phrases) {
    const needle = p.toLowerCase();
    let from = 0;
    let found = false;
    while (from <= lower.length) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;

      const window = lower.slice(Math.max(0, at - 40), at);
      const clauseStart = Math.max(window.lastIndexOf('.'), window.lastIndexOf('\n'), window.lastIndexOf(';'), window.lastIndexOf('!'), window.lastIndexOf('?'));
      const clause = clauseStart === -1 ? window : window.slice(clauseStart + 1);
      const negated = NEGATION_CUES.some((cue) => clause.includes(cue));
      if (!negated) {
        found = true;
        break;
      }
      from = at + needle.length;
    }
    if (found) hits.push(p);
  }
  return hits;
}

export function detectSocialEngineering(email) {
  const subject = email.subject ?? '';
  const body = email.body ?? '';
  const all = `${subject}\n${body}`;

  const urgencyHits = findPhrases(all, LEXICONS.urgency);
  const subjectUrgency = URGENT_SUBJECT_PATTERNS.filter((r) => r.test(subject));
  const credentialHits = findPhrases(all, LEXICONS.credential);
  const financialHits = findPhrases(all, LEXICONS.financial);
  const opportunityHits = findPhrases(all, LEXICONS.opportunity);
  const pressureHits = findPhrases(all, LEXICONS.pressure);
  const dataHits = findPhrases(all, LEXICONS.dataRequest);

  const SUBJECT_PATTERN_LABELS = {
    '\\bURGENT\\b': 'uppercase URGENT in the subject',
    '\\bIMMEDIATE ACTION\\b': 'IMMEDIATE ACTION in the subject',
    '\\bFINAL (?:NOTICE|REMINDER|WARNING)\\b': 'FINAL NOTICE in the subject',
    '\\bLAST (?:CHANCE|DATE)\\b': 'LAST CHANCE in the subject',
    '\\bEXPIRES?\\b': 'EXPIRES in the subject',
    '\\bACT NOW\\b': 'ACT NOW in the subject',
    '!{2,}': 'multiple exclamation marks in the subject',
  };
  const subjectUrgencyLabels = subjectUrgency.map(
    (r) => SUBJECT_PATTERN_LABELS[r.source] ?? `subject matches /${r.source}/`,
  );

  const build = (id, label, hits, extra, weight, severity, explanation) => ({
    id,
    label,
    status: hits.length + (extra?.length ?? 0) > 0 ? 'DETECTED' : 'NOT DETECTED',
    severity,
    weight,
    evidence: [...new Set([...hits, ...(extra ?? [])])].slice(0, 6),
    explanation,
  });

  return [
    build(
      'urgency',
      'Urgency',
      urgencyHits,
      subjectUrgencyLabels,
      10,
      'high',
      'The message pushes the reader to act within a short window, which is a common social-engineering pressure tactic.',
    ),
    build(
      'credential_request',
      'Credential request',
      credentialHits,
      [],
      15,
      'high',
      'The message asks the reader to sign in, verify an account or supply credentials. Institutions do not collect credentials by email.',
    ),
    build(
      'financial_request',
      'Financial request',
      financialHits,
      [],
      8,
      'high',
      'The message mentions payment, fees or banking details. Verified institutional notices state that no fee is charged and never request bank details.',
    ),
    build(
      'opportunity_bait',
      'Opportunity bait',
      opportunityHits,
      [],
      6,
      'medium',
      'Selection, exclusivity and limited-seat language is used to make the offer feel time-critical and personal.',
    ),
    build(
      'pressure_language',
      'Pressure language',
      pressureHits,
      [],
      8,
      'high',
      'The message threatens a consequence (lost eligibility, released seat, cancelled application) to force compliance.',
    ),
    build(
      'sensitive_data_request',
      'Request for sensitive documents',
      dataHits,
      [],
      8,
      'medium',
      'The message asks for identity documents or banking details, which genuine institutional notices route through the student portal.',
    ),
  ];
}

export function detectPersonalisation(email, student = null) {
  const text = `${email.subject ?? ''}\n${email.body ?? ''}`;

  const structured = [...text.matchAll(/^\s*([A-Za-z ]{3,30})\s*:\s*(.+)$/gm)]
    .map(([, key, value]) => ({ key: key.trim(), value: value.trim() }))
    .filter(({ key }) =>
      PERSONALISATION_FIELDS.some(
        (f) => key.toLowerCase().includes(f.id.replace(/_/g, ' ')) || f.label.toLowerCase() === key.toLowerCase(),
      ),
    );

  const structuredByKey = new Map(structured.map((s) => [s.key.toLowerCase(), s.value]));

  const fieldsWithValues = PERSONALISATION_FIELDS.flatMap((f) => {
    const m = text.match(f.pattern);
    if (!m) return [];
    const labelKey = f.label.toLowerCase();
    const value =
      structuredByKey.get(labelKey) ??
      structured.find((s) => s.key.toLowerCase().includes(labelKey))?.value ??
      m[0].trim();
    return [{ id: f.id, label: f.label, matched: m[0].trim(), value: value || m[0].trim() }];
  });

  const matchedStudentFields = [];
  if (student) {
    const checks = [
      ['Student name', student.name],
      ['Program', student.program],
      ['Semester', student.semester],
      ['Roll number', student.rollNumber],
      ['Student ID', student.studentId],
      ['Department', student.department],
      ['College name', student.college],
    ];
    for (const [label, value] of checks) {
      if (value && String(text).toLowerCase().includes(String(value).toLowerCase())) {
        matchedStudentFields.push({ label, value });
      }
    }
  }

  const detected = fieldsWithValues.length > 0 || matchedStudentFields.length > 0;

  return {
    detected,
    status: detected ? 'DETECTED' : 'NOT DETECTED',
    fields: fieldsWithValues,
    structured,
    matchedRecipientFields: matchedStudentFields,
    summary: detected
      ? 'Personalised institutional information detected.'
      : 'No student-specific institutional information detected.',
    interpretation:
      'The email contains student-specific information. The source of this information cannot be determined from the email alone — it may come from a public listing, a third-party form, a previous breach, or an internal leak. CampusShield does not conclude that any student database was compromised.',
  };
}

export function analyseCommunicationStyle(email, ctx = {}) {
  const domain = String(email.from ?? '').split('@')[1]?.toLowerCase() ?? '';
  const local = String(email.from ?? '').split('@')[0]?.toLowerCase() ?? '';
  const verifiedDomain = ctx.verifiedDomain ?? false;
  const knownRole = ROLE_ADDRESSES.includes(local) || ROLE_ADDRESSES.some((r) => local.startsWith(`${r}.`) || local.startsWith(`${r}-`));

  const signals = [];
  let score = 0;

  if (verifiedDomain) {
    score += 3;
    signals.push('Sender domain is a verified institutional domain.');
  } else {
    signals.push('Sender domain is not a verified institutional domain.');
  }

  if (knownRole && verifiedDomain) {
    score += 1;
    signals.push(`Functional mailbox "${local}@" follows normal institutional naming (department or office role address).`);
  } else if (knownRole && !verifiedDomain) {
    signals.push(`Local part "${local}@" copies an institutional role address on an unverified domain.`);
  } else if (!knownRole) {
    signals.push(`Local part "${local}@" is not a recognised institutional role address.`);
  }

  const body = String(email.body ?? '');
  if (/^dear\s+(students|all)/im.test(body)) {
    score += 1;
    signals.push('Greeting matches the institution-wide "Dear Students" broadcast style.');
  }
  if (/regards,?\s*\n?\s*[A-Za-z ]+\n/i.test(body) || /\bregards\b/i.test(body)) {
    score += 1;
    signals.push('Message closes with an institutional-style signature block.');
  }
  if (/\b(?:the|this)\s+(?:university|college|institute)\b/i.test(body)) {
    signals.push('Refers to itself in the third person as "the university/college", typical of official notices.');
  }
  if (/(?:https?:\/\/)?(?:portal\.)?northstaruniversity\.edu/i.test(body)) {
    signals.push('Body references an official institutional URL.');
  }

  const status = verifiedDomain ? (score >= 3 ? 'CONSISTENT' : 'UNKNOWN') : 'INCONSISTENT';

  return {
    status,
    score,
    maxScore: 6,
    signals,
    summary:
      status === 'CONSISTENT'
        ? 'Sender, greeting, signature and link destinations follow the institution\'s normal broadcast pattern.'
        : status === 'INCONSISTENT'
          ? 'The message does not follow the institution\'s normal communication pattern (unverified sender domain).'
          : 'Communication pattern could not be fully compared for this message.',
  };
}

export function parseAddress(address) {
  const raw = String(address ?? '').trim();
  const angle = raw.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : raw).trim();
  const at = addr.lastIndexOf('@');
  if (at === -1) return { address: addr, local: addr, domain: '', valid: false, display: '' };
  return {
    address: addr,
    local: addr.slice(0, at).toLowerCase(),
    domain: addr.slice(at + 1).toLowerCase(),
    valid: /.+\..+/.test(addr.slice(at + 1)),
    display: angle ? raw.slice(0, raw.indexOf('<')).trim().replace(/^"|"$/g, '') : '',
  };
}

export function createMockNlpService() {
  return {
    id: 'nlp',
    mode: 'rule-based',
    label: 'Context Analysis Engine (rule-based)',
    description:
      'Deterministic phrase and pattern detection. No external AI model is used; the interface allows a hosted model to be dropped in later.',
    async analyseText(email, ctx = {}) {
      return {
        socialEngineering: detectSocialEngineering(email),
        personalisation: detectPersonalisation(email, ctx.student ?? null),
        communicationStyle: analyseCommunicationStyle(email, ctx),
        engine: { id: 'campusshield-context-engine', mode: 'rule-based', version: '1.2.0-prototype' },
      };
    },
  };
}
