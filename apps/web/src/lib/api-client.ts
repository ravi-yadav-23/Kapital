import {
  Ipo,
  FamilyAccount,
  Allotment,
  PnlSummary,
  FundSummary,
  AllocationPlan,
  IpoOrder,
  AiReport,
  AppSettings,
} from '../types'
import {
  MOCK_IPOS,
  MOCK_ACCOUNTS,
  MOCK_ALLOTMENTS,
  MOCK_FUND_SUMMARY,
  MOCK_PNL_SUMMARY,
  MOCK_ALLOCATION_PLAN,
  MOCK_ORDERS,
  MOCK_ASBA_LOCKS,
  MOCK_REPORTS,
  MOCK_APP_SETTINGS,
} from './mock-data'

function getApiBaseUrl(): string {
  // 1. Runtime service binding injected by Vercel for server functions
  if (process.env.API_URL) {
    const base = process.env.API_URL.replace(/\/$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
  // 2. Explicit public API URL if configured
  if (process.env.NEXT_PUBLIC_API_URL) {
    const base = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
  // 3. Client-side browser: relative /api routed to the api service via Vercel rewrites
  if (typeof window !== 'undefined') {
    return '/api'
  }
  // 4. Default fallback for local standalone development
  return 'http://127.0.0.1:8000/api'
}

const API_BASE_URL = getApiBaseUrl()
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

function isGuestSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const userStr = localStorage.getItem('kapitl_user')
    if (userStr) {
      const u = JSON.parse(userStr)
      return Boolean(u.is_guest || u.role === 'GUEST')
    }
  } catch {}
  return false
}

// Local mock stores (prevents mutating exported constants)
let localMockAccounts: FamilyAccount[] = [...MOCK_ACCOUNTS]
let localMockOrders: IpoOrder[] = [...MOCK_ORDERS]

// Module-level in-memory cache for snappy navigation (SWR: Stale-While-Revalidate)
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry<any>>()
const DEFAULT_TTL_MS = 60_000 // 60 seconds

function getCached<T>(key: string, maxAgeMs = DEFAULT_TTL_MS): T | null {
  const entry = memoryCache.get(key)
  if (entry && Date.now() - entry.timestamp <= maxAgeMs) {
    return entry.data as T
  }
  // Secondary persistent SWR cache across page reloads
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`kapitl_swr_${key}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Date.now() - parsed.timestamp <= maxAgeMs) {
          memoryCache.set(key, parsed)
          return parsed.data as T
        }
      }
    } catch {}
  }
  return null
}

function setCached<T>(key: string, data: T) {
  const entry = { data, timestamp: Date.now() }
  memoryCache.set(key, entry)
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`kapitl_swr_${key}`, JSON.stringify(entry))
    } catch {}
  }
}

function clearCache(keyPrefix?: string) {
  if (!keyPrefix) {
    memoryCache.clear()
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i)
          if (k && k.startsWith('kapitl_swr_')) keysToRemove.push(k)
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k))
      } catch {}
    }
    return
  }
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key)
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith(`kapitl_swr_${keyPrefix}`)) keysToRemove.push(k)
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k))
    } catch {}
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kapitl_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  return headers
}

async function authFetch(url: string, init?: RequestInit, timeoutMs = 10000): Promise<Response> {
  const authHeaders = getAuthHeaders()
  const headers = {
    ...authHeaders,
    ...(init?.headers || {}),
  }

  // Abort controller to prevent slow serverless cold starts from hanging UI indefinitely
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init?.signal || controller.signal,
    })
    clearTimeout(timeoutId)
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('kapitl_token')
      localStorage.removeItem('kapitl_user')
      window.location.href = '/login'
    }
    return res
  } catch (err: any) {
    clearTimeout(timeoutId)
    console.warn(`[Kapitl API] Network request to ${url} failed or timed out:`, err?.message || err)
    // Return synthetic 503 response so callers can gracefully fallback instead of crashing
    return new Response(JSON.stringify({ detail: 'API unreachable or timed out' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleResponse<T>(res: Response, fallback: T): Promise<T> {
  if (res.ok) {
    return await res.json()
  }
  // If the server returned an explicit error response (4xx/5xx), parse and throw the real error
  if (res.status !== 503) {
    const err = await res.json().catch(() => null)
    if (err && (err.detail || err.message)) {
      throw new Error(err.detail || err.message)
    }
  }
  if (fallback !== undefined && fallback !== null) {
    return fallback
  }
  const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
  throw new Error(err.detail || 'API request failed')
}

async function handleMutationResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return await res.json()
  }
  const err = await res.json().catch(() => ({ detail: 'Operation failed' }))
  throw new Error(err.detail || err.message || 'API request failed')
}



export const apiClient = {
  // Synchronous cache getters for instant 0ms page rendering on tab switch
  getCachedIpos(): Ipo[] | null {
    return getCached<Ipo[]>('ipos:all', 300_000)
  },
  getCachedFundSummary(): FundSummary | null {
    return getCached<FundSummary>('funds:summary', 300_000)
  },
  getCachedPnlSummary(): PnlSummary | null {
    return getCached<PnlSummary>('funds:pnl', 300_000)
  },
  getCachedAccounts(): FamilyAccount[] | null {
    return getCached<FamilyAccount[]>('funds:accounts', 300_000)
  },
  getCachedAllotments(): Allotment[] | null {
    return getCached<Allotment[]>('allotments:all', 300_000)
  },
  getCachedOrders(): IpoOrder[] | null {
    return getCached<IpoOrder[]>('orders:all', 300_000)
  },
  clearCache(keyPrefix?: string): void {
    clearCache(keyPrefix)
  },

  // ── IPOs ──────────────────────────────────────────────────────────────────
  async getIpos(status?: string): Promise<Ipo[]> {
    if (USE_MOCK_DATA) {
      if (!status || status === 'all') return MOCK_IPOS
      return MOCK_IPOS.filter((ipo) => ipo.status === status)
    }
    const cacheKey = `ipos:${status || 'all'}`
    const cached = getCached<Ipo[]>(cacheKey)

    const query = status && status !== 'all' ? `?status=${status}` : ''
    const fetchPromise = authFetch(`${API_BASE_URL}/ipos${query}`)
      .then(async (res) => {
        if (res.ok) {
          const fresh: Ipo[] = await res.json()
          setCached(cacheKey, fresh)
          return fresh
        }
        return cached || []
      })
      .catch(() => cached || [])

    // SWR: return cached immediately if present, revalidate in background
    if (cached && cached.length > 0) {
      fetchPromise.catch(() => {})
      return cached
    }

    return await fetchPromise
  },

  async getIpoById(id: string): Promise<Ipo | null> {
    const mockFallback =
      MOCK_IPOS.find(
        (ipo) =>
          ipo.id === id ||
          ipo.slug === id ||
          ipo.symbol?.toLowerCase() === id.toLowerCase()
      ) || null

    if (USE_MOCK_DATA) {
      return mockFallback
    }
    const cacheKey = `ipo:${id}`
    const cached = getCached<Ipo>(cacheKey)
    if (cached) return cached

    try {
      const res = await authFetch(`${API_BASE_URL}/ipos/${id}`)
      if (res.status === 404) {
        return mockFallback
      }
      const data = await handleResponse(res, mockFallback)
      if (data) setCached(cacheKey, data)
      return data || mockFallback
    } catch {
      return mockFallback
    }
  },

  async syncIpos(): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`${API_BASE_URL}/ipos/sync`, {
      method: 'POST',
    }, 30000)
    return handleResponse(res, { success: true, message: 'Sync complete' })
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  async getAccounts(): Promise<FamilyAccount[]> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return [...localMockAccounts]
    }
    const cacheKey = 'funds:accounts'
    const cached = getCached<FamilyAccount[]>(cacheKey)
    if (cached) {
      authFetch(`${API_BASE_URL}/funds/accounts`)
        .then((res) => handleResponse(res, cached))
        .then((fresh) => { if (fresh) setCached(cacheKey, fresh) })
        .catch(() => {})
      return cached
    }
    const res = await authFetch(`${API_BASE_URL}/funds/accounts`)
    const data = await handleResponse(res, [] as FamilyAccount[])
    const result = Array.isArray(data) ? data : []
    setCached(cacheKey, result)
    return result
  },

  async createAccount(data: any): Promise<FamilyAccount> {
    if (USE_MOCK_DATA) {
      const newAcc: FamilyAccount = {
        id: `acc-${Date.now()}`,
        name: data.name,
        relation: data.relation || 'Self',
        angel_client_id: data.angel_client_id,
        is_active: true,
        total_balance: data.total_balance || 0,
        available_balance: data.available_balance || 0,
        locked_balance: 0,
        preferred_category: data.preferred_category || 'RETAIL',
        max_single_ipo_pct: 80,
        total_applied_ipos: 0,
        total_allotments: 0,
        allotment_rate: 0,
        total_realized_pnl: 0,
        created_at: new Date().toISOString(),
      }
      localMockAccounts = [...localMockAccounts, newAcc]
      return newAcc
    }
    const res = await authFetch(`${API_BASE_URL}/funds/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const created = await handleMutationResponse<FamilyAccount>(res)
    clearCache('funds')
    return created
  },

  async syncAccountBalance(accountId: string): Promise<FamilyAccount> {
    const res = await authFetch(`${API_BASE_URL}/funds/accounts/${accountId}/sync`, {
      method: 'POST',
    })
    const updated = await handleMutationResponse<FamilyAccount>(res)
    clearCache('funds')
    return updated
  },

  async syncAllAccounts(): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/funds/accounts/sync-all`, {
      method: 'POST',
    })
    const result = await handleMutationResponse<any>(res)
    clearCache('funds')
    return result
  },

  async updateAccount(accountId: string, data: any): Promise<FamilyAccount> {
    const res = await authFetch(`${API_BASE_URL}/funds/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const updated = await handleMutationResponse<FamilyAccount>(res)
    clearCache('funds')
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kapitl_alloc_plan')
    }
    return updated
  },

  // ── Funds & Allocation ────────────────────────────────────────────────────
  async getFundSummary(): Promise<FundSummary> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return MOCK_FUND_SUMMARY
    }
    const cacheKey = 'funds:summary'
    const cached = getCached<FundSummary>(cacheKey)

    const fetchPromise = authFetch(`${API_BASE_URL}/funds/summary`)
      .then(async (res) => {
        if (res.ok) {
          const fresh: FundSummary = await res.json()
          setCached(cacheKey, fresh)
          return fresh
        }
        return cached || {
          total_family_balance: 0,
          total_available: 0,
          total_locked_asba: 0,
          utilization_percent: 0,
          accounts_active: 0,
          accounts_total: 0,
        }
      })
      .catch(() => cached || {
        total_family_balance: 0,
        total_available: 0,
        total_locked_asba: 0,
        utilization_percent: 0,
        accounts_active: 0,
        accounts_total: 0,
      })

    if (cached) {
      fetchPromise.catch(() => {})
      return cached
    }

    return await fetchPromise
  },

  async getAllocationPlan(forceRefresh = false): Promise<AllocationPlan> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return MOCK_ALLOCATION_PLAN
    }
    const CACHE_KEY = 'kapitl_alloc_plan'
    const CACHE_TTL = 3 * 60 * 1000 // 3 minutes

    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          if (Date.now() - timestamp < CACHE_TTL) {
            return data
          }
        }
      } catch {
        // Ignore cache parsing errors
      }
    }

    const res = await authFetch(`${API_BASE_URL}/funds/optimize`, {
      method: 'POST',
    })
    const data = await handleResponse<any>(res, null)
    const result: AllocationPlan = {
      plan_id: data?.plan_id || `plan-${Date.now()}`,
      generated_at: data?.generated_at || new Date().toISOString(),
      total_capital_deployed: data?.total_capital_deployed || 0,
      entries: Array.isArray(data?.entries) ? data.entries : [],
      skipped_ipos: Array.isArray(data?.skipped_ipos) ? data.skipped_ipos : [],
      warnings: Array.isArray(data?.warnings)
        ? data.warnings
        : data?.status === 'INSUFFICIENT_FUNDS'
        ? ['Family Demat accounts have insufficient liquid balance for active IPOs. Update balances or deposit funds to allocate.']
        : data?.status === 'NO_ACTIVE_ISSUES'
        ? ['No active IPO bidding windows open today. Capital preserved liquid for upcoming issues.']
        : [],
    }

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }))
      } catch {
        // Ignore cache storage errors
      }
    }

    return result
  },

  async getAsbaLocks(): Promise<any[]> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return MOCK_ASBA_LOCKS
    }
    const res = await authFetch(`${API_BASE_URL}/funds/locks`)
    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }
    return []
  },

  // ── Allotments ────────────────────────────────────────────────────────────
  async getAllotments(): Promise<Allotment[]> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return MOCK_ALLOTMENTS
    }
    const cacheKey = 'allotments:all'
    const cached = getCached<Allotment[]>(cacheKey)
    if (cached) {
      authFetch(`${API_BASE_URL}/allotments`)
        .then((res) => handleResponse(res, cached))
        .then((fresh) => { if (fresh) setCached(cacheKey, fresh) })
        .catch(() => {})
      return cached
    }
    const res = await authFetch(`${API_BASE_URL}/allotments`)
    const data = await handleResponse(res, [] as Allotment[])
    const result = Array.isArray(data) ? data : []
    setCached(cacheKey, result)
    return result
  },

  async stageSellOrder(allotmentId: string, limitPrice: number): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/allotments/${allotmentId}/stage-sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit_price: limitPrice, trigger_time: '09:00:00' }),
    })
    const result = await handleMutationResponse<any>(res)
    clearCache('allotments')
    return result
  },

  // ── P&L ───────────────────────────────────────────────────────────────────
  async getPnlSummary(): Promise<PnlSummary> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return MOCK_PNL_SUMMARY
    }
    const cacheKey = 'funds:pnl'
    const cached = getCached<PnlSummary>(cacheKey)
    if (cached) {
      authFetch(`${API_BASE_URL}/funds/pnl-summary`)
        .then((res) => handleResponse(res, cached))
        .then((fresh) => { if (fresh) setCached(cacheKey, fresh) })
        .catch(() => {})
      return cached
    }
    const res = await authFetch(`${API_BASE_URL}/funds/pnl-summary`)
    const emptyPnl: PnlSummary = {
      total_invested: 0,
      total_realized_pnl: 0,
      total_unrealized_pnl: 0,
      total_pnl: 0,
      overall_roi_percent: 0,
      total_applied_ipos: 0,
      total_allotments: 0,
      allotment_rate_percent: 0,
      total_sold: 0,
      total_holding: 0,
    }
    const data = await handleResponse(res, emptyPnl)
    setCached(cacheKey, data)
    return data
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  async getOrders(): Promise<IpoOrder[]> {
    if (USE_MOCK_DATA || isGuestSession()) {
      return [...localMockOrders]
    }
    const cacheKey = 'orders:all'
    const cached = getCached<IpoOrder[]>(cacheKey)
    if (cached) {
      authFetch(`${API_BASE_URL}/orders`)
        .then((res) => handleResponse(res, cached))
        .then((fresh) => { if (fresh) setCached(cacheKey, fresh) })
        .catch(() => {})
      return cached
    }
    const res = await authFetch(`${API_BASE_URL}/orders`)
    const data = await handleResponse(res, [] as IpoOrder[])
    const result = Array.isArray(data) ? data : []
    setCached(cacheKey, result)
    return result
  },

  async applyOrder(data: any): Promise<IpoOrder> {
    if (USE_MOCK_DATA) {
      const newOrder: IpoOrder = {
        id: `ord-${Date.now()}`,
        ipo_id: data.ipo_id,
        ipo_name: data.ipo_name || 'IPO Issue',
        account_id: data.account_id,
        account_name: data.account_name || 'Family Member',
        category: data.category || 'RETAIL',
        lots: data.lots || 1,
        amount: data.amount || 15000,
        status: 'CONFIRMED',
        angel_order_id: `ANG_IPO_${Date.now().toString().slice(-6)}`,
        placed_at: new Date().toISOString(),
      }
      localMockOrders = [newOrder, ...localMockOrders]
      return newOrder
    }
    const res = await authFetch(`${API_BASE_URL}/orders/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const order = await handleMutationResponse<IpoOrder>(res)
    clearCache('orders')
    clearCache('funds')
    return order
  },

  async cancelOrder(orderId: string): Promise<IpoOrder> {
    const res = await authFetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
      method: 'POST',
    })
    const order = await handleMutationResponse<IpoOrder>(res)
    clearCache('orders')
    clearCache('funds')
    return order
  },

  async deleteOrder(orderId: string): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE_URL}/orders/${orderId}`, {
      method: 'DELETE',
    })
    const result = await handleMutationResponse<{ success: boolean }>(res)
    clearCache('orders')
    clearCache('funds')
    return result
  },

  async markOrderApplied(orderId: string): Promise<IpoOrder> {
    const res = await authFetch(`${API_BASE_URL}/orders/${orderId}/mark-applied`, {
      method: 'POST',
    })
    const order = await handleMutationResponse<IpoOrder>(res)
    clearCache('orders')
    return order
  },

  async setOrderAllotmentResult(orderId: string, result: 'ALLOTTED' | 'NOT_ALLOTTED'): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/orders/${orderId}/allotment?result=${result}`, {
      method: 'POST',
    })
    const resData = await handleMutationResponse<any>(res)
    clearCache('orders')
    clearCache('allotments')
    clearCache('funds')
    return resData
  },

  // ── AI Reports ────────────────────────────────────────────────────────────
  async getReports(): Promise<AiReport[]> {
    if (USE_MOCK_DATA) {
      return MOCK_REPORTS
    }
    const res = await authFetch(`${API_BASE_URL}/reports`)
    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }
    return []
  },

  async getReportById(id: string): Promise<AiReport | null> {
    if (USE_MOCK_DATA) {
      return MOCK_REPORTS.find((r) => r.id === id || r.ipo_id === id) || null
    }
    const res = await authFetch(`${API_BASE_URL}/reports/${id}`)
    if (res.status === 404) return null
    return handleResponse(res, null as any)
  },

  async generateReport(id: string): Promise<AiReport> {
    const res = await authFetch(`${API_BASE_URL}/reports/${id}/generate`, {
      method: 'POST',
    }, 45000)
    return handleResponse(res, null as any)
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings(): Promise<AppSettings> {
    if (USE_MOCK_DATA) {
      return { ...MOCK_APP_SETTINGS, notifications: { ...MOCK_APP_SETTINGS.notifications } }
    }
    try {
      const res = await authFetch(`${API_BASE_URL}/settings`)
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn('Could not fetch settings from backend, using default preferences', e)
    }
    return { ...MOCK_APP_SETTINGS, notifications: { ...MOCK_APP_SETTINGS.notifications } }
  },

  async updateSettings(settings: Partial<AppSettings> | any): Promise<any> {
    if (USE_MOCK_DATA) {
      return { success: true, settings }
    }
    const res = await authFetch(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    return handleResponse(res, { success: true })
  },
}
