import { apiUrl } from './baseUrl'
import type {
  IntegrationChangeHistoryPage,
  IntegrationConfig,
  IntegrationConfigListPage,
  IntegrationDetails,
  IntegrationStatusUpdatePayload,
  IntegrationUpdatePayload,
  IntegrationUpdateResponse,
} from '../types/integration'
import type {
  RiskObject,
  RiskObjectCreatePayload,
  RiskObjectCreateResponse,
  RiskObjectDetails,
  RiskObjectHistoryDetails,
  RiskObjectHistoryPage,
  RiskObjectListPage,
  RiskObjectStatusUpdatePayload,
  RiskObjectUpdatePayload,
  RiskObjectUpdateResponse,
} from '../types/riskObjects'
import type { RiskObjectModel, RiskObjectModelListItem } from '../types/integrationDraft'
import type {
  RiskCreatePayload,
  RiskCreateResponse,
  RiskItem,
  RuleChangeHistoryPage,
} from '../types/risks'
import type { AccessPermission } from '../types/permissions'

const COMPANY_ID_STORAGE_KEY = 'trustflow_company_id'

function getStoredCompanyId(): string | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(COMPANY_ID_STORAGE_KEY)
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

function authHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const companyId = getStoredCompanyId()
  if (companyId) {
    headers.CompanyId = companyId
  }
  return headers
}

