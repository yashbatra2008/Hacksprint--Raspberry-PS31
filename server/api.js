import { Router } from 'express';

import {
  all, get, run, tx, j, parse, resetDemoData, KNOWN_DEPARTMENTS,
} from './db.js';
import { analyzeEmail, verifyClaim } from './engine.js';
import { DEMO_EMAILS, findDemoEmail } from './data/demoEmails.js';
import { INSTITUTION, RISK_MODEL, RISK_BANDS } from './data/institution.js';
import { SERVICE_STATUS } from './services/index.js';
import { THREAT_CATEGORIES, FICTIONAL_CAMPAIGNS } from './services/threatIntelService.js';
import { parseEml } from './services/mailSource.js';

export const api = Router();

const nowIso = () => new Date().toISOString();

function fail(res, status, message, detail) {
  return res.status(status).json({ ok: false, error: message, detail: detail ?? null });
}

function engineContext() {
  const announcements = all('SELECT * FROM verified_announcements WHERE status = ? ORDER BY publication_date DESC', ['active']);
  const watchlist = new Set(all('SELECT domain FROM watchlist').map((r) => r.domain.toLowerCase()));
  return { announcements, watchlist };
}

function hydrateAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    emailId: row.email_id,
    score: row.risk_score,
    level: row.risk_level,
    confidence: row.confidence,
    checks: parse(row.checks, []),
    indicators: parse(row.indicators, []),
    scoreBreakdown: parse(row.score_breakdown, []),
    personalisation: parse(row.personalisation, {}),
    linkAnalysis: parse(row.link_analysis, []),
    authentication: parse(row.authentication, {}),
    contextMatch: parse(row.context_match, {}),
    communicationStyle: parse(row.communication_style, {}),
    verdict: parse(row.verdict, {}),
    analysisLog: parse(row.analysis_log, []),
    model: RISK_MODEL,
    createdAt: row.created_at,
  };
}

function hydrateEmail(row) {
  if (!row) return null;
  return {
    id: row.id,
    from: row.from_address,
    to: row.to_address,
    subject: row.subject,
    body: row.body,
    links: parse(row.links, []),
    claimedDepartment: row.claimed_department,
    claimedType: row.claimed_type,
    source: row.source,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
  };
}

function nextIncidentId() {
  const row = get("SELECT COUNT(*) AS c FROM threat_reports WHERE incident_id LIKE 'INC-%'");
  const base = 4290 + (row?.c ?? 0) + 1;
  return `INC-${String(base).padStart(6, '0')}`;
}

api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'ONLINE',
    demo: true,
    time: nowIso(),
    services: SERVICE_STATUS,
  });
});

api.get('/config', (_req, res) => {
  res.json({
    ok: true,
    demoMode: true,
    product: {
      name: 'TrustShield',
      deployment: 'CampusShield',
      tagline: 'Verify before you trust.',
      description: 'Context-aware protection against institution-impersonation phishing.',
      deploymentDescription:
        'CampusShield is the educational-institution deployment of TrustShield, a context-aware institutional impersonation detection platform. The prototype and demo focus on college email attacks.',
    },
    institution: INSTITUTION,
    riskModel: RISK_MODEL,
    riskBands: RISK_BANDS,
    departments: KNOWN_DEPARTMENTS,
    categories: THREAT_CATEGORIES,
    services: SERVICE_STATUS,
    notice: 'Prototype demonstration using fictional institutional and student data.',
  });
});

api.get('/demo-emails', (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    emails: DEMO_EMAILS.map((d) => ({
      id: d.id,
      label: d.label,
      tag: d.tag,
      expected: d.expected,
      summary: d.summary,
      email: d.email,
    })),
  });
});

api.post('/parse-eml', (req, res) => {
  const raw = req.body?.raw;
  if (typeof raw !== 'string' || !raw.trim()) return fail(res, 400, 'Provide the raw .eml content as { raw }.');
  try {
    const parsed = parseEml(raw);
    if (!parsed.from) return fail(res, 422, 'Could not find a From header in the uploaded message.');
    return res.json({ ok: true, email: parsed, demo: true });
  } catch (err) {
    return fail(res, 422, 'The uploaded message could not be parsed.', String(err?.message ?? err));
  }
});

