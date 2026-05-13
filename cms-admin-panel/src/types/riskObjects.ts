export type RiskObjectStatus = 'active' | 'archived'

export type RiskObject = {
  id: string
  code: string
  name: string
  status: RiskObjectStatus
  updatedAt: string
  /** Собственный флаг сущности в GET /api/risk-objects (не путать с вложенными ссылками). */
  isDeleted?: boolean
}

export type RiskObjectListPage = {
  items: RiskObject[]
  hasMore: boolean
}

export type RiskObjectHistoryEntry = {
  /** Идентификатор записи истории для GET …/risk-objects/change-history/:id (на бэкенде: `roh-<number>`). */
  id: string
  /** Некоторые ответы API отдают идентификатор истории в отдельном поле вместо `id`. */
  historyId?: string
  riskObjectId?: string
  changedAt: string
  /** Наименование объекта на момент записи (в API часто поле `name`). */
  riskObjectName: string
  /** Комментарий к изменению (в API: `changeComment`). */
  changeComment: string
  /** Совместимость со старыми ответами / моками; совпадает с `changeComment` после нормализации. */
  description: string
  authorName: string
  status?: RiskObjectStatus
  departmentId?: string | null
}

export type RiskObjectHistoryDetails = RiskObjectHistoryEntry & {
  riskObjectId: string
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
  departmentId?: string
}

export type RiskObjectUpdatePayload = RiskObjectCreatePayload & {
  changeComment?: string
}

export type RiskObjectDetails = {
  id: string
  uuid: string
  code: string
  name: string
  departmentId?: string
  status: RiskObjectStatus
  updatedAt: string
  definition: Record<string, unknown>
  /** Собственный флаг сущности в GET /api/risk-objects/:id */
  isDeleted?: boolean
}

export type RiskObjectUpdateResponse = {
  id: string
  savedAt: string
}

export type RiskObjectStatusUpdatePayload = {
  status: RiskObjectStatus
}
