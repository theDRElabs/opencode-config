import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBytes } from '../src/format.js';

test('formats bytes', () => {
  assert.strictEqual(formatBytes(512), '512 B');
});

test('formats kilobytes', () => {
  assert.strictEqual(formatBytes(2048), '2.0 KB');
});

test('formats megabytes', () => {
  assert.strictEqual(formatBytes(5 * 1024 * 1024), '5.0 MB');
});
