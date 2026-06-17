import type { NextApiRequest, NextApiResponse } from 'next';

const AXP_BASE_URL = 'https://spe-01ktydk1tmf2e223qht45dzrkv.agentxp.net';
const FORWARDED_HOST = 'www.formalux.org';

const FORWARD_HEADERS = [
  'x-axp-version',
  'x-bot-id',
  'x-bot-type',
  'x-error-code',
  'x-debug',
] as const;

const normalizePath = (rawPath: string): string => {
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return withLeadingSlash.toLowerCase();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const rawPath = req.query.path;
  if (!rawPath || Array.isArray(rawPath)) {
    res.status(400).json({ error: 'missing_path' });
    return;
  }

  const lowercasedPath = normalizePath(rawPath);

  try {
    const axpResponse = await fetch(`${AXP_BASE_URL}${lowercasedPath}`, {
      headers: {
        'User-Agent': 'ChatGPT-User',
        'X-Forwarded-Host': FORWARDED_HOST,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    const errorCode = axpResponse.headers.get('x-error-code');

    if (!axpResponse.ok || errorCode === 'CONTENT_NOT_FOUND') {
      res.status(404).json({
        error: 'no_optimized_content',
        path: lowercasedPath,
      });
      return;
    }

    const html = await axpResponse.text();

    for (const header of FORWARD_HEADERS) {
      const value = axpResponse.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('[axp-preview] AXP fetch failed:', error);
    res.status(502).json({
      error: 'axp_fetch_failed',
      path: lowercasedPath,
    });
  }
}
