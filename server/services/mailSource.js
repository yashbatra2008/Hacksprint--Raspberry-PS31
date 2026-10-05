export function parseEml(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  const splitAt = text.indexOf('\n\n');
  const headerBlock = splitAt === -1 ? text : text.slice(0, splitAt);
  let body = splitAt === -1 ? '' : text.slice(splitAt + 2);

  const unfolded = headerBlock.replace(/\n[ \t]+/g, ' ');
  const headers = {};
  for (const line of unfolded.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    headers[key] = line.slice(idx + 1).trim();
  }

  if (/multipart/i.test(headers['content-type'] ?? '')) {
    const parts = body.split(/--[^\n]*/);
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
    if (plain) {
      body = plain.slice(plain.indexOf('\n\n') + 2 || 0);
    }
  }
  body = body
    .replace(/=3D/g, '=')
    .replace(/=\n/g, '')
    .trim();

  const linkMatches = [...`${body} ${text}`.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)].map((m) => m[0]);
  const fromMatch = (headers.from ?? '').match(/<([^>]+)>/);

  return {
    from: fromMatch ? fromMatch[1] : (headers.from ?? '').trim(),
    fromDisplay: headers.from ?? '',
    to: (headers.to ?? '').match(/<([^>]+)>/)?.[1] ?? (headers.to ?? '').trim(),
    subject: headers.subject ?? '',
    body,
    links: [...new Set(linkMatches)],
    headers,
    source: 'eml',
  };
}

export function createMockMailSource() {
  return {
    id: 'mailSource',
    mode: 'mock',
    label: 'Mail ingestion (mock)',
    description:
      'Accepts pasted email text or a locally parsed .eml file. No mailbox connection is made.',

    async ingest(input) {
      return {
        from: (input.from ?? '').trim(),
        to: (input.to ?? '').trim(),
        subject: (input.subject ?? '').trim(),
        body: (input.body ?? '').trim(),
        links: (input.links ?? []).filter(Boolean),
        source: input.source ?? 'paste',
      };
    },
  };
}
