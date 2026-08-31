const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = process.argv[2];
const audit = fs.readFileSync(path.join(root, 'taskflow-audit.md'), 'utf8');
const project = '/root/projects/taskflow';
const expectedHead = '77cfda60e32bfdc1a5475ce604550c6122d62dc7';
const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }).trim();
const status = execFileSync('git', ['status', '--porcelain'], { cwd: project, encoding: 'utf8' });
if (actualHead !== expectedHead) throw new Error(`Taskflow HEAD changed: ${actualHead}`);
if (status !== '') throw new Error(`Taskflow worktree is not clean:\n${status}`);
const baseline = fs.readFileSync(path.join(root, 'taskflow-baseline.sha256'), 'utf8').trim().split('\n');
for (const entry of baseline) {
  const [expected, ...fileParts] = entry.split(/\s+/);
  const file = fileParts.join(' ');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(project, file))).digest('hex');
  if (actual !== expected) throw new Error(`Taskflow changed from baseline: ${file}`);
}
if (baseline.length !== 10) throw new Error('Taskflow baseline must cover all ten cited files');
const requiredEvidence = [
  'src/lib/db.ts:3', 'src/lib/db.ts:13', 'src/lib/db.ts:53',
  'src/lib/db.test.ts:13', 'src/app/api/tasks/route.ts:2',
  'src/app/api/tasks/[id]/route.ts:13', 'src/app/api/tasks/[id]/route.ts:26',
  'src/app/api/tasks/[id]/route.ts:52', 'src/app/api/tasks/[id]/route.ts:15',
  'src/app/api/tasks/[id]/route.ts:28', 'src/app/api/tasks/[id]/route.ts:54', 'src/app/page.tsx:5',
  'src/app/page.tsx:39', 'src/app/page.tsx:52', 'vitest.config.ts:7'
];
for (const location of requiredEvidence) {
  const split = location.lastIndexOf(':');
  const file = location.slice(0, split);
  const line = Number(location.slice(split + 1));
  const lines = fs.readFileSync(path.join(project, file), 'utf8').split('\n');
  if (!lines[line - 1]?.trim()) throw new Error(`invalid real-project evidence: ${location}`);
  if (!audit.includes(location)) throw new Error(`real audit missing evidence: ${location}`);
}
for (const term of ['not found', 'Deep-Module Recommendation', 'Slice 1', 'Human Decisions and Tradeoffs', 'never modifies Taskflow']) {
  if (!audit.includes(term)) throw new Error(`real audit missing ${term}`);
}
console.log(`Taskflow is clean at audited git HEAD ${actualHead}`);
console.log('existing Taskflow audit has live exact-line evidence and a bounded migration proposal');
