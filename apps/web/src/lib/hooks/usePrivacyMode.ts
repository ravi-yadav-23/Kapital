'use client'

import { useState, useEffect, useCallback } from 'react'

export function usePrivacyMode() {
  const [isPrivacyActive, setIsPrivacyActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('kapitl_privacy_mode') === 'true'
  })

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setIsPrivacyActive(customEvent.detail.enabled)
      } else if (typeof window !== 'undefined') {
        setIsPrivacyActive(localStorage.getItem('kapitl_privacy_mode') === 'true')
      }
    }

    window.addEventListener('kapitl:privacy-toggle', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('kapitl:privacy-toggle', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyActive((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('kapitl_privacy_mode', String(next))
        window.dispatchEvent(
          new CustomEvent('kapitl:privacy-toggle', { detail: { enabled: next } })
        )
      }
      return next
    })
  }, [])

  return { isPrivacyActive, togglePrivacyMode }
}
