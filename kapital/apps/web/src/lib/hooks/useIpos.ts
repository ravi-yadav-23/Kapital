'use client'

import { useState, useEffect, useCallback } from 'react'
import { Ipo } from '@/types'
import { apiClient } from '@/lib/api-client'
import { useWebSocket } from './useWebSocket'

interface UseIposOptions {
  status?: string
  refreshInterval?: number // In ms, default 60000 (1 minute)
}

export function useIpos({ status, refreshInterval = 60000 }: UseIposOptions = {}) {
  const [ipos, setIpos] = useState<Ipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIpos = useCallback(async () => {
    try {
      setError(null)
      const data = await apiClient.getIpos(status)
      setIpos(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch IPOs')
    } finally {
      setLoading(false)
    }
  }, [status])

  // Initial load and polling
  useEffect(() => {
    fetchIpos()

    if (refreshInterval > 0) {
      const interval = setInterval(fetchIpos, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchIpos, refreshInterval])

  // Real-time WebSocket refresh trigger on IPOS_SYNCED
  const handleWsMessage = useCallback((msg: { type: string }) => {
    if (msg.type === 'IPOS_SYNCED') {
      fetchIpos()
    }
  }, [fetchIpos])

  const { isConnected } = useWebSocket(handleWsMessage)

  return {
    ipos,
    loading,
    error,
    refetch: fetchIpos,
    isRealTimeConnected: isConnected,
  }
}
