// Runs the music relay and the Angular dev server together: `npm start`.
// If either stops, both stop (no half-running setup).
import { spawn, spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';
const procs = [
  spawn('node', ['server/index.mjs'], { stdio: 'inherit', shell: isWin }),
  spawn('npx', ['ng', 'serve', '--port', '4300'], { stdio: 'inherit', shell: isWin }),
];

/** On Windows the child is a cmd.exe wrapper; kill its whole tree or `ng serve` is orphaned. */
function killTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) killTree(p);
  process.exit(code);
}

for (const p of procs) p.on('exit', (code) => stopAll(code ?? 0));
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
