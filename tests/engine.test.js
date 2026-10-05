import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeEmail, aggregate, verifyClaim, isInstitutionalDomain, isFormLink } from '../server/engine.js';
import { DEMO_EMAILS, findDemoEmail } from '../server/data/demoEmails.js';
import { VERIFIED_ANNOUNCEMENTS } from '../server/data/announcements.js';
import { WATCHLIST_SEED } from '../server/data/announcements.js';

const announcements = VERIFIED_ANNOUNCEMENTS.map((a, i) => ({ id: i + 1, ...a }));
const watchlist = new Set(WATCHLIST_SEED.map((w) => w.domain));

const ctx = { announcements, watchlist };

function analyze(id) {
  const demo = findDemoEmail(id);
  return { demo, result: analyzeEmail(demo.email, ctx) };
}

test('aggregation saturates between 0 and 100', () => {
  assert.equal(aggregate([]).score, 0);
  assert.equal(aggregate([{ weight: -50 }]).score, 0);
  const big = aggregate([{ weight: 1000 }]);
  assert.equal(big.score, 100);
  assert.equal(big.rawScore, 1000);
  const mid = aggregate([{ weight: 25 }]);
  assert.ok(mid.score > 25 && mid.score < 40, `expected mid band score, got ${mid.score}`);
});

test('analysis is deterministic across repeated runs', () => {
  for (const demo of DEMO_EMAILS) {
    const a = analyzeEmail(demo.email, ctx);
    const b = analyzeEmail(demo.email, ctx);
    assert.equal(a.score, b.score, `${demo.id} score changed between runs`);
    assert.equal(a.level, b.level);
    assert.deepEqual(
      a.indicators.map((i) => i.id),
      b.indicators.map((i) => i.id),
    );
  }
});

test('DEMO 1 — safe institutional certification email is LOW risk and verified', () => {
  const { result } = analyze('demo-1-safe-certification');
  assert.equal(result.level, 'LOW', `expected LOW, got ${result.level} (score ${result.score})`);
  assert.equal(result.sender.verified, true);
  assert.equal(result.contextMatch.status, 'MATCH FOUND');
  assert.equal(result.linkAnalysis.every((l) => l.institutional), true);
  assert.equal(result.personalisation.detected, false);

  const verification = verifyClaim(findDemoEmail('demo-1-safe-certification').email, announcements);
  assert.equal(verification.outcome, 'VERIFIED');
  assert.ok(verification.record, 'verified outcome must include the official record');
});

test('DEMO 2 — fake personalised certification email is CRITICAL/HIGH and unverified', () => {
  const { result } = analyze('demo-2-fake-course');
  assert.ok(['HIGH', 'CRITICAL'].includes(result.level), `expected HIGH/CRITICAL, got ${result.level}`);
  assert.equal(result.sender.verified, false);
  assert.equal(result.contextMatch.status, 'NO MATCH FOUND');
  assert.equal(result.personalisation.detected, true);
  assert.ok(result.indicators.some((i) => i.id === 'social_urgency'), 'urgency must be detected');
  assert.ok(result.indicators.some((i) => i.id === 'external_registration_link'), 'external form link must be detected');
  assert.ok(result.indicators.some((i) => i.id === 'social_credential_request'), 'credential request must be detected');
  assert.ok(result.indicators.some((i) => i.id === 'lookalike_domain'), 'look-alike domain must be detected');

  const verification = verifyClaim(findDemoEmail('demo-2-fake-course').email, announcements);
  assert.equal(verification.outcome, 'NO_MATCH');
  assert.match(verification.recommendation, /official student portal/i);
});

test('DEMO 3 — fake placement email is CRITICAL/HIGH and unverified', () => {
  const { result } = analyze('demo-3-fake-placement');
  assert.ok(['HIGH', 'CRITICAL'].includes(result.level), `expected HIGH/CRITICAL, got ${result.level}`);
  assert.equal(result.sender.verified, false);
  assert.equal(result.contextMatch.status, 'NO MATCH FOUND');
  assert.ok(result.indicators.some((i) => i.id === 'social_credential_request'));
  assert.ok(result.indicators.some((i) => i.id === 'social_pressure_language'));

  const verification = verifyClaim(findDemoEmail('demo-3-fake-placement').email, announcements);
  assert.equal(verification.outcome, 'NO_MATCH');
});

test('DEMO 4 — suspicious scholarship email is MEDIUM/HIGH', () => {
  const { result } = analyze('demo-4-suspicious-scholarship');
  assert.ok(['MEDIUM', 'HIGH', 'CRITICAL'].includes(result.level), `expected MEDIUM+, got ${result.level}`);
  assert.equal(result.sender.verified, false);
  assert.equal(result.personalisation.detected, true);
  const verification = verifyClaim(findDemoEmail('demo-4-suspicious-scholarship').email, announcements);
  assert.notEqual(verification.outcome, 'VERIFIED');
});

