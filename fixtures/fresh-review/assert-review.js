const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const source = fs.readFileSync(path.join(root, 'src/profile.js'), 'utf8');
const test = fs.readFileSync(path.join(root, 'test/profile.test.js'), 'utf8');
const unrelated = fs.readFileSync(path.join(root, 'src/unrelated.js'), 'utf8');
const verification = fs.readFileSync(path.join(root, 'verification.log'), 'utf8');
const expected = JSON.parse(fs.readFileSync(path.join(root, 'expected-findings.json'), 'utf8'));
const findings = [];
if (!/request\.userId/.test(source) || !/profile\.userId/.test(source)) findings.push({ id: 'F1', severity: 'critical', path: 'src/profile.js', line: 3, kind: 'authorization' });
if (/catch \(error\)/.test(source) && /status: 200/.test(source)) findings.push({ id: 'F2', severity: 'high', path: 'src/profile.js', line: 6, kind: 'swallowed-error' });
if (/assert\.ok\(response\)/.test(test)) findings.push({ id: 'F3', severity: 'high', path: 'test/profile.test.js', line: 3, kind: 'weak-test' });
if (!/request\.body\.displayName/.test(source)) findings.push({ id: 'F4', severity: 'high', path: 'src/profile.js', line: 3, kind: 'behavioral-gap' });
if (unrelated.trim()) findings.push({ id: 'F5', severity: 'medium', path: 'src/unrelated.js', line: 1, kind: 'unrelated-change' });
if (/Only the happy-path test ran/.test(verification)) findings.push({ id: 'F6', severity: 'medium', path: 'verification.log', line: 8, kind: 'uncovered-regression' });

const order = { critical: 0, high: 1, medium: 2, low: 3 };
if (findings.some((f, i) => i && order[f.severity] < order[findings[i - 1].severity])) throw new Error('findings are not severity ordered');

const key = (f) => `${f.path}\u0000${f.kind}`;
const detected = new Set(findings.map(key));
const wanted = expected.findings;
const matched = wanted.filter((f) => detected.has(key(f)));
const missing = wanted.filter((f) => !detected.has(key(f)));
const spurious = findings.filter((f) => !wanted.some((w) => key(w) === key(f)));
const recall = wanted.length ? matched.length / wanted.length : 1;
const precision = findings.length ? matched.length / findings.length : 1;
const score = Number(recall.toFixed(4));

const result = `# Verdict\nFAIL: unresolved blocking findings violate all four acceptance criteria (expected-finding recall ${matched.length}/${wanted.length}).\n\n# Blocking Findings\n${findings.filter(f => ['critical', 'high'].includes(f.severity)).map(f => `- ${f.id} ${f.severity} ${f.path}:${f.line} ${f.kind}; impact: acceptance failure; evidence: seeded artifact; required change: correct and test this behavior.`).join('\n')}\n\n# Non-Blocking Findings\n${findings.filter(f => ['medium', 'low'].includes(f.severity)).map(f => `- ${f.id} ${f.severity} ${f.path}:${f.line} ${f.kind}; impact: scope or regression risk; evidence: seeded artifact; required change: remove or cover this change.`).join('\n')}\n\n# Required Changes\n- Resolve every expected finding (recall ${matched.length}/${wanted.length}).\n\n# Acceptance-Criteria Coverage\n- AC1 uncovered: no ownership authorization.\n- AC2 uncovered: no 401/403 behavior.\n- AC3 uncovered: errors return success.\n- AC4 partial: only a weak happy-path assertion exists.\n\n# Verification-Evidence Assessment\nThe reported test pass is misleading because auth, authorization, and failure paths were not exercised.\n\n# Residual Risks\nHuman acceptance and full-project regression checks remain outstanding.\n`;
const output = process.env.REVIEW_RESULT_OUT || '/tmp/opencode/p7-validation/review-result.md';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, result);

if (process.env.SCORE_FILE) {
  fs.writeFileSync(process.env.SCORE_FILE, JSON.stringify({
    score,
    recall: Number(recall.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    matched: matched.length,
    expected: wanted.length,
    detected: findings.length,
    missing: missing.map((f) => `${f.id}:${f.path}:${f.kind}`),
    spurious: spurious.map((f) => `${f.id}:${f.path}:${f.kind}`)
  }) + '\n');
}

console.log(`review_result=${output}`);
console.log(`recall=${recall.toFixed(4)} precision=${precision.toFixed(4)} matched=${matched.length}/${wanted.length} detected=${findings.length} score=${score}`);
if (missing.length) console.log(`missing=${missing.map((f) => f.id).join(',')}`);
if (spurious.length) console.log(`spurious=${spurious.map((f) => f.id).join(',')}`);