import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { INSTITUTION, VERIFIED_DOMAINS, DEPARTMENTS, DEMO_STUDENTS, DEMO_ADMINS } from './data/institution.js';
import { VERIFIED_ANNOUNCEMENTS, WATCHLIST_SEED } from './data/announcements.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const DB_FILE = process.env.CAMPUSSHIELD_DB ?? resolve(DATA_DIR, 'campusshield.sqlite');

export const DB_PATH = DB_FILE;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Demo accounts. No passwords are stored anywhere in this prototype.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  program       TEXT,
  semester      TEXT,
  roll_number   TEXT,
  student_id    TEXT,
  department    TEXT,
  college       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Domains the institution has verified as its own.
CREATE TABLE IF NOT EXISTS verified_domains (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  domain      TEXT NOT NULL UNIQUE,
  institution TEXT NOT NULL,
  department  TEXT,
  purpose     TEXT,
  verified    INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ground truth the Context Engine checks claims against.
CREATE TABLE IF NOT EXISTS verified_announcements (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  title                TEXT NOT NULL,
  department           TEXT NOT NULL,
  announcement_type    TEXT NOT NULL,
  official_sender      TEXT NOT NULL,
  official_domain      TEXT NOT NULL,
  official_url         TEXT NOT NULL,
  publication_date     TEXT NOT NULL,
  description          TEXT,
  keywords             TEXT,
  status               TEXT NOT NULL DEFAULT 'active',
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Official communication channels students are told to trust.
CREATE TABLE IF NOT EXISTS communication_channels (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  kind        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every submitted email. Bodies are stored only for the demo session.
CREATE TABLE IF NOT EXISTS emails (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  from_address        TEXT NOT NULL,
  to_address          TEXT,
  subject             TEXT,
  body                TEXT,
  links               TEXT,
  claimed_department  TEXT,
  claimed_type        TEXT,
  source              TEXT NOT NULL DEFAULT 'paste',
  submitted_by        TEXT,
  seeded              INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deterministic analysis output for an email.
CREATE TABLE IF NOT EXISTS email_analysis (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id            INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  risk_score          INTEGER NOT NULL,
  risk_level          TEXT NOT NULL,
  confidence          TEXT NOT NULL,
  checks              TEXT NOT NULL,
  indicators          TEXT NOT NULL,
  score_breakdown     TEXT NOT NULL,
  personalisation     TEXT NOT NULL,
  link_analysis       TEXT NOT NULL,
  authentication      TEXT NOT NULL,
  context_match       TEXT NOT NULL,
  communication_style TEXT NOT NULL,
  verdict             TEXT NOT NULL,
  analysis_log        TEXT NOT NULL,
  model_id            TEXT NOT NULL,
  seeded              INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Student-submitted reports. Feeds the admin SOC queue.
CREATE TABLE IF NOT EXISTS threat_reports (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id         TEXT NOT NULL UNIQUE,
  email_id            INTEGER REFERENCES emails(id) ON DELETE SET NULL,
  analysis_id         INTEGER REFERENCES email_analysis(id) ON DELETE SET NULL,
  timestamp           TEXT NOT NULL DEFAULT (datetime('now')),
  subject             TEXT,
  sender              TEXT,
  risk_score          INTEGER,
  risk_level          TEXT,
  category            TEXT,
  detected_indicators TEXT,
  status              TEXT NOT NULL DEFAULT 'investigating',
  reported_by         TEXT,
  notes               TEXT
);

-- Sender / domain watchlist.
CREATE TABLE IF NOT EXISTS watchlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  domain      TEXT NOT NULL UNIQUE,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  added_by    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin audit trail (every state change an analyst makes).
CREATE TABLE IF NOT EXISTS admin_actions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id   INTEGER REFERENCES threat_reports(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  actor       TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fictional threat-intelligence rollup used by the admin dashboard.
CREATE TABLE IF NOT EXISTS threat_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at   TEXT NOT NULL,
  category      TEXT NOT NULL,
  subject       TEXT,
  sender        TEXT,
  risk_level    TEXT,
  summary       TEXT,
  seeded        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_analysis_email ON email_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON threat_reports(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON threat_events(category);
`;

let db;

function migrate(conn) {
  const addSeeded = [
    ['emails', 'seeded', 'INTEGER NOT NULL DEFAULT 0'],
    ['email_analysis', 'seeded', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [table, column, definition] of addSeeded) {
    const columns = conn.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((c) => c.name === column)) {
      conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

export function getDb() {
  if (db) return db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

export function tx(fn) {
  const conn = getDb();
  conn.exec('BEGIN');
  try {
    const result = fn(conn);
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

export function j(value) {
  return JSON.stringify(value ?? null);
}

export function parse(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const THREAT_EVENT_SEED = [
  ['09:42:31', 'Institution Impersonation', 'URGENT: You Have Been Selected for AI Certification', 'courses@northstar-career-program.com', 'CRITICAL', 'Institution impersonation detected — look-alike sender domain.'],
  ['09:43:08', 'Malicious Link', 'Cybersecurity Workshop — Limited Seats', 'workshops@northstar-university-edu.com', 'MEDIUM', 'Suspicious external domain detected (typosquat pattern).'],
  ['09:44:17', 'Social Engineering', 'Scholarship Application — Selected Students', 'scholarship@northstar-university-scholarship.example', 'HIGH', 'Personalised student information detected in message body.'],
  ['09:45:02', 'Credential Phishing', 'Immediate Action Required — Placement Registration', 'placements@northstar-placement.example', 'CRITICAL', 'Threat report submitted by student.'],
  ['09:51:44', 'Institution Impersonation', 'Fee Payment Reminder — Final Notice', 'accounts@northstar-univ-portal.example', 'HIGH', 'Look-alike accounts domain targeting fee payment window.'],
  ['10:02:19', 'Suspicious Course Promotion', 'Exclusive Internship with Stipend', 'internships@career-boost-example.com', 'MEDIUM', 'Unsolicited internship promotion with external registration link.'],
  ['10:18:05', 'Credential Phishing', 'Placement Verification Required', 'placements@northstar-placement.example', 'CRITICAL', 'Credential request detected on an external verification form.'],
  ['10:26:37', 'Malicious Link', 'Library Membership Expiry Notice', 'library@northstaruniversity-edu.org', 'HIGH', 'External destination on a service notice that is normally portal-hosted.'],
  ['10:41:52', 'Institution Impersonation', 'Research Internship — Selected Candidates', 'research@northstar-research-cell.example', 'HIGH', 'Sender domain does not match a verified institutional domain.'],
  ['11:03:11', 'Suspicious Course Promotion', 'Workshop Invitation — Certification Add-on', 'training@random.example', 'MEDIUM', 'Suspicious link detected in an unsolicited training invitation.'],
];

function seedUsers() {
  for (const s of DEMO_STUDENTS) {
    run(
      `INSERT OR IGNORE INTO users (id, name, email, role, program, semester, roll_number, student_id, department, college)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [s.id, s.name, s.email, 'student', s.program, s.semester, s.rollNumber, s.studentId, s.department, s.college],
    );
  }
  for (const a of DEMO_ADMINS) {
    run(
      `INSERT OR IGNORE INTO users (id, name, email, role, department, college) VALUES (?,?,?,?,?,?)`,
      [a.id, a.name, a.email, 'admin', a.department, INSTITUTION.name],
    );
  }
}

function seedDomains() {
  for (const d of VERIFIED_DOMAINS) {
    run(
      `INSERT OR IGNORE INTO verified_domains (domain, institution, department, purpose, verified)
       VALUES (?,?,?,?,?)`,
      [d.domain, d.institution, d.department, d.purpose, d.verified ? 1 : 0],
    );
  }
}

function seedAnnouncements() {
  const count = get('SELECT COUNT(*) AS c FROM verified_announcements')?.c ?? 0;
  if (count > 0) return;
  for (const a of VERIFIED_ANNOUNCEMENTS) {
    run(
      `INSERT INTO verified_announcements
        (title, department, announcement_type, official_sender, official_domain, official_url,
         publication_date, description, keywords, status)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        a.title,
        a.department,
        a.announcement_type,
        a.official_sender,
        a.official_domain,
        a.official_url,
        a.publication_date,
        a.description,
        a.keywords,
        a.status,
      ],
    );
  }
}

function seedChannels() {
  const count = get('SELECT COUNT(*) AS c FROM communication_channels')?.c ?? 0;
  if (count > 0) return;
  for (const c of INSTITUTION.channels) {
    run('INSERT INTO communication_channels (name, url, kind) VALUES (?,?,?)', [c.name, c.url, c.kind]);
  }
}

function seedWatchlist() {
  for (const w of WATCHLIST_SEED) {
    run(
      `INSERT OR IGNORE INTO watchlist (domain, reason, status, added_by) VALUES (?,?,?,?)`,
      [w.domain, w.reason, w.status, w.added_by],
    );
  }
}

function seedThreatEvents() {
  const count = get('SELECT COUNT(*) AS c FROM threat_events')?.c ?? 0;
  if (count > 0) return;
  const today = new Date().toISOString().slice(0, 10);
  for (const [time, category, subject, sender, level, summary] of THREAT_EVENT_SEED) {
    run(
      `INSERT INTO threat_events (occurred_at, category, subject, sender, risk_level, summary, seeded)
       VALUES (?,?,?,?,?,?,1)`,
      [`${today} ${time}`, category, subject, sender, level, summary],
    );
  }
}

function seedReports() {
  const count = get('SELECT COUNT(*) AS c FROM threat_reports')?.c ?? 0;
  if (count > 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    ['INC-004281', `${today} 09:45:02`, 'URGENT: You Have Been Selected for AI Certification', 'courses@northstar-career-program.com', 87, 'CRITICAL', 'Institution Impersonation', 'investigating', 'alex.kumar@northstaruniversity.edu'],
    ['INC-004282', `${today} 10:18:05`, 'Immediate Action Required — Placement Registration', 'placements@northstar-placement.example', 84, 'CRITICAL', 'Credential Phishing', 'reported', 'daniel.osei@northstaruniversity.edu'],
    ['INC-004283', `${today} 11:03:11`, 'Workshop Invitation — Certification Add-on', 'training@random.example', 52, 'HIGH', 'Suspicious Link', 'reviewed', 'riya.menon@northstaruniversity.edu'],
    ['INC-004284', `${today} 11:26:48`, 'Scholarship Application — Selected Students', 'scholarship@northstar-university-scholarship.example', 66, 'HIGH', 'Social Engineering', 'investigating', 'riya.menon@northstaruniversity.edu'],
  ];
  for (const [incident, ts, subject, sender, score, level, category, status, reporter] of rows) {
    run(
      `INSERT OR IGNORE INTO threat_reports
        (incident_id, timestamp, subject, sender, risk_score, risk_level, category, detected_indicators, status, reported_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        incident,
        ts,
        subject,
        sender,
        score,
        level,
        category,
        j(['Sender domain mismatch', 'No verified announcement match', 'External link destination']),
        status,
        reporter,
      ],
    );
  }
}

export function seed() {
  seedUsers();
  seedDomains();
  seedAnnouncements();
  seedChannels();
  seedWatchlist();
  seedThreatEvents();
  seedReports();
}

let afterSeedHook = null;

export function onSeed(fn) {
  afterSeedHook = fn;
}

function notifySeeded() {
  if (!afterSeedHook) return;
  try {
    afterSeedHook();
  } catch (err) {

    console.warn('[seed] after-seed hook failed:', err?.message ?? err);
  }
}

export const KNOWN_DEPARTMENTS = [...DEPARTMENTS];

export function resetDemoData() {
  tx((conn) => {
    conn.exec('DELETE FROM admin_actions');
    conn.exec('DELETE FROM threat_reports');
    conn.exec('DELETE FROM threat_events');
    conn.exec('DELETE FROM email_analysis');
    conn.exec('DELETE FROM emails');
    conn.exec('DELETE FROM watchlist');
    conn.exec("DELETE FROM sqlite_sequence WHERE name IN ('emails','email_analysis','threat_reports','threat_events','admin_actions','watchlist')");
  });
  seedWatchlist();
  seedThreatEvents();
  seedReports();
  seedUsers();
  notifySeeded();
  return { ok: true, resetAt: new Date().toISOString() };
}

export function initDb() {
  getDb();
  seed();
  notifySeeded();
  return getDb();
}
