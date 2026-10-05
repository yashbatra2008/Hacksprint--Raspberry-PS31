import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TMP = mkdtempSync(join(tmpdir(), 'campusshield-test-'));
process.env.CAMPUSSHIELD_DB = join(TMP, 'test.sqlite');

const { default: api } = await import('../server/api.js');
const { initDb } = await import('../server/db.js');
const express = (await import('express')).default;

initDb();

const app = express();
app.use(express.json());
app.use('/api', api);

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  try {
    rmSync(TMP, { recursive: true, force: true });
  } catch {

  }
});

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const SAFE = {
  from: 'training@northstaruniversity.edu',
  to: 'alex.kumar@northstaruniversity.edu',
  subject: 'Official AI Certification Programme — Student Registration',
  body: 'Dear Students,\n\nThe Training and Development department is offering a six-week AI Certification Programme. Register on the official page: https://northstaruniversity.edu/training/ai-certification\n\nRegards,\nTraining and Development',
  links: ['https://northstaruniversity.edu/training/ai-certification'],
  claimedDepartment: 'Training and Development',
  claimedType: 'Certification Programme',
};

const ATTACK = {
  from: 'courses@northstar-career-program.com',
  to: 'alex.kumar@northstaruniversity.edu',
  subject: 'URGENT: You Have Been Selected for AI Certification',
  body: 'Dear Alex Kumar,\n\nCongratulations! You have been selected for the exclusive AI Certification Programme.\n\nStudent Name: Alex Kumar\nProgram: B.Tech Computer Science\nSemester: 3\n\nYou must complete your registration within 24 hours or your seat will be released.\n\nRegister immediately: https://northstar-course-registration.example/register\n\nProvide your student portal login to activate the certification account.',
  links: ['https://northstar-course-registration.example/register'],
  claimedDepartment: 'Training and Development',
  claimedType: 'Certification Programme',
};

let safeAnalysis;
let attackAnalysis;

