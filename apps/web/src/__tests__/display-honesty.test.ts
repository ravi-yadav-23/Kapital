import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatGmp, biddingWindowText, getScoreBarColor, getScoreRecommendation, isListedUnsold } from '../lib/formatters.ts';
import { componentRows, factRows, basisLabel } from '../lib/analysis-view.ts';

describe('display never invents numbers', () => {
  test('no grey-market quote shows a dash, not 0.0%', () => {
    assert.equal(formatGmp(null).text, '—');
    assert.equal(formatGmp(undefined).text, '—');
    assert.equal(formatGmp(0).text, '—');
    assert.equal(formatGmp(8.16).text, '↑ +8.2%');
    assert.equal(formatGmp(-3).text, '↓ -3.0%');
  });

  test('unknown dates say TBA instead of a bare dash', () => {
    assert.equal(biddingWindowText('upcoming', null, null), 'Dates TBA');
    assert.match(biddingWindowText('upcoming', '2099-01-02', null), /^Opens /);
    assert.match(biddingWindowText('open', '2026-01-01', '2099-01-03'), /^Closes /);
  });

  test('score bar colour follows the verdict bands (80 / 62 / 45)', () => {
    for (const [score, rec] of [[90, 'STRONG_APPLY'], [70, 'MODERATE_APPLY'], [60, 'WATCH'], [30, 'AVOID']] as const) {
      assert.equal(getScoreRecommendation(score), rec);
    }
    assert.notEqual(getScoreBarColor(61), getScoreBarColor(62), 'Watch and Moderate apply must look different');
    assert.equal(getScoreBarColor(45), getScoreBarColor(61));
    assert.notEqual(getScoreBarColor(44), getScoreBarColor(45));
    assert.notEqual(getScoreBarColor(79), getScoreBarColor(80));
  });

  test('score components list only the inputs the engine used, with whole-percent weights', () => {
    const rows = componentRows({ demand: { value: 44, weight: 0.6 }, gmp: { value: 59, weight: 0.4 } });
    assert.deepEqual(rows.map((r) => [r.key, r.value, r.weightPct]), [['demand', 44, 60], ['gmp', 59, 40]]);
    assert.deepEqual(componentRows(null), []);
  });

  test('company facts list only what was found', () => {
    const rows = factRows({ net_profit_cr: 333.5, debt_to_equity: 3.224, is_lender: true });
    assert.deepEqual(rows, [
      { label: 'Net profit', value: '₹334 cr' },
      { label: 'Debt-to-equity', value: '3.22' },
      { label: 'Lender (bank / NBFC / housing finance)', value: 'Yes' },
    ]);
    assert.deepEqual(factRows({}), []);
    assert.equal(basisLabel({ state: 'market_only' }), 'Market data only');
  });

  test('a holding past its listing date is "listed, sale not recorded", not "awaiting listing"', () => {
    const today = new Date('2026-11-16T10:00:00');
    assert.equal(isListedUnsold({ status: 'ACTIVE', listing_date: '2026-09-11' }, today), true);
    assert.equal(isListedUnsold({ status: 'ACTIVE', listing_date: '2026-11-16' }, today), false);
    assert.equal(isListedUnsold({ status: 'ACTIVE', listing_date: '2026-11-17' }, today), false);
    assert.equal(isListedUnsold({ status: 'SOLD', listing_date: '2026-09-11' }, today), false);
    assert.equal(isListedUnsold({ status: 'ACTIVE', listing_date: null }, today), false);
  });
});