api.post('/analyze-email', (req, res) => {
  const body = req.body ?? {};
  const input = {
    from: String(body.from ?? '').trim(),
    to: String(body.to ?? '').trim(),
    subject: String(body.subject ?? '').trim(),
    body: String(body.body ?? '').trim(),
    links: Array.isArray(body.links)
      ? body.links.map((l) => String(l).trim()).filter(Boolean)
      : String(body.links ?? '')
          .split(/[\s,]+/)
          .map((l) => l.trim())
          .filter(Boolean),
    claimedDepartment: String(body.claimedDepartment ?? '').trim() || null,
    claimedType: String(body.claimedType ?? body.claimedAnnouncementType ?? '').trim() || null,
  };

  if (!input.from) return fail(res, 400, 'A sender address is required so the sender can be verified.');
  if (!input.body && !input.subject) return fail(res, 400, 'Provide at least a subject or an email body to analyse.');

  const bodyLinks = [...`${input.body} ${input.subject}`.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)].map((m) => m[0]);
  input.links = [...new Set([...input.links, ...bodyLinks])];

  const ctx = engineContext();
  const student = body.studentId
    ? get('SELECT * FROM users WHERE id = ? AND role = ?', [String(body.studentId), 'student'])
    : null;

  const studentProfile = student
    ? {
        name: student.name,
        program: student.program,
        semester: student.semester,
        rollNumber: student.roll_number,
        studentId: student.student_id,
        department: student.department,
        college: student.college,
      }
    : null;

  const result = analyzeEmail(input, {
    announcements: ctx.announcements,
    watchlist: ctx.watchlist,
    student: studentProfile,
  });

  const stored = tx((conn) => {
    const emailRow = conn
      .prepare(
        `INSERT INTO emails (from_address, to_address, subject, body, links, claimed_department, claimed_type, source, submitted_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.from,
        input.to || null,
        input.subject || null,
        input.body || null,
        j(input.links),
        input.claimedDepartment,
        input.claimedType,
        String(body.source ?? 'paste'),
        body.submittedBy ? String(body.submittedBy) : null,
      );

    const analysisRow = conn
      .prepare(
        `INSERT INTO email_analysis
          (email_id, risk_score, risk_level, confidence, checks, indicators, score_breakdown,
           personalisation, link_analysis, authentication, context_match, communication_style,
           verdict, analysis_log, model_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        emailRow.lastInsertRowid,
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
        }),
        j(result.communicationStyle),
        j(result.verdict),
        j(result.analysisLog),
        result.model.id,
      );

    return { emailId: Number(emailRow.lastInsertRowid), analysisId: Number(analysisRow.lastInsertRowid) };
  });

  return res.status(201).json({
    ok: true,
    demo: true,
    emailId: stored.emailId,
    analysisId: stored.analysisId,
    email: input,
    result: {
      score: result.score,
      rawScore: result.rawScore,
      level: result.level,
      band: result.band,
      confidence: result.confidence,
      category: result.category,
      indicators: result.indicators,
      scoreBreakdown: result.scoreBreakdown,
      checks: result.checks,
      linkAnalysis: result.linkAnalysis,
      authentication: result.authentication,
      contextMatch: result.contextMatch,
      communicationStyle: result.communicationStyle,
      personalisation: result.personalisation,
      sender: result.sender,
      verdict: result.verdict,
      analysisLog: result.analysisLog,
      model: result.model,
      engine: result.engine,
      generatedAt: result.generatedAt,
    },
  });
});

api.get('/emails/:id', (req, res) => {
  const email = hydrateEmail(get('SELECT * FROM emails WHERE id = ?', [Number(req.params.id)]));
  if (!email) return fail(res, 404, 'Email not found.');
  const analysis = hydrateAnalysis(get('SELECT * FROM email_analysis WHERE email_id = ? ORDER BY id DESC LIMIT 1', [email.id]));
  return res.json({ ok: true, email, analysis });
});

api.get('/verified-announcements', (_req, res) => {
  const rows = all('SELECT * FROM verified_announcements ORDER BY publication_date DESC');
  res.json({ ok: true, demo: true, count: rows.length, announcements: rows });
});

api.post('/verify-announcement', (req, res) => {
  const body = req.body ?? {};
  if (!body.from && !body.subject && !body.body) {
    return fail(res, 400, 'Provide at least a sender, subject or body to verify a claim.');
  }
  const ctx = engineContext();
  const email = {
    from: String(body.from ?? '').trim(),
    to: String(body.to ?? '').trim(),
    subject: String(body.subject ?? '').trim(),
    body: String(body.body ?? '').trim(),
    links: Array.isArray(body.links) ? body.links.map(String) : [],
    claimedDepartment: String(body.claimedDepartment ?? '').trim() || null,
    claimedType: String(body.claimedType ?? body.claimedAnnouncementType ?? '').trim() || null,
  };
  if (!email.links.length) {
    email.links = [...`${email.body} ${email.subject}`.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)].map((m) => m[0]);
  }
  const verification = verifyClaim(email, ctx.announcements);
  return res.json({ ok: true, demo: true, verification });
});

