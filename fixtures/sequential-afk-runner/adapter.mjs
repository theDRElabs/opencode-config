#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const [stage, issueFile, implementation] = args;
const output = stage === "implement" ? implementation : stage === "check" ? args[3] : args[4];
const attempt = Number(stage === "implement" ? args[3] : stage === "check" ? args[4] : args[5]);
const issue = fs.readFileSync(issueFile, "utf8");
const id = issue.match(/^(ISSUE-\d+):/m)[1];
const scenario = issue.match(/^CONSTRAINTS:\s*SCENARIO=(\S+)/m)?.[1] || "success";
const markerDir = process.env.INTERRUPT_MARKERS;

if (stage === "implement") {
  fs.writeFileSync(implementation, `# Implementation Result\nISSUE: ${id}\nATTEMPT: ${attempt}\nCONTEXT: fresh-process-${process.pid}\nFILES: fixture-output\nRED: exit 1 behavior gap\nGREEN: exit 0\nREFACTOR: exit 0\nHUMAN_ACCEPTANCE: false\n`);
  process.exit(0);
}

if (stage === "check") {
  if (scenario === "interrupt") {
    const marker = path.join(markerDir, `${id}.marker`);
    if (!fs.existsSync(marker)) { fs.mkdirSync(markerDir, { recursive: true }); fs.writeFileSync(marker, "interrupted\n"); process.exit(75); }
  }
  const pass = scenario !== "failed-tests" || attempt >= 2;
  fs.writeFileSync(output, `${JSON.stringify({ checks: [{ name: "test", command: "fixture test", cwd: process.cwd(), environment: "fixture", duration_ms: 1, exit_code: pass ? 0 : 1, result: pass ? "PASS" : "FAIL", evidence: path.join(process.cwd(), "check.log") }], allPassed: pass }, null, 2)}\n`);
  process.exit(pass ? 0 : 1);
}

if (stage === "review") {
  const pass = scenario !== "review-finding" || attempt >= 2;
  fs.writeFileSync(output, `VERDICT: ${pass ? "PASS" : "FAIL"}\nBLOCKING_FINDINGS: ${pass ? "None" : "HIGH fixture.js:1 seeded review defect requires correction"}\nNON_BLOCKING_FINDINGS: None\nACCEPTANCE_COVERAGE: covered\nVERIFICATION_EVIDENCE: complete\nRESIDUAL_RISKS: Human acceptance remains required\nREVIEW_CONTEXT: fresh-process-${process.pid}\n`);
  process.exit(pass ? 0 : 1);
}

process.stderr.write(`unknown adapter stage ${stage}\n`);
process.exit(2);
