import http from 'node:http';
import { createRelay } from '../relay.mjs';

/** Starts a relay on a random port with injected dependencies. */
export async function startRelay(deps) {
  const server = http.createServer(createRelay(deps));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    get: (path, headers = {}) => fetch(base + path, { headers }),
    request: (path, init = {}) => fetch(base + path, init),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** A fake upstream fetch: routes by URL prefix and records calls. */
export function fakeFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    for (const [prefix, respond] of Object.entries(routes)) {
      if (String(url).startsWith(prefix)) {
        const { status = 200, body = {} } = await respond(String(url));
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      }
    }
    return new Response('{}', { status: 404 });
  };
  fn.calls = calls;
  return fn;
}
