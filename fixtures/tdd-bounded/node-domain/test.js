"use strict";
const assert = require("node:assert/strict");
const { labelFor } = require("./src.js");
assert.equal(labelFor(10), "high");
assert.equal(labelFor(9), "low");
