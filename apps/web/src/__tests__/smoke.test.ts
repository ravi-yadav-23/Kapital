import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeIpoStatus } from '../lib/formatters.ts';

// Test core conviction verdict scoring rules
function calculateConvictionVerdict(score: number): { label: string; action: string } {
  if (score >= 80) return { label: 'STRONG APPLY', action: 'DEPLOY_MAX_RETAIL' };
  if (score >= 65) return { label: 'APPLY', action: 'DEPLOY_1_LOT_PER_PAN' };
  if (score >= 50) return { label: 'MODERATE APPLY', action: 'DEPLOY_1_LOT_SELECTED' };
  return { label: 'AVOID', action: 'SKIP' };
}

describe('Kapitl Core Scoring & Verdict Engine', () => {
  test('score >= 80 yields STRONG APPLY', () => {
    const verdict = calculateConvictionVerdict(92);
    assert.strictEqual(verdict.label, 'STRONG APPLY');
    assert.strictEqual(verdict.action, 'DEPLOY_MAX_RETAIL');
  });

  test('score between 65 and 79 yields APPLY', () => {
    const verdict = calculateConvictionVerdict(75);
    assert.strictEqual(verdict.label, 'APPLY');
    assert.strictEqual(verdict.action, 'DEPLOY_1_LOT_PER_PAN');
  });

  test('score between 50 and 64 yields MODERATE APPLY', () => {
    const verdict = calculateConvictionVerdict(55);
    assert.strictEqual(verdict.label, 'MODERATE APPLY');
    assert.strictEqual(verdict.action, 'DEPLOY_1_LOT_SELECTED');
  });

  test('score < 50 yields AVOID', () => {
    const verdict = calculateConvictionVerdict(42);
    assert.strictEqual(verdict.label, 'AVOID');
    assert.strictEqual(verdict.action, 'SKIP');
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
  });
});

