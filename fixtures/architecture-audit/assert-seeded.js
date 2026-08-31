const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const expected = JSON.parse(fs.readFileSync(path.join(root, 'seeded/expected-findings.json'), 'utf8'));
const audit = fs.readFileSync(path.join(root, 'seeded/expected-audit.md'), 'utf8');

for (const category of expected.categories) {
  if (!audit.includes(category)) throw new Error(`audit missing category: ${category}`);
  for (const location of expected.evidence[category]) {
    const [file, lineText] = location.split(':');
    const lines = fs.readFileSync(path.join(root, 'seeded', file), 'utf8').split('\n');
    const line = Number(lineText);
    if (!lines[line - 1]?.trim()) throw new Error(`invalid evidence location: ${location}`);
    if (!audit.includes(location)) throw new Error(`audit missing exact evidence: ${location}`);
  }
}

const findings = audit.split('\n').filter((line) => /^- A\d+ \|/.test(line));
if (findings.length !== expected.categories.length) throw new Error(`expected ${expected.categories.length} structured findings, found ${findings.length}`);
for (const [index, line] of findings.entries()) {
  const id = `A${index + 1}`;
  for (const field of [`- ${id} |`, ' | Evidence:', 'Impact:', 'Confidence:', 'Falsifier:']) {
    if (!line.includes(field)) throw new Error(`${id} missing required finding field: ${field}`);
  }
  if (!/\| (critical|high|medium|low) \|/.test(line)) throw new Error(`${id} missing valid severity`);
  if (!line.includes(expected.categories[index])) throw new Error(`${id} missing ordered category ${expected.categories[index]}`);
}

for (const term of ['Deep-Module Recommendation', 'Incremental Migration Slices', 'Human Decisions and Tradeoffs', 'Residual Risks']) {
  if (!audit.includes(term)) throw new Error(`audit missing ${term}`);
}
for (const term of [/small\s+interface/, /test the seam/, /Benefits/, /Costs/, /An alternative/]) {
  if (!term.test(audit)) throw new Error(`deep-module recommendation missing ${term}`);
}
const contracts = fs.readFileSync(path.join(root, 'seeded/src/contracts.js'), 'utf8');
const db = fs.readFileSync(path.join(root, 'seeded/src/db.js'), 'utf8');
if (!contracts.includes('from "./db.js"') || !db.includes('from "./contracts.js"')) throw new Error('seeded dependency-direction cycle is absent');
const createRoute = fs.readFileSync(path.join(root, 'seeded/src/create-route.js'), 'utf8');
const importRoute = fs.readFileSync(path.join(root, 'seeded/src/import-route.js'), 'utf8');
for (const sequence of ['if (!body.title)', 'createTask(body)', 'sendTaskCreated(task, mailer)']) {
  if (!createRoute.includes(sequence) || !importRoute.includes(sequence)) throw new Error(`seeded repeated orchestration is absent: ${sequence}`);
}
const testPath = 'seeded/test/create-route.test.js';
const test = fs.readFileSync(path.join(root, testPath), 'utf8');
if ((test.match(/vi\.fn\(\)/g) ?? []).length < 2 || !test.includes('toHaveBeenCalled') || !test.includes('toBeTruthy')) throw new Error('seeded heavy-mocking/weak-outcome evidence is absent');
for (const location of ['test/create-route.test.js:4', 'test/create-route.test.js:5', 'test/create-route.test.js:7', 'test/create-route.test.js:8', 'test/create-route.test.js:9']) {
  if (!audit.includes(location)) throw new Error(`heavy-mocking finding missing exact evidence: ${location}`);
}
const taskClient = fs.readFileSync(path.join(root, 'seeded/src/task-client.js'), 'utf8');
const taskApi = fs.readFileSync(path.join(root, 'seeded/src/task-api.js'), 'utf8');
if (!taskClient.includes('return http.post') || !taskApi.includes('return saveTask')) throw new Error('seeded shallow pass-through cluster is absent');
console.log('seeded audit detects all eight evidence-backed architecture signals');
