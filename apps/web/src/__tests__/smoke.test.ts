import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeIpoStatus, getScoreRecommendation, formatScore } from '../lib/formatters.ts';

describe('Kapitl Core Scoring & Verdict Engine', () => {
  // Thresholds must match the backend (orchestrator.get_recommendation): 80 / 62 / 45.
  test('score >= 80 is STRONG_APPLY', () => {
    assert.strictEqual(getScoreRecommendation(92), 'STRONG_APPLY');
    assert.strictEqual(getScoreRecommendation(80), 'STRONG_APPLY');
  });

  test('75 is MODERATE_APPLY, as the backend reports it (not STRONG_APPLY)', () => {
    assert.strictEqual(getScoreRecommendation(79), 'MODERATE_APPLY');
    assert.strictEqual(getScoreRecommendation(62), 'MODERATE_APPLY');
  });

  test('45-61 is WATCH', () => {
    assert.strictEqual(getScoreRecommendation(61), 'WATCH');
    assert.strictEqual(getScoreRecommendation(45), 'WATCH');
  });

  test('below 45 is AVOID and a missing score is PENDING', () => {
    assert.strictEqual(getScoreRecommendation(44), 'AVOID');
    assert.strictEqual(getScoreRecommendation(undefined), 'PENDING');
  });

  test('canonical status computation & self-healing for active cross-month IPOs', () => {
    const today = '2026-11-01';

    // Cross-month active IPOs on Groww (e.g. Maxwell Engineering, HGS India, Johnsoncab)
    // Legacy inverted date format self-heals to open on 1 Nov 2026
    assert.strictEqual(computeIpoStatus('2026-11-30', '2026-11-03', today), 'open');
    assert.strictEqual(computeIpoStatus('2026-10-30', '2026-11-03', today), 'open');
    assert.strictEqual(computeIpoStatus('2026-11-29', '2026-11-02', today), 'open');
    assert.strictEqual(computeIpoStatus('2026-10-29', '2026-11-02', today), 'open');

    // Upcoming IPO (e.g. Vedant Poly Fabs opening 2 Nov 2026)
    assert.strictEqual(computeIpoStatus('2026-11-02', '2026-11-04', today), 'upcoming');

    // Closing today
    assert.strictEqual(computeIpoStatus('2026-10-30', '2026-11-01', today), 'closing_today');

    // Closed
    assert.strictEqual(computeIpoStatus('2026-10-27', '2026-10-29', today), 'closed');

    // Corrupted listing date in closeDate with allotment date on or before today (e.g. Antala Industries)
    assert.strictEqual(
      computeIpoStatus('2026-10-29', '2026-11-05', '2026-11-03', null, '2026-11-03'),
      'closed'
    );

    // Backend status marked closed strictly enforced
    assert.strictEqual(
      computeIpoStatus('2026-10-29', '2026-11-05', '2026-11-03', 'closed', '2026-11-03'),
      'closed'
    );
  });
});

describe('score display (M1): never invent a number', () => {
  test('missing score is shown as "No score yet"', () => {
    assert.strictEqual(formatScore(null), 'No score yet');
    assert.strictEqual(formatScore(undefined), 'No score yet');
  });

  test('a real score, including 0, is shown as is', () => {
    assert.strictEqual(formatScore(56), '56');
    assert.strictEqual(formatScore(0), '0');
  });
});
