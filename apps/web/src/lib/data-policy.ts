// Pure helpers deciding when sample ("mock") data may be shown, and how failed writes surface.
// Kept dependency-free so it can be unit tested with `node --test`.

/** Mock data is for guest sessions or an explicit NEXT_PUBLIC_USE_MOCK build only - never real sessions. */
export function mockAllowed(opts: { useMockEnv: boolean; isGuest: boolean }): boolean {
  return opts.useMockEnv || opts.isGuest
}

/**
 * IPO and report data is public market data, so guests see the real thing. Sample IPOs exist only for an explicit
 * mock build (development without an API); a guest session never gets invented IPO names or scores.
 * Accounts, funds, orders, allotments and P&L are personal, so guests still see clearly labelled sample data
 * for those (see mockAllowed).
 */
export function ipoMockAllowed(opts: { useMockEnv: boolean }): boolean {
  return opts.useMockEnv
}

/**
 * Pick what a list view should show.
 * - `real` is the API result: an array (possibly empty) or null when the request failed.
 * - Real sessions get exactly what the API returned (empty stays empty, failure becomes empty).
 * - Guests may fall back to sample data when there is nothing real to show.
 */
export function listOrMock<T>(real: T[] | null, mock: T[], allowMock: boolean): T[] {
  if (Array.isArray(real) && real.length > 0) return real
  return allowMock ? mock : []
}

/** Throw unless a write succeeded; a 503 (network failure / timeout) must never look like success. */
export function requireMutationOk(res: { ok: boolean; status: number }, detail?: string): void {
  if (res.ok) return
  if (detail) throw new Error(detail)
  if (res.status === 503) throw new Error('The API is unreachable, so your change was not saved. Please try again.')
  throw new Error(`Request failed (HTTP ${res.status}).`)
}
