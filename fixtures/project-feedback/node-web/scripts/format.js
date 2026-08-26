"use strict";

const fs = require("node:fs");
const paths = ["package.json", "src/value.js", "test/value.test.js"];

for (const path of paths) {
  const content = fs.readFileSync(path, "utf8");
  if (!content.endsWith("\n") || /[ \t]+$/m.test(content)) {
    console.error(`format failure: ${path}`);
    process.exit(1);
  }
}

console.log("format passed");
