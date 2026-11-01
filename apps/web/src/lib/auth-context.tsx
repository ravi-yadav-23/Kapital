'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export interface UserProfile {
  id: string
  username: string
  email?: string
  role: 'ADMIN' | 'GUEST'
  is_guest: boolean
}

export interface GoogleAuthResponse {
  status: 'REQUIRE_2FA' | 'SETUP_2FA'
  temp_token: string
  email: string
  name?: string
  secret?: string
  otpauth_uri?: string
  qr_data_url?: string
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isGuest: boolean
  loginWithGoogle: (credential: string) => Promise<GoogleAuthResponse>
  verifyTotp: (tempToken: string, code: string) => Promise<void>
  loginAsGuest: (redirectTo?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getApiBaseUrl(): string {
  if (process.env.API_URL) {
    const base = process.env.API_URL.replace(/\/$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    const base = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
  if (typeof window !== 'undefined') {
    return '/api'
  }
  return 'http://127.0.0.1:8000/api'
}

const API_BASE_URL = getApiBaseUrl()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check initial stored auth state on client
    try {
      const storedToken = localStorage.getItem('kapitl_token')
      const storedUser = localStorage.getItem('kapitl_user')

      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } else {
        // Seamless guest exploration with demo workspace
        const guestProfile: UserProfile = {
          id: 'guest-explorer',
          username: 'Guest Explorer',
          email: 'guest@kapitl.internal',
          role: 'GUEST',
          is_guest: true,
        }
        localStorage.setItem('kapitl_token', 'demo-guest-jwt-token')
        localStorage.setItem('kapitl_user', JSON.stringify(guestProfile))
        setToken('demo-guest-jwt-token')
        setUser(guestProfile)
      }
    } catch (e) {
      console.error('Failed to load stored auth session:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loginWithGoogle = async (credential: string): Promise<GoogleAuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Google sign in failed' }))
      throw new Error(err.detail || `Sign in failed with status ${res.status}`)
    }

    return await res.json()
  }

  const verifyTotp = async (tempToken: string, code: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/auth/verify-totp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token: tempToken, code }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'TOTP verification failed' }))
      throw new Error(err.detail || 'Incorrect 6-digit code')
    }

    const data = await res.json()
    const accessToken = data.access_token
    const profile: UserProfile = {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      role: data.user.role,
      is_guest: data.user.is_guest || false,
    }

    setToken(accessToken)
    setUser(profile)
    localStorage.setItem('kapitl_token', accessToken)
    localStorage.setItem('kapitl_user', JSON.stringify(profile))
  }

  const loginAsGuest = async (redirectTo = '/ipos'): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/guest-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const data = await res.json()
        const accessToken = data.access_token
        const profile: UserProfile = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: 'GUEST',
          is_guest: true,
        }

        setToken(accessToken)
        setUser(profile)
        localStorage.setItem('kapitl_token', accessToken)
        localStorage.setItem('kapitl_user', JSON.stringify(profile))
        if (redirectTo) {
          router.push(redirectTo)
        }
        return
      }
    } catch (e) {
      console.warn('Backend guest-login offline; falling back to client-side guest session:', e)
    }

    // Client-side instant guest fallback
    const guestProfile: UserProfile = {
      id: `guest-${Date.now()}`,
      username: 'Guest Investor',
      email: 'guest@kapitl.internal',
      role: 'GUEST',
      is_guest: true,
    }
    const fallbackToken = 'guest-demo-jwt-token'
    setToken(fallbackToken)
    setUser(guestProfile)
    localStorage.setItem('kapitl_token', fallbackToken)
    localStorage.setItem('kapitl_user', JSON.stringify(guestProfile))
    if (redirectTo) {
      router.push(redirectTo)
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('kapitl_token')
    localStorage.removeItem('kapitl_user')
    router.push('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        isGuest: !!user?.is_guest,
        loginWithGoogle,
        verifyTotp,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
