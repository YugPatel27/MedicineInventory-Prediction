// Dev launcher: starts the API first, waits until it answers, then starts Vite.
// - picks a free API port (so a leftover/blocked port never breaks the proxy)
// - Vite never starts before the API is ready -> no startup ECONNREFUSED/502
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preferredPort = Number(process.env.PORT) || 5002;

const isFree = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port);
  });

const findFreePort = async (start) => {
  for (let port = start; port < start + 20; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error(`No free port found in ${start}-${start + 19}`);
};

const waitForApi = async (port, timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};

const children = [];
const stopAll = () => children.forEach((c) => { try { c.kill(); } catch { /* ignore */ } });
process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });
process.on('exit', stopAll);

const apiPort = await findFreePort(preferredPort);
if (apiPort !== preferredPort) {
  console.log(`[dev] Port ${preferredPort} is busy/blocked, using ${apiPort} for the API instead.`);
}
const env = { ...process.env, PORT: String(apiPort), API_PORT: String(apiPort) };

const api = spawn(
  process.execPath,
  [
    '--no-deprecation',
    path.join(root, 'node_modules/nodemon/bin/nodemon.js'),
    '--watch', 'server',
    '--exec', 'node --no-deprecation',
    'server/index.js',
  ],
  { cwd: root, env, stdio: 'inherit' }
);
children.push(api);

console.log(`[dev] Waiting for API on port ${apiPort}...`);
const ready = await waitForApi(apiPort);
console.log(ready
  ? '[dev] API is ready. Starting Vite...'
  : '[dev] API did not answer within 60s (check the errors above). Starting Vite anyway...');

const web = spawn(
  process.execPath,
  ['--no-deprecation', path.join(root, 'node_modules/vite/bin/vite.js')],
  { cwd: root, env, stdio: 'inherit' }
);
children.push(web);

web.on('exit', (code) => { stopAll(); process.exit(code ?? 0); });
