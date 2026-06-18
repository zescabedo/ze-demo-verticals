import type { NextApiRequest, NextApiResponse } from 'next';
import { RobotsMiddleware } from '@sitecore-content-sdk/nextjs/middleware';
import scClient from 'lib/sitecore-client';
import sites from '.sitecore/sites.json';

const SCRUNCH_CRAWLER_RULES = `User-agent: Scrunchbot
Allow: /

User-agent: ScrunchAI-testbot
Allow: /`;

const baseHandler = new RobotsMiddleware(scClient, sites).getHandler();

/**
 * API route for serving robots.txt
 *
 * This Next.js API route generates and returns the robots.txt content dynamically
 * based on the resolved site name. It is commonly
 * used by search engine crawlers to determine crawl and indexing rules.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const originalSend = res.send.bind(res);

  res.send = (body) => {
    if (typeof body === 'string' && (res.statusCode === 200 || res.statusCode === 404)) {
      body = `${body.trimEnd()}\n\n${SCRUNCH_CRAWLER_RULES}`;
    }
    return originalSend(body);
  };

  return baseHandler(req, res);
}
