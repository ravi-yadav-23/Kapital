import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

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
});
