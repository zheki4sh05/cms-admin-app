import { io, type Socket } from 'socket.io-client'
import type { AppUser } from '../types/user'

import type { WebSocketClientType, WebSocketEventMap } from './types'

type WsServerToClientEvents = {
  [K in keyof WebSocketEventMap]: (payload: WebSocketEventMap[K]) => void
} & {
  connect: () => void
  disconnect: (reason: string) => void
  connect_error: (error: Error) => void
}

type WsClientToServerEvents = Record<string, never>

const DEFAULT_WS_BASE_URL = 'http://localhost:8082'

function inferClientType(user: AppUser | null): WebSocketClientType {
  const role = user?.role?.trim().toLowerCase() ?? ''
  if (role.includes('employee')) return 'employee'
  return 'admin'
}

export function getWebSocketBaseUrl(): string {
  const raw = import.meta.env.VITE_WS_BASE_URL?.trim()
  if (!raw) return DEFAULT_WS_BASE_URL
  return raw.replace(/\/$/, '')
}

export function resolveWebSocketClientType(user: AppUser | null): WebSocketClientType {
  const fromEnv = import.meta.env.VITE_WS_CLIENT_TYPE?.trim().toLowerCase()
  if (fromEnv === 'employee' || fromEnv === 'admin') {
    return fromEnv
  }
  return inferClientType(user)
}

export function createWebSocketConnection(
  accessToken: string,
  clientType: WebSocketClientType,
): Socket<WsServerToClientEvents, WsClientToServerEvents> {
  return io(getWebSocketBaseUrl(), {
    path: '/ws',
    transports: ['websocket'],
    query: {
      access_token: accessToken,
      client_type: clientType,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 20000,
    randomizationFactor: 0,
  })
}
