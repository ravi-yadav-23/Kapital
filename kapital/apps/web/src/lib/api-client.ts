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
  MOCK_REPORTS,
  MOCK_APP_SETTINGS,
} from './mock-data'

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'
const API_BASE_URL = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

async function handleResponse<T>(res: Response, fallback: T): Promise<T> {
  if (res.ok) {
    return await res.json()
  }
  const errorText = await res.text().catch(() => '')
  throw new Error(`API Error ${res.status}: ${errorText || res.statusText}`)
}

export const apiClient = {
  // ── IPOs ──────────────────────────────────────────────────────────────────
  async getIpos(status?: string): Promise<Ipo[]> {
    if (USE_MOCK_DATA) {
      if (!status || status === 'all') return MOCK_IPOS
      return MOCK_IPOS.filter((ipo) => ipo.status === status)
    }
    const url = `${API_BASE_URL}/ipos${status && status !== 'all' ? `?status=${status}` : ''}`
    const res = await fetch(url)
    return handleResponse(res, MOCK_IPOS)
  },

  async getIpoById(id: string): Promise<Ipo | null> {
    if (USE_MOCK_DATA) {
      return MOCK_IPOS.find((ipo) => ipo.id === id || ipo.slug === id) || null
    }
    const res = await fetch(`${API_BASE_URL}/ipos/${id}`)
    if (res.status === 404) return null
    return handleResponse(res, null as any)
  },

  async syncIpos(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/ipos/sync`, {
      method: 'POST',
    })
    return handleResponse(res, { success: true, message: 'Sync complete' })
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  async getAccounts(): Promise<FamilyAccount[]> {
    if (USE_MOCK_DATA) {
      return MOCK_ACCOUNTS
    }
    const res = await fetch(`${API_BASE_URL}/funds/accounts`)
    return handleResponse(res, MOCK_ACCOUNTS)
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
      MOCK_ACCOUNTS.push(newAcc)
      return newAcc
    }
    const res = await fetch(`${API_BASE_URL}/funds/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res, data)
  },

  async syncAccountBalance(accountId: string): Promise<FamilyAccount> {
    const res = await fetch(`${API_BASE_URL}/funds/accounts/${accountId}/sync`, {
      method: 'POST',
    })
    return handleResponse(res, null as any)
  },

  async syncAllAccounts(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/funds/accounts/sync-all`, {
      method: 'POST',
    })
    return handleResponse(res, { success: true })
  },

  // ── Funds & Allocation ────────────────────────────────────────────────────
  async getFundSummary(): Promise<FundSummary> {
    if (USE_MOCK_DATA) {
      return MOCK_FUND_SUMMARY
    }
    const res = await fetch(`${API_BASE_URL}/funds/summary`)
    return handleResponse(res, MOCK_FUND_SUMMARY)
  },

  async getAllocationPlan(forceRefresh = false): Promise<AllocationPlan> {
    if (USE_MOCK_DATA) {
      return MOCK_ALLOCATION_PLAN
    }
    const CACHE_KEY = 'kapitl_alloc_plan'
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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

    const res = await fetch(`${API_BASE_URL}/funds/optimize`, {
      method: 'POST',
    })
    const data = await handleResponse(res, MOCK_ALLOCATION_PLAN)
    const result = {
      ...data,
      entries: data.entries || [],
      skipped_ipos: data.skipped_ipos || [],
      warnings: data.warnings || [],
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
    if (USE_MOCK_DATA) {
      return []
    }
    const res = await fetch(`${API_BASE_URL}/funds/locks`)
    return handleResponse(res, [])
  },

  // ── Allotments ────────────────────────────────────────────────────────────
  async getAllotments(): Promise<Allotment[]> {
    if (USE_MOCK_DATA) {
      return MOCK_ALLOTMENTS
    }
    const res = await fetch(`${API_BASE_URL}/allotments`)
    return handleResponse(res, MOCK_ALLOTMENTS)
  },

  async stageSellOrder(allotmentId: string, limitPrice: number): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/allotments/${allotmentId}/stage-sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit_price: limitPrice, trigger_time: '09:00:00' }),
    })
    return handleResponse(res, { success: true })
  },

  // ── P&L ───────────────────────────────────────────────────────────────────
  async getPnlSummary(): Promise<PnlSummary> {
    if (USE_MOCK_DATA) {
      return MOCK_PNL_SUMMARY
    }
    const res = await fetch(`${API_BASE_URL}/funds/pnl-summary`)
    return handleResponse(res, MOCK_PNL_SUMMARY)
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  async getOrders(): Promise<IpoOrder[]> {
    if (USE_MOCK_DATA) {
      return MOCK_ORDERS
    }
    const res = await fetch(`${API_BASE_URL}/orders`)
    return handleResponse(res, MOCK_ORDERS)
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
      MOCK_ORDERS.unshift(newOrder)
      return newOrder
    }
    const res = await fetch(`${API_BASE_URL}/orders/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res, data)
  },

  async cancelOrder(orderId: string): Promise<IpoOrder> {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
      method: 'POST',
    })
    return handleResponse(res, null as any)
  },

  async deleteOrder(orderId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
      method: 'DELETE',
    })
    return handleResponse(res, { success: true })
  },

  async markOrderApplied(orderId: string): Promise<IpoOrder> {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/mark-applied`, {
      method: 'POST',
    })
    return handleResponse(res, null as any)
  },

  async setOrderAllotmentResult(orderId: string, result: 'ALLOTTED' | 'NOT_ALLOTTED'): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/allotment?result=${result}`, {
      method: 'POST',
    })
    return handleResponse(res, { success: true })
  },

  // ── AI Reports ────────────────────────────────────────────────────────────
  async getReports(): Promise<AiReport[]> {
    if (USE_MOCK_DATA) {
      return MOCK_REPORTS
    }
    const res = await fetch(`${API_BASE_URL}/reports`)
    return handleResponse(res, MOCK_REPORTS)
  },

  async getReportById(id: string): Promise<AiReport | null> {
    if (USE_MOCK_DATA) {
      return MOCK_REPORTS.find((r) => r.id === id || r.ipo_id === id) || null
    }
    const res = await fetch(`${API_BASE_URL}/reports/${id}`)
    if (res.status === 404) return null
    return handleResponse(res, null as any)
  },

  async generateReport(id: string): Promise<AiReport> {
    const res = await fetch(`${API_BASE_URL}/reports/${id}/generate`, {
      method: 'POST',
    })
    return handleResponse(res, null as any)
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings(): Promise<AppSettings> {
    if (USE_MOCK_DATA) {
      return { ...MOCK_APP_SETTINGS, notifications: { ...MOCK_APP_SETTINGS.notifications } }
    }
    try {
      const res = await fetch(`${API_BASE_URL}/settings`)
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
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    return handleResponse(res, { success: true })
  },
}
