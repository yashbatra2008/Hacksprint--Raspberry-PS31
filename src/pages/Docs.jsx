import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { Alert, Badge, KV, Panel, PanelBody, PanelHead } from '../components/ui.jsx';

const SECTIONS = [
  {
    id: 'problem',
    title: 'Problem Statement',
    body: [
      'Students receive emails that appear to come from their college and promote courses, internships, placements, certifications, scholarships and other opportunities. These messages carry legitimate-looking student information, college branding, familiar terminology and convincing calls to action.',
      'Because the content mirrors language students already trust, they are extremely difficult to distinguish from genuine institutional communication — and the consequences of clicking through include credential theft, payment fraud and identity misuse.',
    ],
  },
  {
    id: 'gap',
    title: 'Existing Gap',
    body: [
      'Conventional phishing filters ask a single question: is this message malicious? They rely on sender reputation, header authentication and known-malicious URLs.',
      'That model degrades against institution impersonation. The sender may be a freshly registered look-alike domain with no history, the destination may not yet be on any blocklist, and the wording may be entirely clean — the deception lives in the *claim*, not in the message construction.',
      'The result is that a student who does their own research has no reliable way to confirm whether the announcement in front of them actually exists.',
    ],
  },
  {
    id: 'solution',
    title: 'Proposed Solution',
    body: [
      'CampusShield is the educational-institution deployment of TrustShield, a context-aware institutional impersonation detection platform. It evaluates a message on nine dimensions rather than one: sender identity, institutional association of the domain, the claim itself, whether that claim exists in verified institutional announcements, suspicious or external links, urgency and social-engineering language, personalised or student-specific information, adherence to normal institutional communication patterns, and whether the student can independently verify the claim through a trusted source.',
      'The output is an explainable risk assessment with a documented scoring model — never a bare verdict.',
    ],
  },
  {
    id: 'innovation',
    title: 'Key Innovation',
    callout:
      'Traditional phishing detection asks: is this email malicious?\n\nCampusShield additionally asks: does this communication make sense in the context of this institution?',
    body: [
      'The differentiator is trusted announcement verification. Every institution already publishes what it is doing — courses, drives, workshops, fee windows. If that publication record is treated as ground truth, an attacker must not merely forge an email; they must forge a claim that reconciles against a record they do not control.',
      'This composes as: Email Security + Institutional Context + Student Information Usage + Trusted Announcement Verification + Explainable Risk Analysis.',
      'A deliberately important nuance: student-specific information in a message is reported as an indicator, and CampusShield explicitly states that the source of that information cannot be determined from the email alone. It never asserts that a database was compromised.',
    ],
  },
  {
    id: 'architecture',
    title: 'System Architecture',
    code: [
      'client (React SPA)',
      '  │  REST /api/*',
      '  ▼',
      'express  ── server/api.js        routes, validation, error shape',
      '  │',
      '  ├─ server/engine.js            PURE + DETERMINISTIC analysis pipeline',
      '  │     ├─ sender verification       (verified_domains)',
      '  │     ├─ authentication            ← services/authenticationService.js',
      '  │     ├─ institutional context     ← services/announcementSource.js',
      '  │     ├─ link analysis             ← services/urlReputationService.js',
      '  │     ├─ social engineering        ← services/nlpService.js',
      '  │     ├─ personalisation           ← services/nlpService.js',
      '  │     ├─ communication pattern     ← services/nlpService.js',
      '  │     └─ aggregate() → score',
      '  │',
      '  ├─ server/db.js                 node:sqlite, schema, seed, reset',
      '  └─ server/services/index.js     mock provider registry',
      '',
      'Every service in server/services/ implements a fixed interface and ships',
      'with a working mock. Swapping in a real provider means binding a new',
      'implementation in services/index.js — the engine does not change.',
    ],
    body: [
      'The engine is a pure function of its inputs: same email, same database, same score. That is what makes the demo reproducible and the behaviour testable.',
    ],
  },
  {
    id: 'stack',
    title: 'Technology Stack',
    rows: [
      ['Runtime', 'Node.js ≥ 22.5 (built-in node:sqlite — zero native dependencies)'],
      ['Backend', 'Express 4 · REST · structured JSON errors'],
      ['Database', 'SQLite via node:sqlite, WAL mode, seeded with fictional data'],
      ['Frontend', 'React 18 + Vite 5 · React Router 6'],
      ['Charts', 'Recharts (bar + donut) · relationship graph hand-drawn as SVG'],
      ['Styling', 'Hand-written CSS design tokens · JetBrains Mono + Inter'],
      ['Tests', 'node:test — engine contract + end-to-end API suite'],
      ['External services', 'None. No API keys, no paid APIs, no network calls at runtime.'],
    ],
  },
  {
    id: 'method',
    title: 'Risk Detection Method',
    body: [
      'A transparent rule-based indicator model, aggregated with an exponential saturation curve so the headline score stays comparable between messages. The raw sum is exposed in the report for auditability.',
      'Verified institutional mail resolves to a raw sum at or below zero and therefore scores 0.',
    ],
    table: {
      headers: ['Indicator', 'Weight'],
      rows: [
        ['Sender domain not a verified institutional domain', '+25'],
        ['No corresponding verified announcement', '+20'],
        ['Verified sender used with a non-official destination link', '+20'],
        ['External registration / verification / document form', '+20'],
        ['Credential request', '+15'],
        ['Sender domain on the watchlist', '+15'],
        ['Destination matches known abuse infrastructure', '+15'],
        ['Link destination outside institutional domains', '+12'],
        ['Urgency language', '+10'],
        ['Student-specific personalisation', '+10'],
        ['Sender domain resembles a verified domain', '+10'],
        ['Unusual institutional communication pattern', '+10'],
        ['Similar announcement exists but sender/link differs', '+8'],
        ['Financial request · pressure language · sensitive data request', '+8 each'],
        ['Opportunity bait (selection / exclusivity)', '+6'],
        ['Verified institutional sender', '−25'],
        ['All links are official institutional URLs', '−20'],
        ['Claim confirmed by the verified announcement record', '−30'],
        ['Simulated SPF/DKIM/DMARC all pass', '−8'],
        ['Consistent institutional communication pattern', '−6'],
      ],
    },
    code: [
      'raw   = Σ indicator weights',
      'score = clamp(round(100 × (1 − e^(−raw / 70))), 0, 100)',
      '',
      'BANDS   0–24 LOW · 25–49 MEDIUM · 50–74 HIGH · 75–100 CRITICAL',
    ],
    notes: [
      'A separate, documented context decision governs verification: MATCH FOUND requires topic overlap plus agreement on sender, destination URL and department; PARTIAL MATCH covers an anchored-but-deviating message (the compromised-mailbox case); everything else is NO MATCH FOUND — including messages that merely resemble a real announcement.',
      'The language layer is rule-based phrase detection with negation handling, so genuine notices that disclaim fees or password requests are not mis-flagged. The UI calls it the Context Analysis Engine and never claims an external AI model was used.',
    ],
  },
  {
    id: 'database',
    title: 'Database Structure',
    table: {
      headers: ['Table', 'Purpose'],
      rows: [
        ['users', 'Demo student and analyst profiles (fictional)'],
        ['verified_domains', 'Institutional domains accepted as legitimate senders'],
        ['verified_announcements', 'Ground-truth announcement records for context matching'],
        ['communication_channels', 'Official channels students are told to verify through'],
        ['emails', 'Submitted messages (pasted text or parsed .eml)'],
        ['email_analysis', 'Per-email checks, indicators, score, verdict, analysis log'],
        ['threat_reports', 'Analyst-facing incident queue with status workflow'],
        ['watchlist', 'Flagged sender domains that raise risk on future analyses'],
        ['admin_actions', 'Audit trail of every triage action'],
        ['threat_events', 'Live threat-monitor feed entries'],
      ],
    },
  },
  {
    id: 'limitations',
    title: 'Prototype Limitations',
    items: [
      'SPF, DKIM and DMARC values are simulated from the sender domain. They are not read from real headers or DNS, and are labelled simulated wherever they appear.',
      'URL reputation and threat-intelligence records are fictional. Links are never fetched, resolved or expanded.',
      'The context engine is lexical matching against a seeded announcement table — not a semantic model, and not a generalised detector.',
      'The risk score is a documented rule aggregate, not a calibrated probability. It is decision support, not a guarantee, and it has not been scientifically validated.',
      'There is no authentication. Role selection is local and demonstrative only.',
      'No mailbox is connected, no email is sent, and no credentials are collected.',
      'Detection is only as good as the verified announcement record: a claim that never appears in the record cannot be verified by construction.',
      'No real Outlook / Microsoft Graph integration exists yet — the service module and its implementation notes are in place instead.',
    ],
  },
  {
    id: 'future',
    title: 'Future Scope',
    items: [
      'Microsoft Graph / Outlook ingestion behind server/services/mailSource.js, with tenant-scoped subscriptions and least-privilege permissions.',
      'Real authentication verdicts parsed from the receiving platform headers behind services/authenticationService.js.',
      'Commercial URL reputation (Defender Safe Links, Safe Browsing, VirusTotal, PhishTank) behind services/urlReputationService.js, sandboxed so no link is ever resolved from an analyst network.',
      'Real threat-intelligence feeds behind services/threatIntelService.js, normalised with provenance so explanations can cite sources.',
      'Institutional announcement APIs (CMS, ERP/SIS, SharePoint) behind services/announcementSource.js, replacing lexical matching with retrieval scoring.',
      'A trained NLP model behind services/nlpService.js, keeping the rule engine as a graceful fallback and never letting a generative model invent indicators.',
      'Multi-tenancy: an institution_id column across every table, turning CampusShield into TrustShield serving many institutions.',
      'Real SSO (OIDC/SAML) with roles derived from directory group membership.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Considerations',
    items: [
      'All institutional, student and threat data in this prototype is fictional. No real names, IDs, emails or phone numbers appear anywhere.',
      'The prototype never connects to a mailbox, never sends email, and never collects passwords or credentials.',
      'Links inside submitted emails are analysed as text only — they are never opened or resolved.',
      'No external service is contacted at runtime; the application functions fully offline.',
      'A strict Content Security Policy restricts scripts and connections to same-origin, so the UI cannot quietly phone home.',
      'A production deployment would add retention limits, encryption at rest, and an explicit policy for stored message bodies.',
    ],
  },
  {
    id: 'demo',
    title: 'Hackathon Demo Flow (~3 minutes)',
    steps: [
      ['Landing', 'Open the landing page — hero pipeline, terminal preview and the live system-status panel.'],
      ['Run Live Demo', 'Student Dashboard → Run Live Demo. Loads the personalised fake certification email and starts the analysis automatically.'],
      ['Watch the scan', 'The scanner console runs its staged checks, then reveals the report: CRITICAL risk, gauge, and the five reasons appearing one at a time.'],
      ['Read the checks', 'Expand the technical detail on a few modules — sender verification, institutional context, link analysis, student information usage.'],
      ['Verify with College', 'Click Verify with College → NO VERIFIED MATCH, with the recommended action to use the official portal.'],
      ['Report', 'Click Report Suspicious Email → incident ID appears in a system toast.'],
      ['Switch role', 'Switch role → Security Admin Demo. The new incident is at the top of the threat queue with its indicators.'],
      ['Triage', 'Open the incident, escalate it, and show the sender domain appearing on the watchlist.'],
      ['Reset', 'Reset Demo Data returns everything to its seeded state for the next run.'],
    ],
    body: [
      'Supporting scenarios: the safe certification and placement emails both score 0 / LOW and verify as VERIFIED; the scholarship email scores HIGH; the official-sender-with-swapped-link scenario produces PARTIAL MATCH, which is the compromised-mailbox case worth highlighting.',
    ],
  },
];

function Section({ section }) {
  const [open, setOpen] = useState(true);

  return (
    <Panel bracketed={section.id === 'problem'}>
      <button
        type="button"
        className="disclosure-toggle"
        style={{ width: '100%', borderBottom: open ? '1px solid var(--line-soft)' : 'none' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="disclosure-caret" style={{ transform: open ? 'rotate(90deg)' : 'none' }} aria-hidden="true">▶</span>
        <span style={{ letterSpacing: '0.14em' }}>{section.title.toUpperCase()}</span>
      </button>

      {open ? (
        <PanelBody className="stack gap-14">
          {section.callout ? (
            <div
              className="verdict-banner"
              style={{ border: '1px solid rgba(34,211,238,0.4)', background: 'linear-gradient(100deg, rgba(34,211,238,0.08), rgba(167,139,250,0.05))' }}
            >
              <pre
                className="mono"
                style={{ fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--text)', margin: 0 }}
              >
                {section.callout}
              </pre>
            </div>
          ) : null}

          {section.body?.map((p, i) => (
            <p key={i} className="dim" style={{ fontSize: 13.3, lineHeight: 1.68 }}>
              {p}
            </p>
          ))}

          {section.code ? (
            <div className="terminal">
              <div className="terminal-head">
                <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-mute)' }}>DETAIL</span>
              </div>
              <div className="terminal-body" style={{ maxHeight: 460 }}>
                <pre className="mono" style={{ fontSize: 11.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-dim)', margin: 0 }}>
                  {section.code.join('\n')}
                </pre>
              </div>
            </div>
          ) : null}

          {section.table ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    {section.table.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text)' }}>{r[0]}</td>
                      <td className="mono" style={{ fontSize: 12, color: r[1]?.startsWith('+') ? 'var(--red)' : r[1]?.startsWith('−') ? 'var(--green)' : 'var(--text-dim)' }}>
                        {r[1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.rows ? (
            <div>
              {section.rows.map(([k, v]) => (
                <KV key={k} label={k} value={v} mono={false} />
              ))}
            </div>
          ) : null}

          {section.notes?.map((p, i) => (
            <p key={`n${i}`} className="dim" style={{ fontSize: 13.3, lineHeight: 1.68 }}>
              {p}
            </p>
          ))}

          {section.items?.map((it, i) => (
            <div className="action-item" key={i}>{it}</div>
          ))}

          {section.steps ? (
            <div className="stack gap-0">
              {section.steps.map(([title, body], i) => (
                <div className="row gap-12" key={i} style={{ alignItems: 'flex-start', padding: '10px 0', borderBottom: i < section.steps.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <span
                    className="mono"
                    style={{
                      width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0,
                      border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.07)',
                      color: 'var(--cyan)', fontSize: 11, fontWeight: 700,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="stack gap-3" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.2, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
                    <span className="dim" style={{ fontSize: 12.7, lineHeight: 1.6 }}>{body}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </PanelBody>
      ) : null}
    </Panel>
  );
}

export default function Docs({ config }) {
  const [health, setHealth] = useState(null);
  const [announcements, setAnnouncements] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.verifiedAnnouncements().then((d) => setAnnouncements(d.count)).catch(() => {});
  }, []);

  return (
    <div className="stack gap-20">
      <div className="page-head">
        <div className="stack gap-6">
          <span className="eyebrow">Project Documentation</span>
          <h1 className="h1" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2rem)' }}>
            TrustShield / CampusShield
          </h1>
          <p className="dim" style={{ fontSize: 13.5, maxWidth: 820 }}>
            Context-aware institutional impersonation detection — problem, architecture, method,
            limitations and demo script, for reviewers who want the reasoning behind the interface.
          </p>
        </div>
        <div className="row gap-10 wrap">
          <Badge tone="warn">DEMO ENVIRONMENT</Badge>
          <Link to="/" className="btn btn-ghost">Landing</Link>
        </div>
      </div>

      <Alert tone="info" title="Prototype demonstration using fictional institutional and student data">
        No real institution, student, mailbox or credential is represented or contacted by this
        application. All data is fictional and generated locally.
      </Alert>

      <Panel>
        <PanelHead title="Build &amp; Runtime Metadata" />
        <PanelBody className="grid grid-2" style={{ gap: '0 24px' }}>
          <div>
            <KV label="Product" value={config?.product?.name ?? 'TrustShield'} />
            <KV label="Deployment" value={config?.product?.deployment ?? 'CampusShield'} />
            <KV label="Institution" value={config?.institution?.name ?? 'Northstar University'} mono={false} />
            <KV label="Risk model" value={config?.riskModel?.name ?? 'CampusShield Prototype Risk Model'} mono={false} />
            <KV label="Model version" value={config?.riskModel?.version ?? '1.2.0-prototype'} />
          </div>
          <div>
            <KV label="API status" value={health?.status ?? 'unknown'} status={health?.status === 'ONLINE' ? 'PASS' : 'UNKNOWN'} />
            <KV label="Demo mode" value={health?.demo ? 'true' : 'false'} />
            <KV label="Announcements" value={announcements === null ? 'loading…' : `${announcements} verified records`} />
            <KV label="External APIs" value="none — no keys required" mono={false} />
            <KV label="Mailbox connection" value="none — paste / .eml only" mono={false} />
          </div>
        </PanelBody>
      </Panel>

      <div className="stack gap-14">
        {SECTIONS.map((s) => (
          <Section key={s.id} section={s} />
        ))}
      </div>

      <div className="row gap-10 wrap">
        <Link to="/student" className="btn btn-primary">Enter Student Dashboard</Link>
        <Link to="/admin" className="btn">Enter Security Dashboard</Link>
        <Link to="/threat-intelligence" className="btn btn-ghost">Threat Intelligence</Link>
      </div>
    </div>
  );
}
