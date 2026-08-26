"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { double } = require("../src/value.js");

test("double returns twice the input", () => {
  assert.equal(double(3), 6);
});
