# TrustShield / CampusShield

**Context-aware institutional impersonation detection.**
CampusShield is the first deployment scenario (a college); TrustShield is the platform underneath it.

> Traditional phishing detection asks: *is this email malicious?*
> CampusShield additionally asks: *does this communication make sense in the context of this institution?*

A full-stack prototype with a dark SOC aesthetic, a deterministic and explainable risk engine, a verified-announcement database as ground truth, and a working student → analyst → incident-triage loop. No API keys, no paid services, no network calls at runtime, and no real personal data.

---

## Quick start

```bash
npm install
npm run dev      # API on :5174 + Vite UI on :5173 (UI proxies /api)
```

Production-style single-port run:

```bash
npm run build    # bundle the UI into dist/
npm start        # API + built UI together on http://127.0.0.1:5174
```

```bash
npm test         # 40 tests: engine contract + end-to-end API suite
```

`PORT` and `CAMPUSSHIELD_DB` are honoured (an empty/invalid `PORT` falls back to `5174`). The database is created and seeded on first boot at `data/campusshield.sqlite`; delete that file for a clean slate.

---

## Problem statement

Colleges are impersonated constantly. Scholarship offers, placement-cell "verification forms", fee reminders, certificate registrations and workshop invitations all arrive as convincing HTML mail that carries the institution's own tone, timing and vocabulary. Students trust them precisely because they reference real programmes, real deadlines and real student details.

The damage lands hardest where the victim is least suspicious: a final-semester student who just received an internship offer, or a student who genuinely submitted an enquiry two weeks earlier.

## Existing gap

| Layer | What it does | What it cannot do |
|---|---|---|
| Mail-client spam filters | Block known-bad senders, bulk patterns, prior campaigns | Cannot answer "does *this* department ever send *this* kind of message?" |
| URL reputation | Scores a destination domain | The link in a real impersonation is frequently newly registered and unknown |
| SPF / DKIM / DMARC | Establishes that *a* domain authorised the mail | A look-alike domain passes perfectly on its own infrastructure |
| Breach/credential monitoring | Tells you a password leaked | Says nothing about an institutional message that asks for nothing at all |

The common blind spot: every one of these reasons about the **message in isolation**. They have no model of what the institution has actually announced, from which senders, on which dates. An attacker does not need to break any of those layers — the attacker only needs the sentence to sound institutional.

## Proposed solution

CampusShield adds a ground-truth layer: a **verified announcement record** of what the institution has genuinely published — title, department, type, official sender, official destination URL, publication date. Every submitted message is checked against it, and the result is an explicit verdict rather than a silent score:

- **MATCH FOUND** — the claim reconciles with a real announcement (topic overlap plus agreement on sender, destination URL and department).
- **PARTIAL MATCH** — anchored to a real institutional announcement but deviating on sender or link. This is the *compromised mailbox / internal misuse* case, and it is deliberately not called safe.
- **NO MATCH FOUND** — the claim does not exist in the record, or a similar announcement exists but the sender and destination do not agree with it.

Because an attacker must now forge a claim that reconciles against a record they do not control, personalising the message with a student's real programme and roll number stops being the strongest signal it used to be — it becomes evidence in the attacker's favour.

Around that verdict sits a transparent, auditable risk model, seven explainable security-check modules, a student reporting flow, and an analyst triage queue with a watchlist that feeds back into future scoring.

## Key innovation

```
Email security  +  Institutional context  +  Student-information usage
              +  Trusted announcement verification  +  Explainable risk
```

Every component is inspectable: the report names the indicator that fired, the weight it contributed, the phrase that triggered a language check, and the log line the engine wrote while deciding. A student can see *why*, an analyst can audit *what*, and a reviewer can reproduce *how*.

A deliberately important nuance: student-specific information in a message is reported as an **indicator**, and the product states that the source of that information **cannot be determined from the email alone**. It never asserts that a student database was breached.

## System architecture

```
client (React SPA)
  │  REST /api/*
  ▼
express  ── server/api.js        routing, validation, structured error shape
  │
  ├─ server/engine.js           PURE + DETERMINISTIC analysis pipeline
  │     ├─ sender verification        (verified_domains)
  │     ├─ authentication             ← services/authenticationService.js
  │     ├─ institutional context      ← services/announcementSource.js
  │     ├─ link analysis              ← services/urlReputationService.js
  │     ├─ social engineering         ← services/nlpService.js
  │     ├─ personalisation            ← services/nlpService.js
  │     ├─ communication pattern      ← services/nlpService.js
  │     └─ aggregate() → score, verdict, analysis log
  │
  ├─ server/db.js               node:sqlite, schema, seed, demo reset
  ├─ server/seedDemo.js         attaches engine-produced analyses to seeded incidents
  └─ server/services/index.js   mock provider registry (one interface per future integration)

Every service module ships a working mock and an implementation note describing what a real
provider would need. Swapping a provider means binding a new implementation in services/index.js —
the engine does not change.
```

