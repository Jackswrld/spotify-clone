// Vercel Function: every /api/* request goes to the music relay (server/relay.mjs).
// Keys come from the project's environment variables (Vercel dashboard), never from git.

import { createHandler } from '../server/create-handler.mjs';

const handle = createHandler({ env: process.env, fetch: globalThis.fetch });

export default function handler(req, res) {
  return handle(req, res);
}
