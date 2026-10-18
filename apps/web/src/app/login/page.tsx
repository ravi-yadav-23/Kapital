'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import {
  ShieldCheck,
  KeyRound,
  QrCode,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Lock,
  Eye,
  Sparkles,
  Loader2,
  ChevronLeft,
} from 'lucide-react'
import { useAuth, GoogleAuthResponse } from '@/lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { user, isAuthenticated, loginWithGoogle, verifyTotp, loginAsGuest } = useAuth()

  // Stages: 'login' | 'setup_2fa' | 'verify_2fa'
  const [stage, setStage] = useState<'login' | 'setup_2fa' | 'verify_2fa'>('login')
  const [authData, setAuthData] = useState<GoogleAuthResponse | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [googleClientReady, setGoogleClientReady] = useState(false)

  const googleBtnRef = useRef<HTMLDivElement>(null)

  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  // Initialize Google Identity Services
  useEffect(() => {
    const initGoogle = () => {
      if (typeof window === 'undefined' || !(window as any).google?.accounts?.id) return false
      if (!GOOGLE_CLIENT_ID) {
        console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — Google Sign-In disabled.')
        return false
      }
      try {
        ;(window as any).google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
        })

        if (googleBtnRef.current && stage === 'login') {
          // Clear any previous render
          googleBtnRef.current.innerHTML = ''
          ;(window as any).google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            logo_alignment: 'left',
            width: 320,
          })
        }
        setGoogleClientReady(true)
        return true
      } catch (err) {
        console.error('Failed to init Google Identity Services:', err)
        return false
      }
    }

    if (!initGoogle()) {
      const interval = setInterval(() => {
        if (initGoogle()) {
          clearInterval(interval)
        }
      }, 300)
      return () => clearInterval(interval)
    }
  }, [stage])

  const handleGoogleCredentialResponse = async (response: any) => {
    setErrorMsg(null)
    setIsLoading(true)

    try {
      const data = await loginWithGoogle(response.credential)
      setAuthData(data)

      if (data.status === 'SETUP_2FA') {
        setStage('setup_2fa')
      } else {
        setStage('verify_2fa')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authData || !totpCode.trim() || totpCode.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit code.')
      return
    }

    setErrorMsg(null)
    setIsLoading(true)

    try {
      await verifyTotp(authData.temp_token, totpCode.trim())
      router.push('/dashboard')
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGuestEntry = async () => {
    setErrorMsg(null)
    setIsLoading(true)
    try {
      await loginAsGuest()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize guest preview.')
      setIsLoading(false)
    }
  }

  const copySecretKey = () => {
    if (authData?.secret) {
      navigator.clipboard.writeText(authData.secret)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2500)
    }
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleClientReady(true)}
      />

      <div className="min-h-screen w-full bg-[#0c0a09] text-[#fafaf9] flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
        {/* Glow gradients in background */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#f59e0b]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#d97706]/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Back to Home link */}
        <div className="w-full max-w-md z-10 mb-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-xs text-[#a8a29e] hover:text-[#fafaf9] transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>

        {/* Center Container */}
        <div className="w-full max-w-md z-10">
          {/* Logo & Platform Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1612] border border-[#2d2520] text-[#f59e0b] text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" /> IPO Intelligence Platform
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <span className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] bg-clip-text text-transparent font-heading">
                Kapitl
              </span>
            </h1>
            <p className="text-sm text-[#a8a29e] mt-2">
              Personal IPO automation for serious retail investors.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-[#1a1612]/90 backdrop-blur-xl border border-[#2d2520] shadow-2xl rounded-2xl p-6 sm:p-8">
            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* STAGE 1: Standard Login Screen */}
            {stage === 'login' && (
              <div>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-100">Sign in to your account</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Direct access restricted to authorized administrator
                  </p>
                </div>

                {/* Google Sign In Container */}
                <div className="flex flex-col items-center justify-center min-h-[46px] mb-6">
                  {/* Google Identity Services rendered button */}
                  <div ref={googleBtnRef} className="w-full flex justify-center empty:hidden" />

                  {/* Fallback styled button with official Google icon if iframe takes time or is delayed */}
                  {!googleClientReady && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
                          ;(window as any).google.accounts.id.prompt()
                        } else {
                          setErrorMsg('Connecting to Google services... Please click again in 2 seconds.')
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs transition flex items-center justify-center gap-3 shadow-md hover:shadow-lg cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      Sign in with Google
                    </button>
                  )}
                </div>


                <div className="relative my-6 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#2d2520]" />
                  </div>
                  <span className="relative px-3 bg-[#1a1612] text-[11px] uppercase tracking-wider text-[#a8a29e] font-medium">
                    or explore preview
                  </span>
                </div>

                {/* Guest Mode Card */}
                <button
                  type="button"
                  onClick={handleGuestEntry}
                  disabled={isLoading}
                  className="w-full p-3.5 rounded-xl bg-[#0c0a09] hover:bg-[#251e18] border border-[#2d2520] hover:border-[#f59e0b]/40 transition flex items-center justify-between group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] flex items-center justify-center">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#fafaf9] group-hover:text-white transition flex items-center gap-2">
                        Explore as Guest
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 font-medium">
                          Live Data
                        </span>
                      </div>
                      <div className="text-[11px] text-[#a8a29e]">
                        View real IPO scores, allocation plans & reports
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#a8a29e] group-hover:text-[#f59e0b] group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            )}

            {/* STAGE 2A: One-Time Google Authenticator Setup */}
            {stage === 'setup_2fa' && authData && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStage('login')
                    setTotpCode('')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-4 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>

                <div className="text-center mb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-100">Setup Google Authenticator</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scan this one-time QR code with your Authenticator app
                  </p>
                </div>

                {/* QR Code Display */}
                {authData.qr_data_url && (
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-900/90 border border-slate-800 rounded-xl mb-4">
                    <img
                      src={authData.qr_data_url}
                      alt="Google Authenticator QR Code"
                      className="w-48 h-48 rounded-lg bg-white p-2 shadow-inner"
                    />
                    <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Account: <span className="text-slate-300 font-medium">{authData.email}</span>
                    </div>
                  </div>
                )}

                {/* Manual Secret Key Fallback */}
                {authData.secret && (
                  <div className="mb-5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="truncate mr-2">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Manual Setup Key:</div>
                      <code className="text-blue-300 font-mono text-[11px]">{authData.secret}</code>
                    </div>
                    <button
                      type="button"
                      onClick={copySecretKey}
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Copy Secret"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {/* Code Verification Form */}
                <form onSubmit={handleTotpSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Enter 6-Digit Authenticator Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoFocus
                      required
                      className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs text-white shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify & Complete Setup
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 2B: Returning 2FA Challenge */}
            {stage === 'verify_2fa' && authData && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStage('login')
                    setTotpCode('')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-4 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-100">Two-Factor Authentication</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter the current 6-digit code from Google Authenticator
                  </p>
                  <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-300">
                    {authData.email}
                  </div>
                </div>

                <form onSubmit={handleTotpSubmit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoFocus
                      required
                      className="w-full text-center tracking-[0.5em] font-mono text-3xl font-bold py-3 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs text-white shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify Code & Enter
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-center mt-6 text-xs text-slate-500">
            Kapitl Security • RFC 6238 TOTP • Strict Whitelist Protection
          </div>
        </div>
      </div>
    </>
  )
}
