import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDb, DB_PATH } from './db.js';
import api from './api.js';

import './seedDemo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

function envPort(name, fallback) {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

const PORT = envPort('PORT', 5174);
const HOST = process.env.HOST?.trim() || '127.0.0.1';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",

      "script-src 'self'",
      "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
});

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const ms = Date.now() - started;

      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ${String(res.statusCode).padEnd(3)} ${req.method.padEnd(6)} ${req.originalUrl} ${ms}ms`,
      );
    }
  });
  next();
});

app.use('/api', api);

app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Unknown API endpoint.' });
});

if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
  app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send(
        [
          'CampusShield API is running.',
          '',
          'The UI bundle has not been built yet. Start the dev server with:',
          '  npm run dev',
          '',
          'or build the production bundle with:',
          '  npm run build && npm start',
          '',
          'API health: /api/health',
        ].join('\n'),
      );
  });
}

app.use((err, _req, res, _next) => {

  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'Internal prototype error.', detail: String(err?.message ?? err) });
});

initDb();

const server = app.listen(PORT, HOST, () => {

  console.log(
    [
      '',
      '  \u001b[36m╔══════════════════════════════════════════════════════╗\u001b[0m',
      '  \u001b[36m║\u001b[0m  \u001b[1mCAMPUSSHIELD\u001b[0m — SECURITY OPERATIONS API          \u001b[36m║\u001b[0m',
      '  \u001b[36m╚══════════════════════════════════════════════════════╝\u001b[0m',
      `  \u001b[32m●\u001b[0m API      http://${HOST}:${PORT}/api/health`,
      `  \u001b[32m●\u001b[0m DATABASE ${DB_PATH}`,
      `  \u001b[33m●\u001b[0m MODE     DEMO — fictional institutional and student data`,
      '',
    ].join('\n'),
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
