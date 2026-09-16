import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBytes } from '../src/format.js';

test('formats zero bytes', () => {
  assert.strictEqual(formatBytes(0), '0 B');
});

test('formats exactly one kilobyte', () => {
  assert.strictEqual(formatBytes(1024), '1.0 KB');
});

test('formats exactly one megabyte', () => {
  assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
});
