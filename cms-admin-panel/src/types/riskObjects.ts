export type RiskObjectStatus = 'active' | 'archived'

export type RiskObject = {
  id: string
  code: string
  name: string
  category: string
  status: RiskObjectStatus
  updatedAt: string
}

export type RiskObjectHistoryEntry = {
  id: string
  changedAt: string
  riskObjectName: string
  description: string
  authorName: string
}

export type RiskObjectHistoryPage = {
  items: RiskObjectHistoryEntry[]
  hasMore: boolean
}

/** Ответ POST при создании рискового объекта из конструктора JSON. */
export type RiskObjectCreateResponse = {
  id: string
  savedAt: string
}

/** Тело POST: наименование отдельно от структуры (definition). */
export type RiskObjectCreatePayload = {
  name: string
  definition: Record<string, unknown>
}

export type RiskObjectDetails = {
  id: string
  code: string
  name: string
  status: RiskObjectStatus
  updatedAt: string
  definition: Record<string, unknown>
}

export type RiskObjectUpdateResponse = {
  id: string
  savedAt: string
}
