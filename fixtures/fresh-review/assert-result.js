const fs = require('node:fs');
const result = fs.readFileSync(process.argv[2], 'utf8');
const sections = ['# Verdict', '# Blocking Findings', '# Non-Blocking Findings', '# Required Changes', '# Acceptance-Criteria Coverage', '# Verification-Evidence Assessment', '# Residual Risks'];
for (const section of sections) if (!result.includes(section)) throw new Error(`missing result section: ${section}`);
for (const evidence of ['src/profile.js:3', 'src/profile.js:6', 'test/profile.test.js:3', 'src/unrelated.js:1', 'verification.log:8']) {
  if (!result.includes(evidence)) throw new Error(`missing precise evidence: ${evidence}`);
}
if (!result.includes('FAIL:')) throw new Error('blocking findings did not produce FAIL verdict');
console.log('complete review result contract passed with precise evidence');