The engine is a pure function of its inputs: same email, same database, same score. That is what makes the demo reproducible and the behaviour testable.

## Technology stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 22.5 — built-in `node:sqlite`, so there are **zero native dependencies** |
| Backend | Express 4 · REST · structured JSON errors · strict CSP |
| Database | SQLite via `node:sqlite`, WAL, seeded with fictional data |
| Frontend | React 18 + Vite 5 · React Router 6 |
| Charts | Recharts (bar + donut); the relationship graph is hand-drawn SVG |
| Styling | Hand-written CSS design tokens · JetBrains Mono + Inter |
| Tests | `node:test` — engine contract + end-to-end API suite (40 tests) |
| External services | **None.** No API keys, no paid APIs, no runtime network calls |

## Risk detection method

A transparent rule-based indicator model, aggregated through an exponential saturation curve so the headline score stays comparable between messages. The raw weight is exposed in every report for auditability.

```
raw   = Σ indicator weights
score = clamp(round(100 × (1 − e^(−raw / 70))), 0, 100)

BANDS  0–24 LOW · 25–49 MEDIUM · 50–74 HIGH · 75–100 CRITICAL
```

Verified institutional mail resolves to a raw sum at or below zero and therefore scores 0.

| Indicator | Weight |
|---|---|
| Sender domain not a verified institutional domain | +25 |
| No corresponding verified announcement | +20 |
| Verified sender used with a non-official destination link | +20 |
| External registration / verification / document form | +20 |
| Credential request | +15 |
| Sender domain on the watchlist | +15 |
| Destination matches known abuse infrastructure | +15 |
| Link destination outside institutional domains | +12 |
| Urgency language | +10 |
| Student-specific personalisation | +10 |
| Sender domain resembles a verified domain | +10 |
| Unusual institutional communication pattern | +10 |
| Similar announcement exists but sender/link differs | +8 |
| Financial request · pressure language · sensitive-document request | +8 each |
| Opportunity bait (selection / exclusivity) | +6 |
| Verified institutional sender | −25 |
| All links are official institutional URLs | −20 |
| Claim confirmed by the verified announcement record | −30 |
| Simulated SPF/DKIM/DMARC all pass | −8 |
| Consistent institutional communication pattern | −6 |

The seven check modules shown in the UI: **sender verification, email authentication, institutional context, link analysis, social engineering analysis, student information usage, college communication pattern.**

The language layer is rule-based phrase detection with negation handling, so genuine notices that disclaim fees or password requests are not mis-flagged ("no registration fee is required" is not a financial hit). The UI calls it the *Context Analysis Engine* and never claims an external AI model was used.

## Database structure

| Table | Purpose |
|---|---|
| `users` | Demo student and analyst profiles (fictional) |
| `verified_domains` | Institutional domains accepted as legitimate senders |
| `verified_announcements` | **Ground truth** the context engine checks claims against |
| `communication_channels` | Official channels students are told to verify through |
| `emails` | Submitted messages (pasted text or parsed `.eml`) |
| `email_analysis` | Per-email checks, indicators, score, verdict, analysis log |
| `threat_reports` | Analyst-facing incident queue with a status workflow |
| `watchlist` | Flagged sender domains that raise risk on future analyses |
| `admin_actions` | Audit trail of every triage action |
| `threat_events` | Threat-monitor feed entries |

## Prototype limitations

Stated plainly, because a detection product that overstates itself is worse than none:

- SPF, DKIM and DMARC values are **simulated** from the sender domain. They are not read from real headers or DNS, and are labelled simulated wherever they appear.
- URL reputation and threat-intelligence records are **fictional**. Links are never fetched, resolved or expanded.
- The context engine is **lexical** matching against a seeded announcement table — not a semantic model, not a generalisable detector.
- The risk score is a documented rule aggregate, **not a calibrated probability**. It is decision support, not a guarantee, and it has not been scientifically validated.
- There is no authentication. Role selection is local and demonstrative only.
- No mailbox is connected, no email is sent, and no credentials are collected.
- Detection is only as good as the verified announcement record: a claim that never appears in the record cannot be verified, by construction.
- No real Outlook / Microsoft Graph integration exists yet — the service module and its implementation notes are in place instead.

## Future scope

- **Microsoft Graph / Outlook ingestion** behind `services/mailSource.js`, with tenant-scoped subscriptions and least-privilege permissions.
- **Real authentication verdicts** parsed from receiving-platform headers behind `services/authenticationService.js`.
- **Commercial URL reputation** (Defender Safe Links, Safe Browsing, VirusTotal, PhishTank) behind `services/urlReputationService.js`, sandboxed so no link is ever resolved from an analyst network.
- **Real threat-intelligence feeds** behind `services/threatIntelService.js`, normalised with provenance so explanations can cite sources.
- **Institutional announcement APIs** (CMS, ERP/SIS, SharePoint) behind `services/announcementSource.js`, replacing lexical matching with retrieval scoring.
- **A trained NLP model** behind `services/nlpService.js`, keeping the rule engine as a graceful fallback and never letting a generative model invent indicators.
- **Multi-tenancy**: an `institution_id` column across every table, turning CampusShield into TrustShield serving many institutions.
- **Real SSO** (OIDC/SAML) with roles derived from directory group membership.

