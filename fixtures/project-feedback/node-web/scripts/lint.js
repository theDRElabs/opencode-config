"use strict";

const fs = require("node:fs");
const source = fs.readFileSync("src/value.js", "utf8");

if (/\bvar\b/.test(source)) {
  console.error("lint failure: var is forbidden");
  process.exit(1);
}

console.log("lint passed");
