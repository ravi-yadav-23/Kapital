'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import {
  CheckCircle2,
  RefreshCw,
  Send,
  Lock,
} from 'lucide-react'

export default function SettingsPage() {
  const [defaultUpi, setDefaultUpi] = useState('')
  const [maxAllocationPct, setMaxAllocationPct] = useState(80)
  const [limitBufferPct, setLimitBufferPct] = useState(5)
  const [telegramAlerts, setTelegramAlerts] = useState(true)
  const [whatsappAlerts, setWhatsappAlerts] = useState(true)
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [isRefreshingAuth, setIsRefreshingAuth] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [testAlertSent, setTestAlertSent] = useState(false)
  const [accountsCount, setAccountsCount] = useState<number>(1)

  // AI Due Diligence Model Configuration
  const [aiProvider, setAiProvider] = useState<'groq' | 'gemini' | 'anthropic'>('groq')
  const [aiModel, setAiModel] = useState('openai/gpt-oss-120b')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')

  useEffect(() => {
    Promise.all([apiClient.getAccounts(), apiClient.getSettings()]).then(([accs, st]: [any, any]) => {
      if (accs && accs.length > 0) setAccountsCount(accs.length)
      if (st) {
        if (st.default_upi_vpa) setDefaultUpi(st.default_upi_vpa)
        if (st.max_allocation_pct) setMaxAllocationPct(st.max_allocation_pct)
        if (st.limit_buffer_pct) setLimitBufferPct(st.limit_buffer_pct)
        if (st.ai_provider) setAiProvider(st.ai_provider)
        if (st.ai_model) setAiModel(st.ai_model)
        if (st.groq_api_key) setGroqApiKey(st.groq_api_key)
        if (st.gemini_api_key) setGeminiApiKey(st.gemini_api_key)
        if (st.anthropic_api_key) setAnthropicApiKey(st.anthropic_api_key)
        if (st.notifications) {
          if (st.notifications.telegram_enabled !== undefined) setTelegramAlerts(st.notifications.telegram_enabled)
          if (st.notifications.whatsapp_enabled !== undefined) setWhatsappAlerts(st.notifications.whatsapp_enabled)
          if (st.notifications.email_enabled !== undefined) setEmailAlerts(st.notifications.email_enabled)
        }
      }
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.updateSettings({
        default_upi_vpa: defaultUpi,
        max_allocation_pct: maxAllocationPct,
        limit_buffer_pct: limitBufferPct,
        ai_provider: aiProvider,
        ai_model: aiModel,
        groq_api_key: groqApiKey,
        gemini_api_key: geminiApiKey,
        anthropic_api_key: anthropicApiKey,
        notifications: {
          telegram_enabled: telegramAlerts,
          whatsapp_enabled: whatsappAlerts,
          email_enabled: emailAlerts,
          score_alerts: true,
          allotment_alerts: true,
          listing_sell_alerts: true,
          fund_unlock_alerts: true,
        },
      })
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2500)
    } catch (err: any) {
      console.error('Failed to save preferences:', err)
      setErrorToast(err.message || 'Failed to persist preferences to database.')
      setTimeout(() => setErrorToast(null), 4000)
    }
  }

  const handleRefreshTokens = async () => {
    setIsRefreshingAuth(true)
    try {
      await apiClient.syncAllAccounts()
      const accs = await apiClient.getAccounts()
      if (accs) setAccountsCount(accs.length)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2500)
    } catch (err: any) {
      console.error('Failed to sync accounts:', err)
      setErrorToast(err.message || 'Failed to authenticate Angel One demat accounts.')
      setTimeout(() => setErrorToast(null), 4000)
    } finally {
      setIsRefreshingAuth(false)
    }
  }

  const handleSendTestAlert = () => {
    setTestAlertSent(true)
    setTimeout(() => setTestAlertSent(false), 2500)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium text-[var(--ink-1)] tracking-tight">
              Settings
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {savedToast && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded text-2xs font-mono text-[var(--positive)] bg-[var(--bg-subtle)] border border-[var(--positive)]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved</span>
              </div>
            )}
            {errorToast && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded text-2xs font-mono text-[var(--negative)] bg-[var(--bg-subtle)] border border-[var(--negative)]">
                <Lock className="w-3.5 h-3.5" />
                <span>{errorToast}</span>
              </div>
            )}
            <button
              onClick={handleSave}
              type="button"
              className="btn btn-primary btn-sm"
            >
              Save Settings
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. ASBA UPI & Bidding Guardrails */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-medium text-[var(--ink-1)] pb-2 border-b border-[var(--border-default)]">
              ASBA Mandate & Bidding Guardrails
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">
                  Default UPI ID (VPA) for Mandates
                </label>
                <input
                  type="text"
                  value={defaultUpi}
                  onChange={(e) => setDefaultUpi(e.target.value)}
                  placeholder="e.g. name@bank"
                  className="w-full text-xs font-mono"
                />
                <span className="text-2xs text-[var(--ink-3)] block mt-1">
                  Used for 1-click mandate staging across all family Demat accounts.
                </span>
              </div>

              <div className="pt-3 border-t border-[var(--border-default)]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-2xs font-mono uppercase text-[var(--ink-3)]">
                    Max Capital Exposure per Single IPO
                  </label>
                  <span className="font-mono text-xs font-medium text-[var(--ink-1)]">{maxAllocationPct}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={maxAllocationPct}
                  onChange={(e) => setMaxAllocationPct(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[var(--bg-subtle)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
                />
                <span className="text-2xs text-[var(--ink-3)] block mt-1">
                  PuLP optimizer caps total deployment to at most {maxAllocationPct}% of available family corpus in any single issue.
                </span>
              </div>

              <div className="pt-3 border-t border-[var(--border-default)]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-2xs font-mono uppercase text-[var(--ink-3)]">
                    Pre-Listing Limit Sell Buffer (09:00 AM)
                  </label>
                  <span className="font-mono text-xs font-medium text-[var(--positive)]">-{limitBufferPct}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={limitBufferPct}
                  onChange={(e) => setLimitBufferPct(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[var(--bg-subtle)] rounded appearance-none cursor-pointer accent-[var(--positive)]"
                />
                <span className="text-2xs text-[var(--ink-3)] block mt-1">
                  Places limit sell order at {limitBufferPct}% below estimated listing price to guarantee execution in pre-open auction.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Angel One SmartAPI Session */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
              <h3 className="text-sm font-medium text-[var(--ink-1)]">
                Angel One SmartAPI Session
              </h3>
              <span className="font-mono text-2xs text-[var(--ink-3)]">
                {accountsCount} {accountsCount === 1 ? 'Account' : 'Accounts'} Synced
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-1.5 font-mono text-2xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">NSE Static Elastic IP:</span>
                  <span className="text-[var(--ink-1)]">
                    {process.env.NEXT_PUBLIC_STATIC_IP || '128.185.168.216'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Broker Session:</span>
                  <span className="text-[var(--positive)]">Sandbox Seeded Mode</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Order Rate Limit:</span>
                  <span className="text-[var(--ink-2)]">10 orders/sec</span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleRefreshTokens}
                  disabled={isRefreshingAuth}
                  className="btn btn-secondary btn-sm w-full justify-center gap-2 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAuth ? 'animate-spin' : ''}`} />
                  <span>
                    {isRefreshingAuth
                      ? 'Re-Authenticating Sessions...'
                      : `Re-Authenticate ${accountsCount} Demat Accounts`}
                  </span>
                </button>
              </div>
            </div>

            {/* AI Engine Configuration */}
            <div className="pt-3 border-t border-[var(--border-default)] space-y-3">
              <h3 className="text-sm font-medium text-[var(--ink-1)]">
                AI Due Diligence Configuration
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">Provider</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => {
                      const p = e.target.value as 'groq' | 'gemini' | 'anthropic'
                      setAiProvider(p)
                      if (p === 'groq') setAiModel('openai/gpt-oss-120b')
                      if (p === 'gemini') setAiModel('gemini-1.5-flash')
                      if (p === 'anthropic') setAiModel('claude-3-5-haiku-20241022')
                    }}
                    className="w-full text-xs"
                  >
                    <option value="groq">Groq Cloud (Fast Inference)</option>
                    <option value="gemini">Google Gemini (AI Studio)</option>
                    <option value="anthropic">Anthropic Claude (Production)</option>
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full text-xs"
                  >
                    {aiProvider === 'groq' && (
                      <>
                        <option value="openai/gpt-oss-120b">GPT-OSS 120B (Deep Due Diligence)</option>
                        <option value="openai/gpt-oss-20b">GPT-OSS 20B (Fast Screening)</option>
                        <option value="qwen/qwen3.6-27b">Qwen 3.6 27B</option>
                      </>
                    )}
                    {aiProvider === 'gemini' && (
                      <>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Default)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      </>
                    )}
                    {aiProvider === 'anthropic' && (
                      <>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Default)</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">
                    API Key Override
                  </label>
                  <input
                    type="password"
                    placeholder={`Enter ${aiProvider} API key (optional)`}
                    value={
                      aiProvider === 'groq'
                        ? groqApiKey
                        : aiProvider === 'gemini'
                        ? geminiApiKey
                        : anthropicApiKey
                    }
                    onChange={(e) => {
                      if (aiProvider === 'groq') setGroqApiKey(e.target.value)
                      if (aiProvider === 'gemini') setGeminiApiKey(e.target.value)
                      if (aiProvider === 'anthropic') setAnthropicApiKey(e.target.value)
                    }}
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Notification Channels */}
          <div className="card p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
              <h3 className="text-sm font-medium text-[var(--ink-1)]">
                Notification Channels
              </h3>

              <button
                type="button"
                onClick={handleSendTestAlert}
                className="btn btn-secondary btn-sm text-xs gap-1.5"
              >
                {testAlertSent ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Test Sent</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Test Notification</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-medium text-[var(--ink-1)] block">Telegram Bot</span>
                  <p className="text-2xs text-[var(--ink-3)]">
                    Allotment status, refunds, and listing-day pre-open triggers.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={telegramAlerts}
                  onChange={(e) => setTelegramAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)] mt-0.5 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-medium text-[var(--ink-1)] block">WhatsApp Updates</span>
                  <p className="text-2xs text-[var(--ink-3)]">
                    Morning brief & UPI mandate approval alerts.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={whatsappAlerts}
                  onChange={(e) => setWhatsappAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)] mt-0.5 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-medium text-[var(--ink-1)] block">Email Statements</span>
                  <p className="text-2xs text-[var(--ink-3)]">
                    Monthly P&L summaries and family tax ledger exports.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)] mt-0.5 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
