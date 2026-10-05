import { all, get, run, j, onSeed } from './db.js';
import { analyzeEmail } from './engine.js';
import { RISK_MODEL } from './data/institution.js';
import { findDemoEmail } from './data/demoEmails.js';

const SEEDED_INCIDENTS = [
  {
    incident: 'INC-004281',
    demoId: 'demo-2-fake-course',
    email: null,
    reportedBy: 'alex.kumar@northstaruniversity.edu',
    submittedAt: '09:45:02',
    notes: 'Flagged during analysis — institution impersonation with personalised student data.',
  },
  {
    incident: 'INC-004282',
    demoId: 'demo-3-fake-placement',
    email: null,
    reportedBy: 'daniel.osei@northstaruniversity.edu',
    submittedAt: '10:18:05',
    notes: 'External verification form with a two-hour deadline.',
  },
  {
    incident: 'INC-004283',
    demoId: null,
    email: {
      from: 'training@random.example',
      to: 'riya.menon@northstaruniversity.edu',
      subject: 'Workshop Invitation — Certification Add-on',
      body:
        'Hello,\n\nRegister for the certification add-on workshop using the link below. Registration closes today.\n\n' +
        'https://random.example/cert-add-on\n\nSign in with your university account to receive the certificate.\n\nTraining Cell',
      links: ['https://random.example/cert-add-on'],
      claimedDepartment: 'Training and Development',
      claimedAnnouncementType: 'Certification Programme',
    },
    reportedBy: 'riya.menon@northstaruniversity.edu',
    submittedAt: '11:03:11',
    notes: 'Unsolicited training invitation carrying an external registration link.',
  },
  {
    incident: 'INC-004284',
    demoId: 'demo-4-suspicious-scholarship',
    email: null,
    reportedBy: 'riya.menon@northstaruniversity.edu',
    submittedAt: '11:26:48',
    notes: 'Scholarship claim using student-specific information, unverifiable against the record.',
  },
];

function engineContext() {
  const announcements = all("SELECT * FROM verified_announcements WHERE status = 'active'");
  const watchlist = new Set(all('SELECT domain FROM watchlist').map((r) => r.domain.toLowerCase()));
  return { announcements, watchlist };
}

function studentFor(email) {
  if (!email?.to) return null;
  const row = get('SELECT * FROM users WHERE email = ? AND role = ?', [String(email.to).toLowerCase(), 'student']);
  if (!row) return null;
  return {
    name: row.name,
    program: row.program,
    semester: row.semester,
    rollNumber: row.roll_number,
    studentId: row.student_id,
    department: row.department,
    college: row.college,
  };
}

function rebaseLog(log, filedAt) {
  if (!Array.isArray(log) || !log.length) return log;
  const [h, m, s] = String(filedAt).split(':').map(Number);
  const filed = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  const start = filed - (log.length - 1);
  const clock = (secs) => {
    const t = ((secs % 86400) + 86400) % 86400;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  };
  return log.map((entry, i) => ({ ...entry, time: clock(start + i) }));
}

function storeAnalysis(email, { submittedBy, source, filedAt }) {
  const ctx = engineContext();
  const result = analyzeEmail(email, {
    announcements: ctx.announcements,
    watchlist: ctx.watchlist,
    student: studentFor(email),
  });
  const analysisLog = rebaseLog(result.analysisLog, filedAt);

  const emailRow = run(
    `INSERT INTO emails (from_address, to_address, subject, body, links, claimed_department, claimed_type,
       source, submitted_by, seeded)
     VALUES (?,?,?,?,?,?,?,?,?,1)`,
    [
      email.from,
      email.to ?? null,
      email.subject ?? null,
      email.body ?? null,
      j(email.links ?? []),
      email.claimedDepartment ?? null,
      email.claimedAnnouncementType ?? email.claimedType ?? null,
      source,
      submittedBy,
    ],
  );

  const analysisRow = run(
    `INSERT INTO email_analysis
       (email_id, risk_score, risk_level, confidence, checks, indicators, score_breakdown,
        personalisation, link_analysis, authentication, context_match, communication_style,
        verdict, analysis_log, model_id, seeded)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
    [
      Number(emailRow.lastInsertRowid),
      result.score,
      result.level,
      result.confidence,
      j(result.checks),
      j(result.indicators),
      j(result.scoreBreakdown),
      j(result.personalisation),
      j(result.linkAnalysis),
      j(result.authentication),
      j({
        status: result.contextMatch.status,
        best: result.contextMatch.best
          ? {
              id: result.contextMatch.best.announcement.id,
              title: result.contextMatch.best.announcement.title,
              department: result.contextMatch.best.announcement.department,
              official_sender: result.contextMatch.best.announcement.official_sender,
              official_url: result.contextMatch.best.announcement.official_url,
              score: result.contextMatch.best.score,
              reasons: result.contextMatch.best.reasons,
            }
          : null,
        candidates: (result.contextMatch.candidates ?? []).map((c) => ({
          id: c.announcement.id,
          title: c.announcement.title,
          department: c.announcement.department,
          score: c.score,
        })),
      }),j(result.communicationStyle),
        j(result.verdict),
        j(analysisLog),
        result.model.id,
    ],
  );

  return {
    emailId: Number(emailRow.lastInsertRowid),
    analysisId: Number(analysisRow.lastInsertRowid),
    result,
  };
}

export function seedDemoAnalysis() {
  const reports = all("SELECT * FROM threat_reports WHERE email_id IS NULL");
  if (!reports.length) return { seeded: 0 };

  let seeded = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const report of reports) {
    const spec = SEEDED_INCIDENTS.find((s) => s.incident === report.incident_id);
    if (!spec) continue;

    const demo = spec.demoId ? findDemoEmail(spec.demoId) : null;
    const email = demo ? demo.email : spec.email;
    if (!email) continue;

    try {
      const { emailId, analysisId, result } = storeAnalysis(email, {
        submittedBy: spec.reportedBy,
        source: demo ? 'demo' : 'paste',
        filedAt: spec.submittedAt,
      });

      run(
        `UPDATE threat_reports
            SET email_id = ?, analysis_id = ?, subject = ?, sender = ?, risk_score = ?,
                risk_level = ?, category = ?, detected_indicators = ?, reported_by = ?,
                timestamp = ?
          WHERE id = ?`,
        [
          emailId,
          analysisId,
          email.subject,
          email.from,
          result.score,
          result.level,
          report.category,
          j(result.indicators.map((i) => i.label)),
          spec.reportedBy,
          `${today} ${spec.submittedAt}`,
          report.id,
        ],
      );

      const createdAt = `${today} ${spec.submittedAt}`;
      run('UPDATE emails SET created_at = ? WHERE id = ?', [createdAt, emailId]);
      run('UPDATE email_analysis SET created_at = ? WHERE id = ?', [createdAt, analysisId]);

      seeded += 1;
    } catch (err) {

      console.warn(`[seed] could not build analysis for ${report.incident_id}:`, err?.message ?? err);
    }
  }

  if (seeded) {

    console.log(`  ● SEEDED  ${seeded} incident analysis record(s)`);
  }
  return { seeded };
}

onSeed(seedDemoAnalysis);
