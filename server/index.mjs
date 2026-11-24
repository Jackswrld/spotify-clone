// Starts the music relay. Settings come from server/.env (see server/.env.example).
import http from 'node:http';
import { createRelay } from './relay.mjs';

try {
  process.loadEnvFile('server/.env');
} catch {
  // No .env yet: charts still work; YouTube playback stays off until a key is added.
}

// RELAY_PORT, not PORT: hosts and dev tools often set PORT for the app itself.
const port = Number(process.env.RELAY_PORT ?? 4400);
const handler = createRelay({
  fetch: globalThis.fetch,
  env: process.env,
  cacheFile: 'server/data/youtube-cache.json',
});

http.createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`relay on :${port} (YouTube key: ${process.env.YOUTUBE_API_KEY ? 'yes' : 'no'})`);
});
