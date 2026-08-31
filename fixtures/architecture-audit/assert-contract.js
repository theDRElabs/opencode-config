const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const configRoot = path.resolve(root, '../..');
const skill = fs.readFileSync(path.join(configRoot, 'skills/architecture-audit/SKILL.md'), 'utf8');
const agent = fs.readFileSync(path.join(configRoot, 'agent/architecture-auditor.md'), 'utf8');
const command = fs.readFileSync(path.join(configRoot, 'commands/architecture-audit.md'), 'utf8');
for (const term of ['high coupling', 'shallow-module cluster', 'excessive public surface', 'repeated orchestration', 'heavy mocking', 'missing integration seam', 'untested logic', 'dependency-direction problem', 'falsifier', 'Deep-Module Recommendation', 'Incremental Migration Slices', 'Human Decisions and Tradeoffs']) {
  if (!skill.includes(term)) throw new Error(`skill missing ${term}`);
}
for (const boundary of ['edit: deny', 'bash: deny', 'task: deny', 'webfetch: deny', 'websearch: deny']) {
  if (!agent.includes(boundary)) throw new Error(`agent missing ${boundary}`);
}
if (!command.includes('agent: architecture-auditor')) throw new Error('command is not bound to architecture-auditor');
if (!skill.includes('at most 25') || !/15\s+tool calls/.test(skill) || !skill.includes('8 findings')) throw new Error('audit budgets are incomplete');
console.log('pull-based skill, bounded command, and read-only agent contract passed');
