'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import {
  KeyRound,
  QrCode,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Lock,
  ChevronLeft,
} from 'lucide-react'
import { useAuth, GoogleAuthResponse } from '@/lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, loginWithGoogle, verifyTotp, loginAsGuest } = useAuth()

  const [stage, setStage] = useState<'login' | 'setup_2fa' | 'verify_2fa'>('login')
  const [authData, setAuthData] = useState<GoogleAuthResponse | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [googleClientReady, setGoogleClientReady] = useState(false)

  const googleBtnRef = useRef<HTMLDivElement>(null)

  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    const initGoogle = () => {
      if (typeof window === 'undefined' || !(window as any).google?.accounts?.id) return false
      if (!GOOGLE_CLIENT_ID) {
        return false
      }
      try {
        ;(window as any).google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
        })

        if (googleBtnRef.current && stage === 'login') {
          googleBtnRef.current.innerHTML = ''
          ;(window as any).google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'rectangular',
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
  }, [stage, GOOGLE_CLIENT_ID])

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
      router.push('/dashboard')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize demo workspace.')
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

      <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--ink-1)] flex flex-col justify-center items-center px-4 relative select-none">
        {/* Back link */}
        <div className="w-full max-w-sm mb-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)] transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Home
          </button>
        </div>

        {/* Center Container */}
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-[var(--accent)] text-[var(--bg-base)] font-mono font-medium text-sm mb-3">
              K
            </div>
            <h1 className="text-lg font-medium text-[var(--ink-1)] tracking-tight">
              Sign in to Kapitl
            </h1>
            <p className="text-xs text-[var(--ink-3)] mt-1">
              Enter your authorized Google account to access your linked Angel One Demats.
            </p>
          </div>

          {/* Main Card */}
          <div className="card p-6 space-y-5 bg-[var(--bg-surface)] border-[var(--border-default)]">
            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded bg-[var(--bg-subtle)] border border-[var(--negative)] text-[var(--negative)] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* STAGE 1: Standard Login Screen */}
            {stage === 'login' && (
              <div className="space-y-4">
                {/* Google Sign In Container */}
                <div className="flex flex-col items-center justify-center min-h-[44px]">
                  <div ref={googleBtnRef} className="w-full flex justify-center empty:hidden" />

                  {!googleClientReady && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
                          ;(window as any).google.accounts.id.prompt()
                        } else {
                          setErrorMsg('Google Sign-In is initializing. Please try again in a moment.')
                        }
                      }}
                      className="w-full py-2 px-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-subtle)] text-xs text-[var(--ink-1)] font-medium transition flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5 text-[var(--ink-3)]" />
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>

                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border-default)]" />
                  </div>
                  <span className="relative px-2 bg-[var(--bg-surface)] text-2xs uppercase tracking-wider text-[var(--ink-3)] font-mono">
                    or
                  </span>
                </div>

                {/* Guest Mode Card */}
                <button
                  type="button"
                  onClick={handleGuestEntry}
                  disabled={isLoading}
                  className="w-full p-3 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] transition flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-xs font-medium text-[var(--ink-1)]">
                      Exploring? Go to Demo Workspace →
                    </div>
                    <div className="text-2xs text-[var(--ink-3)] mt-0.5">
                      Explore live IPO feed, reports and sample family Demats
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--ink-3)] shrink-0" />
                </button>
              </div>
            )}

            {/* STAGE 2A: One-Time Authenticator Setup */}
            {stage === 'setup_2fa' && authData && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setStage('login')
                    setTotpCode('')
                  }}
                  className="text-2xs text-[var(--ink-3)] hover:text-[var(--ink-1)] flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>

                <div className="text-center space-y-1">
                  <div className="w-8 h-8 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center mx-auto text-[var(--ink-1)]">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-medium text-[var(--ink-1)]">Set up Authenticator</h2>
                  <p className="text-2xs text-[var(--ink-3)]">
                    Scan the QR code or enter the key into Google Authenticator or 1Password.
                  </p>
                </div>

                {authData.qr_data_url && (
                  <div className="flex justify-center p-3 bg-white rounded border border-[var(--border-default)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={authData.qr_data_url} alt="2FA QR Code" className="w-40 h-40" />
                  </div>
                )}

                {authData.secret && (
                  <div className="space-y-1">
                    <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block">
                      Secret Key
                    </label>
                    <div className="flex items-center gap-1.5 p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] font-mono text-2xs">
                      <span className="truncate flex-1 text-[var(--ink-2)]">{authData.secret}</span>
                      <button
                        type="button"
                        onClick={copySecretKey}
                        className="btn-ghost p-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
                        title="Copy key"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-[var(--positive)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleTotpSubmit} className="space-y-3 pt-2">
                  <div>
                    <label className="text-2xs font-mono uppercase text-[var(--ink-3)] block mb-1">
                      Enter 6-digit Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center font-mono text-base tracking-widest py-2"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="btn btn-primary btn-md w-full justify-center"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 2B: Returning User 2FA Verification */}
            {stage === 'verify_2fa' && authData && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setStage('login')
                    setTotpCode('')
                  }}
                  className="text-2xs text-[var(--ink-3)] hover:text-[var(--ink-1)] flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>

                <div className="text-center space-y-1">
                  <div className="w-8 h-8 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center mx-auto text-[var(--ink-1)]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-medium text-[var(--ink-1)]">Two-Factor Authentication</h2>
                  <p className="text-2xs text-[var(--ink-3)]">
                    Enter the code from your authenticator app.
                  </p>
                </div>

                <form onSubmit={handleTotpSubmit} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center font-mono text-lg tracking-widest py-2.5"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="btn btn-primary btn-md w-full justify-center"
                  >
                    {isLoading ? 'Authenticating...' : 'Sign In'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
