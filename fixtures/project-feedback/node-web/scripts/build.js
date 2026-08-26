"use strict";

const fs = require("node:fs");
const { double } = require("../src/value.js");

if (process.env.INJECT_BUILD_FAILURE === "1") {
  console.error("build failure: injected production bundling error");
  process.exit(1);
}

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/value.txt", `${double(4)}\n`);
console.log("build passed: dist/value.txt");
