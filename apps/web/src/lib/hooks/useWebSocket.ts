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

    // Derive WS URL from NEXT_PUBLIC_API_URL or current host
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'
    const wsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/api$/, '') + '/api/ws'

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
