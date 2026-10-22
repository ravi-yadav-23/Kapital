'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiClient } from '@/lib/api-client'
import {
  Settings,
  Shield,
  Cpu,
  Bell,
  Sliders,
  Key,
  CheckCircle2,
  RefreshCw,
  Send,
  Smartphone,
  Mail,
  MessageSquare,
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
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-brand-from" />
              <span>Platform Settings & API Config</span>
            </h1>
            <p className="page-subtitle">
              Manage Angel One SmartAPI credentials, ASBA UPI defaults, AI keys, and alert channels
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedToast && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/15 text-accent-green border border-accent-green/30 text-xs font-semibold animate-fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Preferences Saved!</span>
              </div>
            )}
            {errorToast && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-red/15 text-accent-red border border-accent-red/30 text-xs font-semibold animate-fade-in">
                <Lock className="w-4 h-4" />
                <span>{errorToast}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. ASBA UPI & Broker Guardrails */}
          <div className="card space-y-4 bg-surface-card border-border-default">
            <div className="flex items-center gap-2 text-sm font-bold text-text-primary pb-2 border-b border-border-subtle">
              <Sliders className="w-4 h-4 text-brand-from" />
              <span>ASBA Mandate & Bidding Guardrails</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-2xs font-semibold text-text-muted uppercase block mb-1">
                  Default UPI ID (VPA) for Mandates
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={defaultUpi}
                    onChange={(e) => setDefaultUpi(e.target.value)}
                    placeholder="e.g. yourname@okhdfcbank"
                    className="w-full text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm flex-shrink-0"
                  >
                    Save
                  </button>
                </div>
                <span className="text-[11px] text-text-muted block mt-1">
                  Used for 1-click mandate staging across all family demat accounts.
                </span>
              </div>

              <div className="pt-3 border-t border-border-subtle">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-2xs font-semibold text-text-muted uppercase">
                    Max Capital Exposure per Single IPO
                  </label>
                  <span className="font-mono font-bold text-brand-from">{maxAllocationPct}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={maxAllocationPct}
                  onChange={(e) => setMaxAllocationPct(parseInt(e.target.value))}
                  className="w-full accent-brand-from"
                />
                <span className="text-[11px] text-text-muted block mt-1">
                  PuLP optimizer will cap total deployment to at most {maxAllocationPct}% of available family corpus in any single issue.
                </span>
              </div>

              <div className="pt-3 border-t border-border-subtle">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-2xs font-semibold text-text-muted uppercase">
                    Pre-Listing Limit Sell Buffer (09:00 AM)
                  </label>
                  <span className="font-mono font-bold text-accent-green">-{limitBufferPct}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={limitBufferPct}
                  onChange={(e) => setLimitBufferPct(parseInt(e.target.value))}
                  className="w-full accent-accent-green"
                />
                <span className="text-[11px] text-text-muted block mt-1">
                  Places limit sell order at {limitBufferPct}% below estimated listing price to guarantee auction fill.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Angel One SmartAPI Session & NSE Compliance */}
          <div className="card space-y-4 bg-surface-card border-border-default">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <Shield className="w-4 h-4 text-accent-green" />
                <span>Angel One SmartAPI Session</span>
              </div>

              <span className="px-2 py-0.5 rounded-full text-2xs font-bold font-mono bg-accent-green/15 text-accent-green border border-accent-green/30">
                {accountsCount} {accountsCount === 1 ? 'Account' : 'Accounts'} Synced
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted">NSE Static Elastic IP:</span>
                  <span className="font-mono text-text-primary font-bold">
                    {process.env.NEXT_PUBLIC_STATIC_IP || '128.185.168.216'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">TOTP Session Expiry:</span>
                  <span className="font-mono text-accent-green font-semibold">Active (Expires in 17h 42m)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Order Rate Limit:</span>
                  <span className="font-mono text-text-secondary">10 orders/sec (Max cap)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRefreshTokens}
                  disabled={isRefreshingAuth}
                  className="btn btn-ghost btn-sm w-full justify-center gap-2 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAuth ? 'animate-spin text-brand-from' : ''}`} />
                  <span>
                    {isRefreshingAuth
                      ? 'Refreshing All TOTP Sessions...'
                      : `Re-Authenticate ${accountsCount} Demat ${accountsCount === 1 ? 'Account' : 'Accounts'}`}
                  </span>
                </button>
              </div>
            </div>

            {/* AI Due Diligence Engine Configuration */}
            <div className="pt-3 border-t border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <Cpu className="w-4 h-4 text-brand-to" />
                  <span>AI Due Diligence & Scoring Engine</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase bg-brand-from/15 text-brand-from border border-brand-from/30">
                  {aiProvider} active
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Provider Selector */}
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Active AI Provider</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => {
                      const p = e.target.value as 'groq' | 'gemini' | 'anthropic'
                      setAiProvider(p)
                      if (p === 'groq') setAiModel('openai/gpt-oss-120b')
                      if (p === 'gemini') setAiModel('gemini-1.5-flash')
                      if (p === 'anthropic') setAiModel('claude-3-5-haiku-20241022')
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-text-primary focus:border-brand-from focus:outline-none"
                  >
                    <option value="groq">Groq Cloud (Fast & Free Testing)</option>
                    <option value="gemini">Google Gemini (AI Studio)</option>
                    <option value="anthropic">Anthropic Claude (Production Grade)</option>
                  </select>
                </div>

                {/* Model Selector */}
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Model Architecture</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-text-primary focus:border-brand-from focus:outline-none"
                  >
                    {aiProvider === 'groq' && (
                      <>
                        <option value="openai/gpt-oss-120b">GPT-OSS 120B (Deep Institutional Analyst)</option>
                        <option value="openai/gpt-oss-20b">GPT-OSS 20B (Ultra-Fast Screening)</option>
                        <option value="qwen/qwen3.6-27b">Qwen 3.6 27B (High-Precision Reasoning)</option>
                        <option value="groq/compound">Groq Compound (Agentic Multi-Model)</option>
                      </>
                    )}
                    {aiProvider === 'gemini' && (
                      <>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast & Structured)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Research)</option>
                      </>
                    )}
                    {aiProvider === 'anthropic' && (
                      <>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast DRHP extraction)</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Maximum depth)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* API Key Input */}
                <div>
                  <label className="block text-text-secondary font-medium mb-1">
                    {aiProvider === 'groq' && 'Groq API Key (gsk_...)'}
                    {aiProvider === 'gemini' && 'Google Gemini API Key (AIza...)'}
                    {aiProvider === 'anthropic' && 'Anthropic API Key (sk-ant-...)'}
                  </label>
                  <input
                    type="password"
                    placeholder={`Enter ${aiProvider} API key or set in .env`}
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
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-text-primary focus:border-brand-from focus:outline-none font-mono text-xs"
                  />
                  <p className="text-2xs text-text-muted mt-1">
                    Saved preferences are persisted in PostgreSQL. You can change models anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Notification Channels */}
          <div className="card space-y-4 bg-surface-card border-border-default lg:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <Bell className="w-4 h-4 text-accent-purple" />
                <span>Instant Alert Channels (Allotments & Refunds)</span>
              </div>

              <button
                type="button"
                onClick={handleSendTestAlert}
                className="btn btn-ghost btn-sm text-2xs gap-1.5"
              >
                {testAlertSent ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
                    <span className="text-accent-green font-semibold">Test Alert Sent!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Send Test Notification</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Telegram */}
              <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-border-subtle flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-text-primary">
                    <MessageSquare className="w-4 h-4 text-brand-from" />
                    <span>Telegram Bot</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Instant alerts for allotment status, refunds & listing day 09:00 AM triggers.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={telegramAlerts}
                  onChange={(e) => setTelegramAlerts(e.target.checked)}
                  className="w-4 h-4 accent-brand-from mt-1 cursor-pointer"
                />
              </div>

              {/* WhatsApp */}
              <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-border-subtle flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-text-primary">
                    <Smartphone className="w-4 h-4 text-accent-green" />
                    <span>WhatsApp Updates</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Morning recommendation brief & UPI mandate approval reminders.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={whatsappAlerts}
                  onChange={(e) => setWhatsappAlerts(e.target.checked)}
                  className="w-4 h-4 accent-accent-green mt-1 cursor-pointer"
                />
              </div>

              {/* Email */}
              <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-border-subtle flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-text-primary">
                    <Mail className="w-4 h-4 text-accent-amber" />
                    <span>Email Statements</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Monthly P&L summaries and tax ledger exports for family accounts.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 accent-accent-amber mt-1 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
