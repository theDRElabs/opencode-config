const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const configRoot = path.resolve(root, '../..');
const agents = ['fresh-reviewer', 'security-reviewer', 'silent-failure-hunter', 'pr-test-analyzer'];
for (const name of agents) {
  const source = fs.readFileSync(path.join(configRoot, 'agent', `${name}.md`), 'utf8');
  for (const denied of ['edit: deny', 'bash: deny']) {
    if (!source.includes(denied)) throw new Error(`${name} missing ${denied}`);
  }
}
const reviewer = fs.readFileSync(path.join(configRoot, 'agent/fresh-reviewer.md'), 'utf8');
for (const allowed of ['security-reviewer: allow', 'silent-failure-hunter: allow', 'pr-test-analyzer: allow']) {
  if (!reviewer.includes(allowed)) throw new Error(`reviewer missing specialist allowlist: ${allowed}`);
}
if (!reviewer.includes('"*": deny') || reviewer.includes('bounded-implementer: allow')) throw new Error('reviewer task boundary is unsafe');
const command = fs.readFileSync(path.join(configRoot, 'commands/review-issue.md'), 'utf8');
if (!command.includes('agent: fresh-reviewer')) throw new Error('review command does not select fresh reviewer');
console.log('read-only reviewer and specialist permission contract passed');
console.log('task allowlist contains only security-reviewer, silent-failure-hunter, pr-test-analyzer');