test('DEMO 5 — legitimate placement email is LOW risk and verified', () => {
  const { result } = analyze('demo-5-safe-placement');
  assert.equal(result.level, 'LOW', `expected LOW, got ${result.level} (score ${result.score})`);
  assert.equal(result.contextMatch.status, 'MATCH FOUND');
  const verification = verifyClaim(findDemoEmail('demo-5-safe-placement').email, announcements);
  assert.equal(verification.outcome, 'VERIFIED');
});

test('DEMO 6 — official sender with swapped link is PARTIAL, never verified', () => {
  const { result } = analyze('demo-6-partial-official-sender');
  assert.equal(result.sender.verified, true, 'sender really is the official institutional address');
  assert.equal(result.contextMatch.status, 'PARTIAL MATCH');
  const verification = verifyClaim(findDemoEmail('demo-6-partial-official-sender').email, announcements);
  assert.equal(verification.outcome, 'PARTIAL');
  assert.match(verification.message, /sender or the destination link differs/i);
  assert.ok(verification.mismatches.length > 0, 'must state which anchor deviates');
});

test('DEMO 7 — typosquat workshop invitation does not verify as the real workshop', () => {
  const { result } = analyze('demo-7-typosquat-workshop');
  assert.notEqual(result.contextMatch.status, 'MATCH FOUND');
  const verification = verifyClaim(findDemoEmail('demo-7-typosquat-workshop').email, announcements);
  assert.notEqual(verification.outcome, 'VERIFIED');
  assert.ok(result.indicators.some((i) => i.id === 'lookalike_domain'), 'typosquat must be flagged as look-alike');
  assert.ok(result.sender.similarity >= 60, `expected look-alike similarity, got ${result.sender.similarity}`);
});

test('student information wording never claims a breached database', () => {
  const { result } = analyze('demo-2-fake-course');
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /database (?:was )?hack/i);
  assert.doesNotMatch(text, /definitely (?:a )?(?:cyber)?attack/i);
  assert.match(result.personalisation.interpretation, /cannot be determined from the email alone/i);
});

test('simulated authentication results are always labelled simulated', () => {
  const { result } = analyze('demo-2-fake-course');
  assert.equal(result.authentication.simulated, true);
  assert.match(result.authentication.note, /Simulated authentication results for prototype/i);
});

test('verified institutional mail produces zero risk score', () => {
  const result = analyzeEmail(
    {
      from: 'library@northstaruniversity.edu',
      to: 'alex.kumar@northstaruniversity.edu',
      subject: 'Library Membership Renewal and Digital Resource Access',
      body: 'Dear Students, library membership renewal is available on the library portal. Regards, Library',
      links: ['https://library.northstaruniversity.edu/renewal'],
      claimedDepartment: 'Library',
      claimedAnnouncementType: 'Service Notice',
    },
    ctx,
  );
  assert.equal(result.score, 0, `expected 0, got ${result.score}`);
  assert.equal(result.level, 'LOW');
});

test('an empty/garbage email is handled without throwing', () => {
  const result = analyzeEmail({ from: 'not-an-email', subject: '', body: '', links: [] }, ctx);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.sender.valid, false);
  assert.ok(Array.isArray(result.checks));
  assert.equal(result.checks.length, 7);
});

test('domain helpers behave', () => {
  assert.equal(isInstitutionalDomain('northstaruniversity.edu'), true);
  assert.equal(isInstitutionalDomain('portal.northstaruniversity.edu'), true);
  assert.equal(isInstitutionalDomain('northstaruniversity.edu.attacker.example'), false);
  assert.equal(isInstitutionalDomain('northstar-career-program.com'), false);
  assert.equal(isFormLink('https://x.example/register'), true);
  assert.equal(isFormLink('https://northstaruniversity.edu/placements/drive-se-2026'), false);
});

test('every analysis exposes seven check modules and a verdict', () => {
  for (const demo of DEMO_EMAILS) {
    const result = analyzeEmail(demo.email, ctx);
    assert.equal(result.checks.length, 7, `${demo.id} check count`);
    assert.ok(result.verdict.reasons.length > 0, `${demo.id} must explain its verdict`);
    assert.ok(result.verdict.recommendedAction.length > 0);
    assert.ok(result.analysisLog.length > 5);
    assert.equal(result.model.disclaimer.includes('Prototype Risk Score'), true);
  }
});
