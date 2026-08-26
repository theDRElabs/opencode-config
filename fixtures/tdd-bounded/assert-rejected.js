"use strict";

const fs = require("node:fs");
const issue = fs.readFileSync(process.argv[2], "utf8");
const implementer = fs.readFileSync("/root/.config/opencode/agent/bounded-implementer.md", "utf8");
const normalizedImplementer = implementer.toLowerCase().replace(/\s+/g, " ");
for (const marker of ["TYPE: hitl", "STATUS: blocked", "COMMANDS: UNKNOWN", "human decision"]) {
  if (!issue.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`ambiguity fixture missing rejection marker: ${marker}`);
  }
}
for (const rule of ["reject missing acceptance criteria", "unknown verification commands", "unresolved human decisions", "`hitl`/`blocked` issues"]) {
  if (!normalizedImplementer.includes(rule.toLowerCase())) {
    throw new Error(`bounded implementer missing rejection rule: ${rule}`);
  }
}
console.log("bounded implementer entry gate rejects ambiguous issue before implementation");
