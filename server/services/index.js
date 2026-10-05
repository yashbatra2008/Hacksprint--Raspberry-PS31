import { createMockMailSource } from './mailSource.js';
import { createMockAuthenticationService } from './authenticationService.js';
import { createMockUrlReputationService } from './urlReputationService.js';
import { createMockThreatIntelService } from './threatIntelService.js';
import { createMockAnnouncementSource } from './announcementSource.js';
import { createMockNlpService } from './nlpService.js';

export function createServices(overrides = {}) {
  return {

    mailSource: overrides.mailSource ?? createMockMailSource(),

    authentication: overrides.authentication ?? createMockAuthenticationService(),

    urlReputation: overrides.urlReputation ?? createMockUrlReputationService(),

    threatIntel: overrides.threatIntel ?? createMockThreatIntelService(),

    announcementSource: overrides.announcementSource ?? createMockAnnouncementSource(),

    nlp: overrides.nlp ?? createMockNlpService(),
  };
}

export const SERVICE_STATUS = [
  { id: 'mailSource', name: 'Mail Ingestion (Graph)', mode: 'mock', note: 'Paste / .eml only — no mailbox connection' },
  { id: 'authentication', name: 'Email Authentication', mode: 'simulated', note: 'SPF/DKIM/DMARC values are simulated' },
  { id: 'urlReputation', name: 'URL Reputation', mode: 'simulated', note: 'Links are never opened by the prototype' },
  { id: 'threatIntel', name: 'Threat Intelligence', mode: 'mock', note: 'Fictional local dataset' },
  { id: 'announcementSource', name: 'Announcement Source', mode: 'local', note: 'Reads the verified announcement database' },
  { id: 'nlp', name: 'Context Analysis Engine', mode: 'rule-based', note: 'Deterministic rules — no external AI model' },
];
