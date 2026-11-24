// Runs the music relay and the Angular dev server together: `npm start`.
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const procs = [
  spawn('node', ['server/index.mjs'], { stdio: 'inherit', shell: isWin }),
  spawn('npx', ['ng', 'serve', '--port', '4300'], { stdio: 'inherit', shell: isWin }),
];

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (!p.killed) p.kill();
  process.exit(code);
}

for (const p of procs) p.on('exit', (code) => stopAll(code ?? 0));
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