test('GET /api/health reports ONLINE in demo mode', async () => {
  const { status, json } = await req('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.status, 'ONLINE');
  assert.equal(json.demo, true);
});

test('GET /api/config exposes the deployment profile and risk model', async () => {
  const { status, json } = await req('GET', '/api/config');
  assert.equal(status, 200);
  assert.equal(json.product.deployment, 'CampusShield');
  assert.equal(json.product.name, 'TrustShield');
  assert.equal(json.institution.primaryDomain, 'northstaruniversity.edu');
  assert.match(json.riskModel.disclaimer, /Prototype Risk Score/);
  assert.equal(json.demoMode, true);
});

test('GET /api/verified-announcements returns at least 8 seeded records', async () => {
  const { status, json } = await req('GET', '/api/verified-announcements');
  assert.equal(status, 200);
  assert.ok(json.count >= 8, `expected >= 8 announcements, got ${json.count}`);
  const sample = json.announcements[0];
  for (const field of ['id', 'title', 'department', 'announcement_type', 'official_sender', 'official_domain', 'official_url', 'publication_date', 'status']) {
    assert.ok(field in sample, `announcement is missing ${field}`);
  }
});

test('GET /api/demo-emails returns the preconfigured demo set', async () => {
  const { status, json } = await req('GET', '/api/demo-emails');
  assert.equal(status, 200);
  assert.ok(json.emails.length >= 5, 'expected at least 5 demo emails');
  assert.ok(json.emails.some((e) => e.id === 'demo-2-fake-course'));
});

test('POST /api/analyze-email scores the safe email LOW and persists it', async () => {
  const { status, json } = await req('POST', '/api/analyze-email', { ...SAFE, studentId: 'stu-alex' });
  assert.equal(status, 201);
  assert.equal(json.result.level, 'LOW', `expected LOW, got ${json.result.level} (${json.result.score})`);
  assert.equal(json.result.contextMatch.status, 'MATCH FOUND');
  assert.equal(json.result.checks.length, 7);
  assert.ok(json.analysisId > 0);
  safeAnalysis = json;
});

test('POST /api/analyze-email scores the attack email HIGH/CRITICAL', async () => {
  const { status, json } = await req('POST', '/api/analyze-email', { ...ATTACK, studentId: 'stu-alex' });
  assert.equal(status, 201);
  assert.ok(['HIGH', 'CRITICAL'].includes(json.result.level), `expected HIGH/CRITICAL, got ${json.result.level}`);
  assert.equal(json.result.contextMatch.status, 'NO MATCH FOUND');
  assert.equal(json.result.personalisation.detected, true);
  assert.ok(json.result.verdict.reasons.length >= 3, 'verdict must list the reasons');
  assert.ok(json.result.analysisLog.length > 5, 'analysis log must be populated');
  assert.ok(json.result.scoreBreakdown.length > 0, 'score breakdown must be auditable');
  attackAnalysis = json;
});

test('POST /api/analyze-email rejects a missing sender', async () => {
  const { status, json } = await req('POST', '/api/analyze-email', { subject: 'hi', body: 'there' });
  assert.equal(status, 400);
  assert.equal(json.ok, false);
});

test('POST /api/verify-announcement returns VERIFIED for the official email', async () => {
  const { status, json } = await req('POST', '/api/verify-announcement', SAFE);
  assert.equal(status, 200);
  assert.equal(json.verification.outcome, 'VERIFIED');
  assert.ok(json.verification.record.official_url);
  assert.ok(json.verification.record.official_sender);
});

test('POST /api/verify-announcement returns NO_MATCH for the fake email', async () => {
  const { status, json } = await req('POST', '/api/verify-announcement', ATTACK);
  assert.equal(status, 200);
  assert.equal(json.verification.outcome, 'NO_MATCH');
  assert.match(json.verification.recommendation, /official student portal/i);
  assert.equal(json.verification.record, null);
});

test('POST /api/verify-announcement returns PARTIAL when the link is swapped', async () => {
  const { status, json } = await req('POST', '/api/verify-announcement', {
    from: 'training@northstaruniversity.edu',
    subject: 'Official AI Certification Programme — Registration Extended',
    body: 'The AI Certification Programme registration has been extended. Updated registration link: https://northstar-course-registration.example/extended',
    claimedDepartment: 'Training and Development',
    claimedType: 'Certification Programme',
  });
  assert.equal(status, 200);
  assert.equal(json.verification.outcome, 'PARTIAL');
  assert.ok(json.verification.mismatches.length > 0);
});

test('POST /api/threats/report files a report and returns an incident id', async () => {
  const { status, json } = await req('POST', '/api/threats/report', {
    analysisId: attackAnalysis.analysisId,
    emailId: attackAnalysis.emailId,
    reportedBy: 'alex.kumar@northstaruniversity.edu',
  });
  assert.equal(status, 201);
  assert.match(json.incidentId, /^INC-\d{6}$/);
  assert.equal(json.status, 'investigating');
  assert.match(json.message, /Report submitted to Campus Security/);
  globalThis.__reportId = json.reportId;
});

test('GET /api/threats shows the new report in the admin queue', async () => {
  const { status, json } = await req('GET', '/api/threats');
  assert.equal(status, 200);
  const filed = json.threats.find((t) => t.id === globalThis.__reportId);
  assert.ok(filed, 'the student report must appear in the admin threat queue');
  assert.ok(['HIGH', 'CRITICAL'].includes(filed.riskLevel));
  assert.ok(filed.detectedIndicators.length > 0, 'the report must carry the detected indicators');
});

test('PATCH /api/threats/:id updates status and records an admin action', async () => {
  const { status, json } = await req('PATCH', `/api/threats/${globalThis.__reportId}`, {
    action: 'escalate',
    actor: 'soc.lead@northstaruniversity.edu',
  });
  assert.equal(status, 200);
  assert.equal(json.status, 'escalated');
  assert.equal(json.watchlisted, 'northstar-career-program.com', 'escalation must cover the sender domain');

  assert.equal(json.watchlistAdded, false, 'an existing watchlist entry must not be duplicated');

  const list = await req('GET', '/api/threats');
  assert.equal(list.json.threats.find((t) => t.id === globalThis.__reportId).status, 'escalated');
});

test('PATCH /api/threats/:id rejects an unsupported action', async () => {
  const { status, json } = await req('PATCH', `/api/threats/${globalThis.__reportId}`, { action: 'delete-everything' });
  assert.equal(status, 400);
  assert.equal(json.ok, false);
});

test('GET /api/threats/:id/timeline returns the incident history', async () => {
  const { status, json } = await req('GET', `/api/threats/${globalThis.__reportId}/timeline`);
  assert.equal(status, 200);
  assert.ok(json.timeline.length >= 3, 'timeline should include detection, analysis and the admin action');
  assert.ok(json.timeline.some((t) => t.kind === 'action'));
});

test('GET /api/dashboard/stats reflects the session activity', async () => {
  const { status, json } = await req('GET', '/api/dashboard/stats');
  assert.equal(status, 200);
  assert.equal(json.demo, true);
  assert.ok(json.kpis.emailsAnalyzed > 0);
  assert.ok(json.kpis.studentReports > 0);
  assert.ok(json.sessionCounts.analysed >= 2, 'both analysed emails must be counted');
  assert.ok(json.byCategory.length > 0);
  assert.ok(json.threatMonitor.length > 0);
  assert.match(json.notice, /fictional/i);
});

test('watchlist add / duplicate / delete cycle works', async () => {
  const added = await req('POST', '/api/watchlist', {
    domain: 'evil-lookalike.example',
    reason: 'Test entry',
  });
  assert.equal(added.status, 201);
  const id = added.json.entry.id;

  const dupe = await req('POST', '/api/watchlist', { domain: 'evil-lookalike.example' });
  assert.equal(dupe.status, 409);

  const invalid = await req('POST', '/api/watchlist', { domain: 'not a domain' });
  assert.equal(invalid.status, 400);

  const list = await req('GET', '/api/watchlist');
  assert.ok(list.json.watchlist.some((w) => w.domain === 'evil-lookalike.example'));

  const del = await req('DELETE', `/api/watchlist/${id}`);
  assert.equal(del.status, 200);

  const after = await req('GET', '/api/watchlist');
  assert.ok(!after.json.watchlist.some((w) => w.domain === 'evil-lookalike.example'));
});

test('a watchlisted sender raises the risk score of an otherwise-unknown email', async () => {
  const before = await req('POST', '/api/analyze-email', {
    from: 'noreply@watch-me.example',
    subject: 'Notice',
    body: 'Generic message with no indicators.',
  });
  await req('POST', '/api/watchlist', { domain: 'watch-me.example', reason: 'test' });
  const after = await req('POST', '/api/analyze-email', {
    from: 'noreply@watch-me.example',
    subject: 'Notice',
    body: 'Generic message with no indicators.',
  });
  assert.ok(
    after.json.result.score > before.json.result.score,
    `watchlisting should raise the score (${before.json.result.score} → ${after.json.result.score})`,
  );
});

test('GET /api/settings exposes trusted sources and they are editable', async () => {
  const { status, json } = await req('GET', '/api/settings');
  assert.equal(status, 200);
  assert.ok(json.verifiedDomains.length >= 2);
  assert.ok(json.channels.length >= 3);
  assert.ok(json.announcements.length >= 8);

  const add = await req('POST', '/api/settings/domains', {
    domain: 'news.northstaruniversity.edu',
    department: 'Communications',
    purpose: 'Test addition',
  });
  assert.equal(add.status, 201);

  const list = await req('GET', '/api/settings');
  const entry = list.json.verifiedDomains.find((d) => d.domain === 'news.northstaruniversity.edu');
  assert.ok(entry);

  const del = await req('DELETE', `/api/settings/domains/${entry.id}`);
  assert.equal(del.status, 200);
});

test('the primary institutional domain cannot be removed', async () => {
  const list = await req('GET', '/api/settings');
  const primary = list.json.verifiedDomains.find((d) => d.domain === 'northstaruniversity.edu');
  const del = await req('DELETE', `/api/settings/domains/${primary.id}`);
  assert.equal(del.status, 400);
});

test('POST /api/parse-eml parses an uploaded message', async () => {
  const eml = [
    'From: courses@northstar-career-program.com',
    'To: alex.kumar@northstaruniversity.edu',
    'Subject: URGENT: You Have Been Selected',
    'Content-Type: text/plain; charset="utf-8"',
    '',
    'Congratulations Alex Kumar, register now at https://northstar-course-registration.example/register',
  ].join('\n');
  const { status, json } = await req('POST', '/api/parse-eml', { raw: eml });
  assert.equal(status, 200);
  assert.equal(json.email.from, 'courses@northstar-career-program.com');
  assert.match(json.email.subject, /URGENT/);
  assert.ok(json.email.links.includes('https://northstar-course-registration.example/register'));
});

test('POST /api/parse-eml rejects junk input', async () => {
  const { status } = await req('POST', '/api/parse-eml', { raw: 'not an email at all' });
  assert.equal(status, 422);
});

test('unknown API routes return a structured 404', async () => {
  const { status, json } = await req('GET', '/api/does-not-exist');
  assert.equal(status, 404);
  assert.equal(json.ok, false);
});

test('POST /api/demo/reset clears session data and re-seeds demo events', async () => {
  const before = await req('GET', '/api/threats');
  assert.ok(before.json.count > 0);

  const reset = await req('POST', '/api/demo/reset');
  assert.equal(reset.status, 200);
  assert.equal(reset.json.ok, true);

  const after = await req('GET', '/api/threats');
  assert.ok(after.json.count > 0, 'seeded demo incidents must come back');
  assert.ok(
    after.json.threats.every((t) => t.status === 'investigating' || ['reported', 'reviewed'].includes(t.status)),
    'reports should return to seeded state',
  );

  const stats = await req('GET', '/api/dashboard/stats');
  assert.equal(stats.json.sessionCounts.analysed, 0, 'session analyses must be cleared by the reset');

  const anns = await req('GET', '/api/verified-announcements');
  assert.ok(anns.json.count >= 8);
});

test('escalating a report for an unwatchlisted domain adds it to the watchlist', async () => {
  const analysed = await req('POST', '/api/analyze-email', {
    from: 'noreply@fresh-impersonator.example',
    subject: 'URGENT: Final notice for your scholarship',
    body: 'Act now or lose your scholarship. Verify your account at https://fresh-impersonator.example/verify',
  });
  const filed = await req('POST', '/api/threats/report', {
    analysisId: analysed.json.analysisId,
    emailId: analysed.json.emailId,
  });
  const patched = await req('PATCH', `/api/threats/${filed.json.reportId}`, { action: 'escalate' });
  assert.equal(patched.json.watchlisted, 'fresh-impersonator.example');
  assert.equal(patched.json.watchlistAdded, true);

  const list = await req('GET', '/api/watchlist');
  const entry = list.json.watchlist.find((w) => w.domain === 'fresh-impersonator.example');
  assert.ok(entry, 'escalation must create a watchlist entry for a new domain');
  assert.match(entry.reason, /Escalated incident/);
});
