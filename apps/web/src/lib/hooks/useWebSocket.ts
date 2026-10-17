'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface WebSocketMessage {
  type: string
  payload?: any
  message?: string
  timestamp?: string
  server_time?: number
}

type MessageHandler = (message: WebSocketMessage) => void

export function useWebSocket(onMessage?: MessageHandler) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handlerRef = useRef<MessageHandler | undefined>(onMessage)
  handlerRef.current = onMessage

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return

    // Build the WebSocket URL robustly using the URL API instead of fragile regex.
    // NEXT_PUBLIC_WS_URL takes priority (explicit ws:// URL).
    // Otherwise, derive from NEXT_PUBLIC_API_URL by switching protocol and appending /ws path.
    let wsUrl: string
    const explicitWsUrl = process.env.NEXT_PUBLIC_WS_URL
    if (explicitWsUrl) {
      wsUrl = explicitWsUrl.replace(/\/$/, '') + (explicitWsUrl.endsWith('/ws') ? '' : '/ws')
    } else {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8000')
      try {
        const parsed = new URL(apiUrl)
        parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
        // Strip any existing path (e.g. /api, /api/v1) — the WS endpoint is routed under /api/ws
        parsed.pathname = '/api/ws'
        wsUrl = parsed.toString()
      } catch {
        // Absolute fallback if URL parsing fails
        wsUrl = 'ws://127.0.0.1:8000/api/ws'
      }
    }

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(parsed)
          if (handlerRef.current) {
            handlerRef.current(parsed)
          }
        } catch {
          // Non-JSON message ignored
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      // Reconnect after 5 seconds if initial connection fails
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }
  }, [])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return { isConnected, lastMessage, sendMessage }
}