## Privacy considerations

- All institutional, student and threat data in this prototype is **fictional**. No real names, IDs, emails or phone numbers appear anywhere.
- The prototype never connects to a mailbox, never sends email, and never collects passwords or credentials.
- Links inside submitted emails are analysed as **text only** — they are never opened or resolved.
- No external service is contacted at runtime; the application functions fully offline.
- A strict Content Security Policy restricts scripts and connections to same-origin, so the UI cannot quietly phone home.
- A production deployment would add retention limits, encryption at rest, and an explicit policy for stored message bodies.

## Hackathon demo flow (~3 minutes)

1. **Landing** — hero pipeline (EMAIL → THREAT ANALYSIS → TRUST VERIFICATION → SECURITY DECISION), terminal preview, live system-status panel.
2. **Run Live Demo** — Student Dashboard → *Run Live Demo*. Loads the personalised fake certification email and starts the analysis automatically.
3. **Watch the scan** — the console runs its staged checks, then reveals the report: CRITICAL risk, arc gauge, and the reasons appearing one at a time.
4. **Read the checks** — expand *technical detail* on sender verification, institutional context, link analysis, student information usage.
5. **Verify with College** — click *Verify with College* → **NO VERIFIED MATCH**, with the recommended action: use the official portal.
6. **Report** — click *Report Suspicious Email* → an incident ID appears in a system toast.
7. **Switch role** — switch to the security-admin demo. The new incident is at the top of the threat queue with its indicators.
8. **Triage** — open the incident, escalate it, and show the sender domain being added to the watchlist.
9. **Reset** — *Reset Demo Data* returns everything to its seeded state for the next run.

Supporting scenarios: the safe certification and placement emails both score 0 / LOW and verify as VERIFIED; the scholarship email scores HIGH; and the official-sender-with-swapped-link scenario produces PARTIAL MATCH — the compromised-mailbox case worth highlighting.

## Acceptance criteria

| # | Criterion | Where |
|---|---|---|
| 1 | Landing page works | `/` |
| 2 | Student dashboard works | `/student` |
| 3 | Email can be entered | `/student/scan` (paste or `.eml`) |
| 4 | Demo emails can be loaded | *Run Live Demo* / *Load scenario* |
| 5 | Email analysis produces a result | `/student/analysis/:id` |
| 6 | Risk score is generated | arc gauge + band |
| 7 | Individual security checks displayed | 7 check modules |
| 8 | Student-information detection works | *Student Information Usage* module |
| 9 | Link analysis works (simulated data) | *Link Analysis* module |
| 10 | Announcement verification works | `/student/verify`, *Institutional Context* |
| 11 | Verified announcement database exists | 10 seeded records |
| 12 | Fake announcement → "No Verified Match" | demo 2 / 3 / 4 / 7 |
| 13 | Legitimate email → "Verified" | demo 1 / 5 |
| 14 | Student can report an email | `POST /api/threats/report` |
| 15 | Admin dashboard receives the report | `/admin/threats` |
| 16 | Threat statistics update | `/api/dashboard/stats` session counts |
| 17 | Threat detail page works | `/admin/threats/:id` |
| 18 | Watchlist works | `/admin/watchlist` add / remove |
| 19 | Demo reset works | `POST /api/demo/reset` |
| 20 | No real personal information | fictional fixtures only |
| 21 | No paid API required | — |
| 22 | No external credentials required | — |
| 23 | All buttons functional | no placeholder handlers |
| 24 | Polished enough to demo | dark SOC theme, responsive to 375px |

## Repository layout

```
server/
  index.js        entry point, security headers, static SPA hosting
  api.js          REST surface (validation + structured errors)
  db.js           schema, seed, demo reset, post-seed hook
  engine.js       pure deterministic analysis pipeline
  seedDemo.js     attaches real analyses to the seeded incidents
  data/           fictional institution, announcements, demo emails
  services/       six mock provider modules + registry
src/
  pages/          Landing, StudentDashboard, EmailScanner, AnalysisReport,
                  Verification, MyReports, AdminOverview, ThreatQueue,
                  ThreatDetail, Watchlist, Settings, ThreatIntel
  components/     Layout, ui primitives, RiskGauge, CheckCard, Toast
  styles/         theme.css (tokens) + components.css
tests/
  engine.test.js  engine contract, demo scenarios, privacy wording
  api.test.js     end-to-end demo story against a real Express app
```

This README is the project documentation; the prototype deliberately ships without an in-app documentation page.