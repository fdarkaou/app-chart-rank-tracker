import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarise, toMarkdown, toCsv, movers } from '../track.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url)));

test('summarises a climbing app', () => {
  const r = summarise(load('rival-a.json'));
  assert.equal(r.latest, 4);
  assert.equal(r.change, 8);           // 12 -> 4 is up 8
  assert.equal(r.changeWindow, 14);    // 2026-10-14 (18) -> 4
  assert.equal(r.best, 4);
  assert.equal(r.worst, 18);
  assert.equal(r.gaps, 1);             // 2026-10-17 missing
});

test('falling app has negative change', () => {
  const r = summarise(load('rival-b.json'));
  assert.equal(r.change, -1);
  assert.equal(r.worst, 56);
});

test('empty history is not charted, never rank 0', () => {
  const r = summarise(load('not-charted.json'));
  assert.equal(r.status, 'not_charted');
  assert.equal(r.latest, undefined);
  assert.match(toMarkdown([r]), /not in chart/);
});

test('movers and csv', () => {
  const rows = ['rival-a.json', 'rival-b.json', 'not-charted.json'].map((f) => summarise(load(f)));
  assert.deepEqual(movers(rows, 5), ['Example Rival A: up 8 to #4 (2026-10-21)']);
  assert.equal(toCsv(rows).split('\n').length, 4);
  assert.ok(toMarkdown(rows).indexOf('Example Rival A') < toMarkdown(rows).indexOf('Example Rival B'));
});
