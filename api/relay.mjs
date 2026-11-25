// Vercel Function: every /api/* request is rewritten here (vercel.json) as /api/relay?__path=…,
// because catch-all file names only work for Next.js projects. This puts the original path back
// and hands the request to the music relay (server/relay.mjs). Keys come from the project's
// environment variables (Vercel dashboard), never from git.

import { createHandler } from '../server/create-handler.mjs';

const handle = createHandler({ env: process.env, fetch: globalThis.fetch });

export default function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://relay.local');
  const path = url.searchParams.get('__path');
  if (path !== null) {
    url.searchParams.delete('__path');
    req.url = `/api/${path.replace(/^\/+/, '')}${url.search}`;
  }
  return handle(req, res);
}
