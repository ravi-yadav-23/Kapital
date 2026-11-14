import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mockAllowed, ipoMockAllowed, listOrMock, requireMutationOk } from '../lib/data-policy.ts';

describe('IPO data is always real for guests', () => {
  test('sample IPOs only in an explicit mock build, never for a guest session', () => {
    assert.equal(ipoMockAllowed({ useMockEnv: false }), false);
    assert.equal(ipoMockAllowed({ useMockEnv: true }), true);
    // personal data stays sample for guests (labelled), IPO data does not
    assert.equal(mockAllowed({ useMockEnv: false, isGuest: true }), true);
  });
});

describe('mock data policy (F16): real sessions never see mock data', () => {
  test('mock allowed only for guests or an explicit env flag', () => {
    assert.equal(mockAllowed({ useMockEnv: false, isGuest: false }), false);
    assert.equal(mockAllowed({ useMockEnv: true, isGuest: false }), true);
    assert.equal(mockAllowed({ useMockEnv: false, isGuest: true }), true);
  });

  test('real session with an empty list stays empty', () => {
    assert.deepEqual(listOrMock([], ['MOCK'], false), []);
  });

  test('real session whose request failed (null) gets an empty list, not mock', () => {
    assert.deepEqual(listOrMock(null, ['MOCK'], false), []);
  });

  test('real data is returned as-is for real sessions', () => {
    assert.deepEqual(listOrMock(['A', 'B'], ['MOCK'], false), ['A', 'B']);
  });

  test('guest sessions may fall back to mock when real data is empty or missing', () => {
    assert.deepEqual(listOrMock([], ['MOCK'], true), ['MOCK']);
    assert.deepEqual(listOrMock(null, ['MOCK'], true), ['MOCK']);
    assert.deepEqual(listOrMock(['A'], ['MOCK'], true), ['A']);
  });
});

describe('mutation results (F17): a failed save must not look successful', () => {
  test('503 / network failure throws', () => {
    assert.throws(() => requireMutationOk({ ok: false, status: 503 }), /unreachable|failed/i);
  });

  test('4xx with detail throws that detail', () => {
    assert.throws(() => requireMutationOk({ ok: false, status: 422 }, 'Bad value'), /Bad value/);
  });

  test('ok passes through', () => {
    assert.doesNotThrow(() => requireMutationOk({ ok: true, status: 200 }));
  });
});
