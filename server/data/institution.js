export const INSTITUTION = {
  id: 'northstar-university',
  name: 'Northstar University',
  shortName: 'Northstar',
  primaryDomain: 'northstaruniversity.edu',
  country: 'Fictional demo region',

  brandTokens: ['northstar', 'northstaruniversity', 'nsu'],

  channels: [
    {
      id: 'ch-student-portal',
      name: 'Student Portal',
      url: 'https://portal.northstaruniversity.edu',
      kind: 'portal',
    },
    {
      id: 'ch-website',
      name: 'Official Website',
      url: 'https://northstaruniversity.edu',
      kind: 'website',
    },
    {
      id: 'ch-placement',
      name: 'Placement Portal',
      url: 'https://placements.northstaruniversity.edu',
      kind: 'portal',
    },
    {
      id: 'ch-library',
      name: 'Library Portal',
      url: 'https://library.northstaruniversity.edu',
      kind: 'portal',
    },
  ],
};

export const VERIFIED_DOMAINS = [
  {
    domain: 'northstaruniversity.edu',
    institution: 'Northstar University',
    department: 'Institution-wide',
    purpose: 'Primary institutional mail and web domain',
    verified: true,
  },
  {
    domain: 'portal.northstaruniversity.edu',
    institution: 'Northstar University',
    department: 'Academic Office',
    purpose: 'Student portal, registration and academic notices',
    verified: true,
  },
  {
    domain: 'placements.northstaruniversity.edu',
    institution: 'Northstar University',
    department: 'Placement Cell',
    purpose: 'Placement drives, recruiter communication',
    verified: true,
  },
  {
    domain: 'library.northstaruniversity.edu',
    institution: 'Northstar University',
    department: 'Library',
    purpose: 'Library services and digital resources',
    verified: true,
  },
];

export const DEPARTMENTS = [
  'Academic Office',
  'Placement Cell',
  'Training and Development',
  'Student Affairs',
  'Research Cell',
  'Computer Science',
  'Career Services',
  'Innovation Cell',
  'Library',
  'Accounts and Finance',
];

export const DEMO_STUDENTS = [
  {
    id: 'stu-alex',
    name: 'Alex Kumar',
    email: 'alex.kumar@northstaruniversity.edu',
    program: 'B.Tech Computer Science',
    semester: '3',
    rollNumber: '21CS0142',
    studentId: 'NSU-2024-0142',
    department: 'Computer Science',
    college: 'Northstar University',
  },
  {
    id: 'stu-riya',
    name: 'Riya Menon',
    email: 'riya.menon@northstaruniversity.edu',
    program: 'B.Sc Information Technology',
    semester: '5',
    rollNumber: '22IT0097',
    studentId: 'NSU-2023-0097',
    department: 'Information Technology',
    college: 'Northstar University',
  },
  {
    id: 'stu-daniel',
    name: 'Daniel Osei',
    email: 'daniel.osei@northstaruniversity.edu',
    program: 'B.Tech Electronics',
    semester: '7',
    rollNumber: '21EC0031',
    studentId: 'NSU-2023-0031',
    department: 'Electronics',
    college: 'Northstar University',
  },
];

export const DEMO_ADMINS = [
  {
    id: 'adm-yash',
    name: 'Yash B.',
    email: 'soc.lead@northstaruniversity.edu',
    role: 'Security Operations Lead',
    department: 'Information Security',
  },
  {
    id: 'adm-noor',
    name: 'Noor A.',
    email: 'soc.analyst@northstaruniversity.edu',
    role: 'Threat Analyst',
    department: 'Information Security',
  },
];

export const RISK_MODEL = {
  id: 'campusshield-prototype-risk-model',
  version: '1.2.0-prototype',
  name: 'CampusShield Prototype Risk Model',
  disclaimer:
    'Prototype Risk Score — generated from a transparent, rule-based indicator model. It is a decision-support signal, not a guarantee, and it has not been scientifically validated.',
};

export const RISK_BANDS = [
  { level: 'LOW', min: 0, max: 24, color: 'safe' },
  { level: 'MEDIUM', min: 25, max: 49, color: 'warn' },
  { level: 'HIGH', min: 50, max: 74, color: 'danger' },
  { level: 'CRITICAL', min: 75, max: 100, color: 'critical' },
];

export function bandFor(score) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return RISK_BANDS.find((b) => s >= b.min && s <= b.max) ?? RISK_BANDS[0];
}
