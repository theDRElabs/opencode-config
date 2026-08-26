const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const required = ['issue.md', 'standards.md', 'diff.patch', 'src/profile.js', 'test/profile.test.js', 'src/unrelated.js', 'verification.log', 'expected-findings.json'];
for (const file of required) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || fs.statSync(target).size === 0) throw new Error(`missing complete input: ${file}`);
}
for (const file of ['issue.md', 'standards.md', 'diff.patch', 'verification.log']) {
  if (!fs.readFileSync(path.join(root, file), 'utf8').includes('\n')) throw new Error(`incomplete artifact: ${file}`);
}
console.log(`complete artifact bundle: ${required.length} inputs`);
