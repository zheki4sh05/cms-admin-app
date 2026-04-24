export type WebSocketClientType = 'employee' | 'admin'

export type WebSocketConnectionPayload = {
  connection: 'ok'
  heartbeatIntervalMs: number
  reconnectBackoffMs: number[]
}

export type WebSocketUpdateBase = {
  userId: string
  companyId: string
  valueType: 'counter' | 'text'
  clientType: WebSocketClientType
  moduleType: string
}

export type CounterUpdatePayload = WebSocketUpdateBase & {
  valueType: 'counter'
  number: number
  data?: Record<string, unknown>
}

export type TextUpdatePayload = WebSocketUpdateBase & {
  valueType: 'text'
  data: unknown
}

export type WebSocketEventMap = {
  connection: WebSocketConnectionPayload
  'counter:update': CounterUpdatePayload
  'text:update': TextUpdatePayload
}