api.get('/threats', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const rows = status
    ? all('SELECT * FROM threat_reports WHERE status = ? ORDER BY timestamp DESC', [status])
    : all('SELECT * FROM threat_reports ORDER BY timestamp DESC');
  res.json({
    ok: true,
    demo: true,
    count: rows.length,
    threats: rows.map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      timestamp: r.timestamp,
      subject: r.subject,
      sender: r.sender,
      riskScore: r.risk_score,
      riskLevel: r.risk_level,
      category: r.category,
      detectedIndicators: parse(r.detected_indicators, []),
      status: r.status,
      reportedBy: r.reported_by,
      emailId: r.email_id,
      analysisId: r.analysis_id,
    })),
  });
});

api.post('/threats/report', (req, res) => {
  const body = req.body ?? {};
  const analysisId = body.analysisId ? Number(body.analysisId) : null;
  const emailId = body.emailId ? Number(body.emailId) : null;

  let analysis = analysisId ? get('SELECT * FROM email_analysis WHERE id = ?', [analysisId]) : null;
  if (!analysis && emailId) analysis = get('SELECT * FROM email_analysis WHERE email_id = ? ORDER BY id DESC LIMIT 1', [emailId]);
  const email = emailId ? get('SELECT * FROM emails WHERE id = ?', [emailId]) : null;

  const sender = String(body.sender ?? email?.from_address ?? '').trim();
  const subject = String(body.subject ?? email?.subject ?? '').trim();
  if (!sender && !subject) return fail(res, 400, 'A sender or subject is required to file a report.');

  const indicators = analysis ? parse(analysis.indicators, []).map((i) => i.label) : [];
  const incidentId = nextIncidentId();

  const id = tx((conn) => {
    const row = conn
      .prepare(
        `INSERT INTO threat_reports
          (incident_id, email_id, analysis_id, subject, sender, risk_score, risk_level, category,
           detected_indicators, status, reported_by, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        incidentId,
        emailId,
        analysisId,
        subject || null,
        sender || null,
        analysis?.risk_score ?? null,
        analysis?.risk_level ?? null,
        analysis?.risk_level === 'LOW' ? 'Reviewed' : body.category ?? 'Institution Impersonation',
        j(indicators),
        'investigating',
        String(body.reportedBy ?? 'student@northstaruniversity.edu'),
        String(body.notes ?? ''),
      );
    conn
      .prepare('INSERT INTO admin_actions (report_id, action, actor, detail) VALUES (?,?,?,?)')
      .run(row.lastInsertRowid, 'REPORT_FILED', String(body.reportedBy ?? 'student'), 'Student submitted a suspicious email report.');
    return Number(row.lastInsertRowid);
  });

  return res.status(201).json({
    ok: true,
    demo: true,
    incidentId,
    reportId: id,
    message: 'Report submitted to Campus Security.',
    status: 'investigating',
  });
});

api.patch('/threats/:id', (req, res) => {
  const id = Number(req.params.id);
  const report = get('SELECT * FROM threat_reports WHERE id = ?', [id]);
  if (!report) return fail(res, 404, 'Threat report not found.');

  const action = String(req.body?.action ?? '').trim().toLowerCase();
  const actor = String(req.body?.actor ?? 'soc.lead@northstaruniversity.edu');

  const STATUS_BY_ACTION = {
    review: 'reviewed',
    reviewed: 'reviewed',
    'false positive': 'false-positive',
    false_positive: 'false-positive',
    'false-positive': 'false-positive',
    escalate: 'escalated',
    escalated: 'escalated',
    investigate: 'investigating',
    investigating: 'investigating',
    close: 'closed',
    closed: 'closed',
  };

  const status = STATUS_BY_ACTION[action];
  if (!status) {
    return fail(res, 400, `Unsupported action "${action}".`, ['review', 'false_positive', 'escalate', 'investigate', 'close']);
  }

  run('UPDATE threat_reports SET status = ? WHERE id = ?', [status, id]);
  run('INSERT INTO admin_actions (report_id, action, actor, detail) VALUES (?,?,?,?)', [
    id,
    action.toUpperCase(),
    actor,
    String(req.body?.note ?? `Report marked ${status}.`),
  ]);

  let watchlisted = null;
  let watchlistAdded = false;
  if (action === 'escalate' && report.sender?.includes('@')) {
    const domain = report.sender.split('@')[1].toLowerCase();
    watchlisted = domain;
    if (!get('SELECT * FROM watchlist WHERE domain = ?', [domain])) {
      run('INSERT INTO watchlist (domain, reason, status, added_by) VALUES (?,?,?,?)', [
        domain,
        `Escalated incident ${report.incident_id} — institution impersonation indicators.`,
        'active',
        actor,
      ]);
      watchlistAdded = true;
    }
  }

  return res.json({
    ok: true,
    demo: true,
    id,
    status,
    watchlisted,
    watchlistAdded,
    message: watchlisted
      ? `Incident ${report.incident_id} marked ${status}. ${watchlisted} is on the watchlist.`
      : `Incident ${report.incident_id} marked ${status}.`,
  });
});

api.get('/threats/:id/timeline', (req, res) => {
  const id = Number(req.params.id);
  const report = get('SELECT * FROM threat_reports WHERE id = ?', [id]);
  if (!report) return fail(res, 404, 'Threat report not found.');
  const actions = all('SELECT * FROM admin_actions WHERE report_id = ? ORDER BY created_at ASC', [id]);
  const analysis = report.analysis_id ? get('SELECT * FROM email_analysis WHERE id = ?', [report.analysis_id]) : null;

  const timeline = [
    { at: report.timestamp, kind: 'detected', label: 'Email submitted for analysis' },
    analysis ? { at: analysis.created_at, kind: 'analyzed', label: `Analysis completed — ${analysis.risk_level} risk (${analysis.risk_score}/100)` } : null,
    { at: report.timestamp, kind: 'reported', label: `Report filed by ${report.reported_by ?? 'unknown'}` },
    ...actions.map((a) => ({ at: a.created_at, kind: 'action', label: `${a.action} by ${a.actor ?? 'system'}${a.detail ? ` — ${a.detail}` : ''}` })),
  ].filter(Boolean);

  return res.json({ ok: true, timeline, status: report.status });
});

api.get('/dashboard/stats', (_req, res) => {

  const analysed = get('SELECT COUNT(*) AS c FROM email_analysis WHERE seeded = 0')?.c ?? 0;
  const highRisk =
    get("SELECT COUNT(*) AS c FROM email_analysis WHERE risk_level IN ('HIGH','CRITICAL') AND seeded = 0")?.c ?? 0;
  const reports = get('SELECT COUNT(*) AS c FROM threat_reports')?.c ?? 0;
  const openReports = get("SELECT COUNT(*) AS c FROM threat_reports WHERE status IN ('investigating','escalated','reported')")?.c ?? 0;
  const announcements = get('SELECT COUNT(*) AS c FROM verified_announcements')?.c ?? 0;
  const domains = get('SELECT COUNT(*) AS c FROM verified_domains WHERE verified = 1')?.c ?? 0;
  const watchlistCount = get('SELECT COUNT(*) AS c FROM watchlist')?.c ?? 0;
  const events = get('SELECT COUNT(*) AS c FROM threat_events')?.c ?? 0;

  const byCategory = all('SELECT category, COUNT(*) AS count FROM threat_events GROUP BY category ORDER BY count DESC');
  const byLevel = all('SELECT risk_level AS level, COUNT(*) AS count FROM threat_events GROUP BY risk_level');
  const byStatus = all('SELECT status, COUNT(*) AS count FROM threat_reports GROUP BY status');

  const BASELINE = { analysed: 1240, highRisk: 41, impersonation: 27, reports: 58, announcements: 0 };
  const impersonation = get(
    "SELECT COUNT(*) AS c FROM threat_events WHERE category = 'Institution Impersonation'",
  )?.c ?? 0;

  res.json({
    ok: true,
    demo: true,
    label: 'Demo environment statistics',
    kpis: {
      emailsAnalyzed: analysed + BASELINE.analysed,
      highRiskEmails: highRisk + BASELINE.highRisk,
      impersonationAttempts: impersonation + BASELINE.impersonation,
      studentReports: reports + BASELINE.reports,
      verifiedAnnouncements: announcements + BASELINE.announcements,
      verifiedDomains: domains,
      watchlistEntries: watchlistCount,
    },
    sessionCounts: { analysed, highRisk, reports, openReports, events },
    byCategory,
    byLevel,
    byStatus,
    threatMonitor: all('SELECT * FROM threat_events ORDER BY occurred_at DESC LIMIT 12').map((e) => ({
      id: e.id,
      time: e.occurred_at,
      category: e.category,
      subject: e.subject,
      sender: e.sender,
      level: e.risk_level,
      summary: e.summary,
    })),
    campaigns: FICTIONAL_CAMPAIGNS,
    notice: 'Demo environment statistics — all values are fictional and generated for the prototype.',
  });
});

api.get('/dashboard/incidents', (_req, res) => {
  const rows = all("SELECT * FROM threat_reports ORDER BY timestamp DESC LIMIT 8");
  res.json({ ok: true, demo: true, incidents: rows });
});

api.get('/watchlist', (_req, res) => {
  const rows = all('SELECT * FROM watchlist ORDER BY created_at DESC');
  res.json({ ok: true, demo: true, count: rows.length, watchlist: rows });
});

api.post('/watchlist', (req, res) => {
  const domain = String(req.body?.domain ?? '').trim().toLowerCase();
  if (!domain) return fail(res, 400, 'A domain is required.');
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
    return fail(res, 400, `"${domain}" does not look like a valid domain.`);
  }
  const existing = get('SELECT * FROM watchlist WHERE domain = ?', [domain]);
  if (existing) return fail(res, 409, `${domain} is already on the watchlist.`);

  const reason = String(req.body?.reason ?? 'Added manually by security operations.').trim();
  const addedBy = String(req.body?.addedBy ?? 'soc.lead@northstaruniversity.edu');
  const info = run('INSERT INTO watchlist (domain, reason, status, added_by) VALUES (?,?,?,?)', [domain, reason, 'active', addedBy]);
  const row = get('SELECT * FROM watchlist WHERE id = ?', [Number(info.lastInsertRowid)]);
  return res.status(201).json({ ok: true, demo: true, entry: row, message: `${domain} added to the watchlist.` });
});

api.delete('/watchlist/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = get('SELECT * FROM watchlist WHERE id = ?', [id]);
  if (!row) return fail(res, 404, 'Watchlist entry not found.');
  run('DELETE FROM watchlist WHERE id = ?', [id]);
  return res.json({ ok: true, demo: true, removed: row.domain, message: `${row.domain} removed from the watchlist.` });
});

api.get('/settings', (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    institution: INSTITUTION,
    verifiedDomains: all('SELECT * FROM verified_domains ORDER BY domain'),
    departments: all('SELECT DISTINCT department FROM verified_announcements ORDER BY department').map((r) => r.department),
    allDepartments: KNOWN_DEPARTMENTS,
    channels: all('SELECT * FROM communication_channels ORDER BY id'),
    announcements: all('SELECT id, title, department, announcement_type, official_sender, official_url, publication_date, status FROM verified_announcements ORDER BY publication_date DESC'),
    services: SERVICE_STATUS,
  });
});

api.post('/settings/domains', (req, res) => {
  const domain = String(req.body?.domain ?? '').trim().toLowerCase();
  if (!domain) return fail(res, 400, 'A domain is required.');
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) return fail(res, 400, `"${domain}" does not look like a valid domain.`);
  if (get('SELECT * FROM verified_domains WHERE domain = ?', [domain])) return fail(res, 409, `${domain} is already a verified domain.`);

  run('INSERT INTO verified_domains (domain, institution, department, purpose, verified) VALUES (?,?,?,?,1)', [
    domain,
    String(req.body?.institution ?? INSTITUTION.name),
    String(req.body?.department ?? 'Institution-wide'),
    String(req.body?.purpose ?? 'Added manually in the prototype settings console.'),
  ]);
  return res.status(201).json({ ok: true, demo: true, message: `${domain} added to verified institutional domains.` });
});

api.delete('/settings/domains/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = get('SELECT * FROM verified_domains WHERE id = ?', [id]);
  if (!row) return fail(res, 404, 'Verified domain not found.');
  if (row.domain === INSTITUTION.primaryDomain) return fail(res, 400, 'The primary institutional domain cannot be removed.');
  run('DELETE FROM verified_domains WHERE id = ?', [id]);
  return res.json({ ok: true, demo: true, message: `${row.domain} removed from verified institutional domains.` });
});

api.post('/demo/reset', (_req, res) => {
  const result = resetDemoData();
  return res.json({ ...result, demo: true, message: 'Demo data reset. Verified announcements and domains were preserved.' });
});

api.get('/demo/attack', (_req, res) => {
  const demo = findDemoEmail('demo-2-fake-course');
  res.json({ ok: true, demo: true, demo: { id: demo.id, label: demo.label, expected: demo.expected, email: demo.email } });
});

api.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Unknown API endpoint.', path: req.originalUrl });
});

export default api;
