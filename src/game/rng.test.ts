import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, deriveSeed, shuffled } from './rng';

test('same seed yields the same sequence', () => {
  const a = createRng(123);
  const b = createRng(123);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test('values stay in range and look uniform', () => {
  const r = createRng(9);
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
    sum += v;
  }
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
});

test('gaussian has roughly zero mean and unit spread', () => {
  const r = createRng(5);
  let sum = 0;
  let sq = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const g = r.gaussian();
    sum += g;
    sq += g * g;
  }
  assert.ok(Math.abs(sum / n) < 0.05);
  assert.ok(Math.abs(sq / n - 1) < 0.08);
});

test('derived seeds differ by part and are stable', () => {
  assert.equal(deriveSeed(1, 'bot-1', 0), deriveSeed(1, 'bot-1', 0));
  assert.notEqual(deriveSeed(1, 'bot-1', 0), deriveSeed(1, 'bot-2', 0));
  assert.notEqual(deriveSeed(1, 'bot-1', 0), deriveSeed(1, 'bot-1', 1));
});

test('shuffle is deterministic and keeps all items', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = shuffled(items, createRng(3));
  assert.deepEqual(a, shuffled(items, createRng(3)));
  assert.deepEqual([...a].sort(), items);
});