export async function postLogin(email: string, password: string) {
  const res = await fetch(apiUrl('auth/login'), {
    method: 'POST',
    headers: authHeaders(null),
    body: JSON.stringify({ email, password }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    accessToken?: string
    user?: unknown
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Ошибка входа')
  }
  if (!data.accessToken || !data.user) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    accessToken: data.accessToken,
    user: data.user,
  }
}

export async function getMe(token: string) {
  const res = await fetch(apiUrl('me'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Ошибка загрузки профиля')
  }
  return data
}

export async function getMyPermissions(token: string): Promise<AccessPermission[]> {
  const res = await fetch(apiUrl('me/permissions'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: AccessPermission[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Ошибка загрузки прав доступа')
  }
  return data.items ?? []
}

export async function getDashboardSummary(token: string) {
  const res = await fetch(apiUrl('dashboard/summary'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить данные')
  }
  return data as {
    visitsToday: number
    activeUsers: number
    openTickets: number
    revenueWeek: number
  }
}

export type IntegrationChangeHistoryQuery = {
  /** Поиск по подстроке (наименование, описание, автор). */
  q?: string
  /** Доп. фильтры — передаются как query-параметры (ключи уточнятся позже). */
  filters?: Record<string, string>
}

export async function getIntegrationChangeHistory(
  token: string,
  page: number,
  pageSize: number,
  options?: IntegrationChangeHistoryQuery,
): Promise<IntegrationChangeHistoryPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const trimmed = options?.q?.trim()
  if (trimmed) params.set('q', trimmed)
  if (options?.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value) params.set(key, value)
    }
  }
  const res = await fetch(
    `${apiUrl('integration-configs/change-history')}?${params.toString()}`,
    {
      headers: authHeaders(token),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: IntegrationChangeHistoryPage['items']
    hasMore?: boolean
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить историю')
  }
  return {
    items: data.items ?? [],
    hasMore: Boolean(data.hasMore),
  }
}

export async function getIntegrationConfigs(
  token: string,
  page: number,
  pageSize: number,
): Promise<IntegrationConfigListPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const res = await fetch(`${apiUrl('integration-configs')}?${params.toString()}`, {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: IntegrationConfig[]
    hasMore?: boolean
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить конфигурации')
  }
  return {
    items: (data.items ?? []) as IntegrationConfig[],
    hasMore: Boolean(data.hasMore),
  }
}

export async function getIntegrationConfigById(
  token: string,
  id: string,
): Promise<IntegrationDetails> {
  const res = await fetch(apiUrl(`integration-configs/${id}`), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
  } & Partial<IntegrationDetails>
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить интеграцию')
  }
  if (
    !data.id ||
    typeof data.number !== 'number' ||
    !data.name ||
    !data.integrationKind ||
    !data.endpointUrl ||
    !data.riskObjectModelId ||
    !Array.isArray(data.mapping_rules) ||
    !data.status ||
    !data.authorName ||
    !data.updatedAt
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  return data as IntegrationDetails
}

export async function putIntegrationConfigById(
  token: string,
  id: string,
  payload: IntegrationUpdatePayload,
): Promise<IntegrationUpdateResponse> {
  const res = await fetch(apiUrl(`integration-configs/${id}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить интеграцию')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function postIntegrationConfigCreate(
  token: string,
  payload: IntegrationUpdatePayload,
): Promise<IntegrationUpdateResponse> {
  const res = await fetch(apiUrl('integration-configs'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось создать интеграцию')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function putIntegrationConfigStatusById(
  token: string,
  id: string,
  payload: IntegrationStatusUpdatePayload,
): Promise<IntegrationUpdateResponse> {
  const res = await fetch(apiUrl(`integration-configs/${id}/status`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось обновить статус интеграции')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function getUsersList(token: string) {
  const res = await fetch(apiUrl('users'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: unknown[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить список')
  }
  return data.items ?? []
}

export async function getUserAccessPermissions(
  token: string,
  userId: string,
): Promise<AccessPermission[]> {
  const res = await fetch(apiUrl(`users/${userId}/access`), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    accessPermissions?: AccessPermission[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить доступы пользователя')
  }
  return data.accessPermissions ?? []
}

export async function putUserAccessPermissions(
  token: string,
  userId: string,
  accessPermissions: AccessPermission[],
): Promise<AccessPermission[]> {
  const res = await fetch(apiUrl(`users/${userId}/access`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ accessPermissions }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    accessPermissions?: AccessPermission[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить доступы пользователя')
  }
  return data.accessPermissions ?? []
}

export async function getSettings(token: string) {
  const res = await fetch(apiUrl('settings'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить настройки')
  }
  return data as {
    notificationsEmail: boolean
    maintenanceMode: boolean
    apiRegion: string
  }
}

export async function putSettings(
  token: string,
  payload: {
    notificationsEmail: boolean
    maintenanceMode: boolean
    apiRegion: string
  },
) {
  const res = await fetch(apiUrl('settings'), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить')
  }
  return data as {
    notificationsEmail: boolean
    maintenanceMode: boolean
    apiRegion: string
  }
}

export async function postRiskObjectCreate(
  token: string,
  payload: RiskObjectCreatePayload,
): Promise<RiskObjectCreateResponse> {
  const res = await fetch(apiUrl('risk-objects'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function getRiskObjects(
  token: string,
  page: number,
  pageSize: number,
): Promise<RiskObjectListPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const res = await fetch(`${apiUrl('risk-objects')}?${params.toString()}`, {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskObject[]
    hasMore?: boolean
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить рисковые объекты')
  }
  return {
    items: (data.items ?? []) as RiskObject[],
    hasMore: Boolean(data.hasMore),
  }
}

export async function getRisks(token: string): Promise<RiskItem[]> {
  const res = await fetch(apiUrl('risks'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskItem[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить риски')
  }
  return data.items ?? []
}

export async function postRiskCreate(
  token: string,
  payload: RiskCreatePayload,
): Promise<RiskCreateResponse> {
  const res = await fetch(apiUrl('risks'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось создать правило риска')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function getRulesChangeHistory(
  token: string,
  page: number,
  pageSize: number,
  options?: IntegrationChangeHistoryQuery,
): Promise<RuleChangeHistoryPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const trimmed = options?.q?.trim()
  if (trimmed) params.set('q', trimmed)
  if (options?.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value) params.set(key, value)
    }
  }
  const res = await fetch(`${apiUrl('rules/change-history')}?${params.toString()}`, {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RuleChangeHistoryPage['items']
    hasMore?: boolean
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить историю')
  }
  return {
    items: data.items ?? [],
    hasMore: Boolean(data.hasMore),
  }
}

export async function getRiskObjectModels(token: string): Promise<RiskObjectModelListItem[]> {
  const res = await fetch(apiUrl('risk-object-models'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskObjectModelListItem[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить модели рисковых объектов')
  }
  return data.items ?? []
}

export async function getRiskObjectModelById(token: string, id: string): Promise<RiskObjectModel> {
  const res = await fetch(apiUrl(`risk-object-models/${id}`), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    name?: string
    definition?: Record<string, unknown>
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить модель рискового объекта')
  }
  if (!data.id || !data.name || !data.definition) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, name: data.name, definition: data.definition }
}

export async function getRiskObjectById(
  token: string,
  id: string,
): Promise<RiskObjectDetails> {
  const res = await fetch(apiUrl(`risk-objects/${id}`), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    code?: string
    name?: string
    status?: RiskObjectDetails['status']
    updatedAt?: string
    definition?: Record<string, unknown>
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить рисковый объект')
  }
  if (
    !data.id ||
    !data.code ||
    !data.name ||
    !data.status ||
    !data.updatedAt ||
    !data.definition
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    status: data.status,
    updatedAt: data.updatedAt,
    definition: data.definition,
  }
}

export async function putRiskObjectById(
  token: string,
  id: string,
  payload: RiskObjectUpdatePayload,
): Promise<RiskObjectUpdateResponse> {
  const res = await fetch(apiUrl(`risk-objects/${id}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function putRiskObjectStatusById(
  token: string,
  id: string,
  payload: RiskObjectStatusUpdatePayload,
): Promise<RiskObjectUpdateResponse> {
  const res = await fetch(apiUrl(`risk-objects/${id}/status`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось обновить статус')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
}

export async function getRiskObjectsChangeHistory(
  token: string,
  page: number,
  pageSize: number,
  options?: IntegrationChangeHistoryQuery,
): Promise<RiskObjectHistoryPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const trimmed = options?.q?.trim()
  if (trimmed) params.set('q', trimmed)
  if (options?.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value) params.set(key, value)
    }
  }
  const res = await fetch(
    `${apiUrl('risk-objects/change-history')}?${params.toString()}`,
    {
      headers: authHeaders(token),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskObjectHistoryPage['items']
    hasMore?: boolean
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить историю')
  }
  return {
    items: data.items ?? [],
    hasMore: Boolean(data.hasMore),
  }
}

export async function getRiskObjectChangeHistoryById(
  token: string,
  historyId: string,
): Promise<RiskObjectHistoryDetails> {
  const res = await fetch(apiUrl(`risk-objects/change-history/${historyId}`), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    riskObjectId?: string
    changedAt?: string
    riskObjectName?: string
    description?: string
    authorName?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить запись истории')
  }
  if (
    !data.id ||
    !data.riskObjectId ||
    !data.changedAt ||
    !data.riskObjectName ||
    !data.description ||
    !data.authorName
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    id: data.id,
    riskObjectId: data.riskObjectId,
    changedAt: data.changedAt,
    riskObjectName: data.riskObjectName,
    description: data.description,
    authorName: data.authorName,
  }
}

