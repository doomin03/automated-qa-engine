import { spawnSync } from 'node:child_process';
const required = process.argv.includes('--require-runtime');
let missing = false;
for (const name of ['git', 'node', 'dart', 'flutter']) {
  // Only fixed tool names above reach cmd; no user-provided command text.
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : name;
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', name + ' --version'] : ['--version'];
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, timeout: 10000, windowsHide: true });
  const ok = !result.error && result.status === 0;
  console.log(name + ': ' + (ok ? (result.stdout || result.stderr).trim().split(/\r?\n/)[0] : 'NOT AVAILABLE ON PATH'));
  if (!ok && name !== 'flutter' && (required || name === 'git' || name === 'node')) missing = true;
}
console.log(required ? 'Engine prerequisite check only; Flutter is not required; no application was executed.' : 'P0 tool check only; Dart is the proposed core runtime; Flutter is optional.');
process.exitCode = missing ? 1 : 0;

