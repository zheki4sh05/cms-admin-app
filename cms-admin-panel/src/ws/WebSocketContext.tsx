import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Socket } from 'socket.io-client'
import { useAuth } from '../auth/AuthContext'

import {
  createWebSocketConnection,
  resolveWebSocketClientType,
} from './client'
import type {
  CounterUpdatePayload,
  TextUpdatePayload,
  WebSocketClientType,
  WebSocketConnectionPayload,
} from './types'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

type WebSocketContextValue = {
  status: ConnectionStatus
  socketId: string | null
  clientType: WebSocketClientType | null
  handshake: WebSocketConnectionPayload | null
  lastCounterUpdate: CounterUpdatePayload | null
  lastTextUpdate: TextUpdatePayload | null
  lastError: string | null
  onCounterUpdate: (handler: (payload: CounterUpdatePayload) => void) => () => void
  onTextUpdate: (handler: (payload: TextUpdatePayload) => void) => () => void
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const counterListenersRef = useRef(new Set<(payload: CounterUpdatePayload) => void>())
  const textListenersRef = useRef(new Set<(payload: TextUpdatePayload) => void>())

  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [socketId, setSocketId] = useState<string | null>(null)
  const [clientType, setClientType] = useState<WebSocketClientType | null>(null)
  const [handshake, setHandshake] = useState<WebSocketConnectionPayload | null>(null)
  const [lastCounterUpdate, setLastCounterUpdate] = useState<CounterUpdatePayload | null>(null)
  const [lastTextUpdate, setLastTextUpdate] = useState<TextUpdatePayload | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    const activeSocket = socketRef.current
    if (activeSocket) {
      activeSocket.disconnect()
      socketRef.current = null
    }
    setSocketId(null)
    setHandshake(null)
    setLastError(null)
    setStatus('disconnected')

    if (!token) {
      setClientType(null)
      return
    }

    const resolvedClientType = resolveWebSocketClientType(user)
    setClientType(resolvedClientType)
    setStatus('connecting')
    const socket = createWebSocketConnection(token, resolvedClientType)
    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('connected')
      setSocketId(socket.id ?? null)
      setLastError(null)
    })

    socket.on('connection', (payload) => {
      setHandshake(payload)
    })

    socket.on('counter:update', (payload) => {
      setLastCounterUpdate(payload)
      counterListenersRef.current.forEach((listener) => {
        listener(payload)
      })
    })

    socket.on('text:update', (payload) => {
      setLastTextUpdate(payload)
      textListenersRef.current.forEach((listener) => {
        listener(payload)
      })
    })

    socket.on('disconnect', () => {
      setStatus('disconnected')
      setSocketId(null)
    })

    socket.on('connect_error', (error) => {
      setLastError(error.message)
      setStatus('disconnected')
    })

    return () => {
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [token, user])

  const onCounterUpdate = useCallback((handler: (payload: CounterUpdatePayload) => void) => {
    counterListenersRef.current.add(handler)
    return () => {
      counterListenersRef.current.delete(handler)
    }
  }, [])

  const onTextUpdate = useCallback((handler: (payload: TextUpdatePayload) => void) => {
    textListenersRef.current.add(handler)
    return () => {
      textListenersRef.current.delete(handler)
    }
  }, [])

  const value = useMemo<WebSocketContextValue>(
    () => ({
      status,
      socketId,
      clientType,
      handshake,
      lastCounterUpdate,
      lastTextUpdate,
      lastError,
      onCounterUpdate,
      onTextUpdate,
    }),
    [
      status,
      socketId,
      clientType,
      handshake,
      lastCounterUpdate,
      lastTextUpdate,
      lastError,
      onCounterUpdate,
      onTextUpdate,
    ],
  )

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) {
    throw new Error('useWebSocket must be used within WebSocketProvider')
  }
  return ctx
}
