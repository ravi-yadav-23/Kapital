import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { badgeStyle, requestMessage, auditErrorMessage, orderSignals, confidenceNote, basisNote } from '../lib/analysis-view.ts';

describe('listing-gain analysis view helpers (M9)', () => {
  test('badge is a small Apply / Watch / Avoid label, and absent when there is no verdict', () => {
    assert.equal(badgeStyle('APPLY')?.label, 'Apply');
    assert.equal(badgeStyle('WATCH')?.label, 'Watch');
    assert.equal(badgeStyle('AVOID')?.label, 'Avoid');
    assert.equal(badgeStyle(null), null);
    assert.equal(badgeStyle(undefined), null);
  });

  test('every request state has a plain-language message', () => {
    for (const s of ['cached', 'queued', 'already_queued'] as const) {
      assert.ok(requestMessage(s).length > 10, s);
    }
    assert.match(requestMessage('queued'), /tonight|nightly|02:00/i);
    assert.match(requestMessage('cached'), /already|latest/i);
  });

  test('the daily-limit error is explained, other errors fall back to the server detail', () => {
    assert.match(auditErrorMessage(429), /limit/i);
    assert.equal(auditErrorMessage(500, 'boom'), 'boom');
    assert.match(auditErrorMessage(503), /unreachable|try again/i);
  });

  test('signals are ordered: risks first, then positives, then neutral', () => {
    const out = orderSignals([
      { code: 'a', direction: 'positive', reason: 'p' },
      { code: 'b', direction: 'neutral', reason: 'n' },
      { code: 'c', direction: 'negative', reason: 'x' },
    ]);
    assert.deepEqual(out.map((s) => s.code), ['c', 'a', 'b']);
  });

  test('a market-only score says its basis; an analysed or missing score needs no caveat', () => {
    assert.match(basisNote({ state: 'market_only', score: 55 }) ?? '', /market data only/i);
    assert.match(basisNote({ state: 'summary_only', score: 60 }) ?? '', /summary/i);
    assert.match(basisNote({ state: 'summary_only', score: 60 }) ?? '', /capped/i);
    assert.equal(basisNote({ state: 'ready', score: 70 }), null);
    assert.equal(basisNote({ state: 'market_only', score: null }), null);
    assert.equal(basisNote(null), null);
  });

  test('low confidence is called out', () => {
    assert.match(confidenceNote('low') ?? '', /limited|low/i);
    assert.equal(confidenceNote('high'), null);
  });
});
