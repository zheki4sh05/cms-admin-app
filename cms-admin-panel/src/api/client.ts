import { apiUrl } from './baseUrl'
import type {
  IntegrationChangeHistoryPage,
  IntegrationConfig,
  IntegrationConfigListPage,
  IntegrationDeleteResponse,
  IntegrationDetails,
  PullIntegrationConfig,
  PullRequestQueryParam,
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
  RuleChangeHistoryDetails,
  RuleCreatePayload,
  RuleCreateResponse,
  RuleChangeHistoryPage,
  RuleUpdatePayload,
} from '../types/risks'
import type { AccessPermission } from '../types/permissions'
import type { Company } from '../types/company'

const COMPANY_ID_STORAGE_KEY = 'trustflow_company_id'
const REFRESH_ENDPOINT_PATH = '/auth/admin/refresh'

type RefreshAccessTokenHandler = (failedAccessToken: string) => Promise<string | null>

let refreshAccessTokenHandler: RefreshAccessTokenHandler | null = null

export function setRefreshAccessTokenHandler(handler: RefreshAccessTokenHandler | null) {
  refreshAccessTokenHandler = handler
}

const nativeFetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init)

function getHeaderValue(headers: HeadersInit | undefined, key: string): string | null {
  if (!headers) return null
  if (headers instanceof Headers) {
    return headers.get(key)
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([name]) => name.toLowerCase() === key.toLowerCase())
    return pair?.[1] ?? null
  }
  const recordKey = Object.keys(headers).find((name) => name.toLowerCase() === key.toLowerCase())
  return recordKey ? headers[recordKey] ?? null : null
}

function extractBearerToken(headers: HeadersInit | undefined): string | null {
  const raw = getHeaderValue(headers, 'Authorization')
  if (!raw?.startsWith('Bearer ')) return null
  return raw.slice('Bearer '.length).trim() || null
}

function isRefreshRequest(input: RequestInfo | URL): boolean {
  const value =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  return value.includes(REFRESH_ENDPOINT_PATH)
}

async function fetchWithRefresh(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await nativeFetch(input, init)
  if (response.status !== 401 || !refreshAccessTokenHandler || isRefreshRequest(input)) {
    return response
  }

  const failedAccessToken = extractBearerToken(init?.headers)
  if (!failedAccessToken) {
    return response
  }

  let nextAccessToken: string | null = null
  try {
    nextAccessToken = await refreshAccessTokenHandler(failedAccessToken)
  } catch {
    return response
  }

  if (!nextAccessToken) {
    return response
  }

  const retryHeaders = new Headers(init?.headers)
  retryHeaders.set('Authorization', `Bearer ${nextAccessToken}`)
  return nativeFetch(input, { ...init, headers: retryHeaders })
}

const fetch: typeof globalThis.fetch = (input, init) => fetchWithRefresh(input, init)

function getStoredCompanyId(): string | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(COMPANY_ID_STORAGE_KEY)
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

function requireCompanyId(companyId?: string | null): string {
  const effective = companyId?.trim() || getStoredCompanyId()
  if (!effective) {
    throw new Error('Не указан идентификатор компании')
  }
  return effective
}

function authHeaders(token: string | null, companyId?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const effectiveCompanyId = companyId?.trim() || getStoredCompanyId()
  if (effectiveCompanyId) {
    headers.CompanyId = effectiveCompanyId
  }
  return headers
}

function parseDefinitionObject(rawJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawJson) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Ignore malformed JSON and fail below with a unified message.
  }
  throw new Error('Некорректный ответ сервера')
}

function normalizeIntegrationNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeIntegrationStatus(value: unknown): IntegrationDetails['status'] | null {
  return value === 'active' || value === 'inactive' ? value : null
}

function normalizeIntegrationKind(value: unknown): IntegrationDetails['integrationKind'] | null {
  return value === 'pull' || value === 'push' || value === 'broker' ? value : null
}

function normalizeIntegrationMappingRules(value: unknown): IntegrationDetails['mapping_rules'] | null {
  if (!Array.isArray(value)) return null
  const normalized: IntegrationDetails['mapping_rules'] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const obj = item as Record<string, unknown>
    if (typeof obj.from !== 'string' || typeof obj.to !== 'string') continue
    normalized.push({
      from: obj.from,
      to: obj.to,
      ...(typeof obj.transform === 'string' ? { transform: obj.transform } : {}),
    })
  }
  return normalized
}

function normalizePullRequestQueryParams(value: unknown): PullRequestQueryParam[] | null {
  if (!Array.isArray(value)) return null
  const normalized: PullRequestQueryParam[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    if (typeof row.key !== 'string' || typeof row.value !== 'string') continue
    normalized.push({ key: row.key, value: row.value })
  }
  return normalized
}

function normalizePullConfig(value: unknown): PullIntegrationConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const pollingPreset =
    raw.pollingPreset === 'hour' ||
    raw.pollingPreset === 'day' ||
    raw.pollingPreset === 'month' ||
    raw.pollingPreset === 'minutes'
      ? raw.pollingPreset
      : null
  if (!pollingPreset) return null
  if (raw.authType !== 'basic') return null
  const queryParams = normalizePullRequestQueryParams(raw.requestQueryParams)
  return {
    pollingPreset,
    ...(typeof raw.pollingMinutes === 'number' && Number.isFinite(raw.pollingMinutes)
      ? { pollingMinutes: Math.max(1, Math.floor(raw.pollingMinutes)) }
      : {}),
    authType: 'basic',
    ...(typeof raw.authBasicLogin === 'string' ? { authBasicLogin: raw.authBasicLogin } : {}),
    ...(typeof raw.authBasicPassword === 'string'
      ? { authBasicPassword: raw.authBasicPassword }
      : {}),
    ...(typeof raw.requestUri === 'string' ? { requestUri: raw.requestUri } : {}),
    ...(queryParams ? { requestQueryParams: queryParams } : {}),
    ...(typeof raw.pagedPollingEnabled === 'boolean'
      ? { pagedPollingEnabled: raw.pagedPollingEnabled }
      : {}),
    ...(typeof raw.pagingOffsetParamKey === 'string'
      ? { pagingOffsetParamKey: raw.pagingOffsetParamKey }
      : {}),
    ...(typeof raw.pagingLimitParamKey === 'string'
      ? { pagingLimitParamKey: raw.pagingLimitParamKey }
      : {}),
    ...(typeof raw.pageSize === 'number' && Number.isFinite(raw.pageSize)
      ? { pageSize: Math.max(1, Math.floor(raw.pageSize)) }
      : {}),
    ...(typeof raw.sinceStartDateEnabled === 'boolean'
      ? { sinceStartDateEnabled: raw.sinceStartDateEnabled }
      : {}),
  }
}

export async function postLogin(email: string, password: string) {
  const res = await fetch(apiUrl('auth/admin/login'), {
    method: 'POST',
    headers: authHeaders(null),
    body: JSON.stringify({ email, password }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    accessToken?: string
    refreshToken?: string
    user?: unknown
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Ошибка входа')
  }
  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  }
}

export async function postRefreshToken(refreshToken: string) {
  const res = await fetch(apiUrl('auth/admin/refresh'), {
    method: 'POST',
    headers: authHeaders(null),
    body: JSON.stringify({ refreshToken }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    accessToken?: string
    refreshToken?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Сессия истекла')
  }
  if (!data.accessToken || !data.refreshToken) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  }
}

export async function getMe(token: string) {
  const res = await fetch(apiUrl('users/me'), {
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

export async function getCompanyByEmployeeId(
  token: string,
  employeeId: string,
): Promise<Company> {
  const res = await fetch(apiUrl(`companies/by-employee/${employeeId}`), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    name?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Ошибка загрузки компании')
  }
  if (!data.id || !data.name) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    id: data.id,
    name: data.name,
  }
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

export type RiskCategoryDto = {
  id: string
  name: string
}

export type RulePriorityDto = 'low' | 'medium' | 'high'
export type RuleActionDto = 'createIncident' | 'sendNotification'

export type RuleOverrideDto = {
  riskObjectId?: string
  mechanismScriptName?: string
  mechanismScriptContent?: string
  categoryId?: string
  priority?: RulePriorityDto
  responsibleUserId?: string
  actions?: RuleActionDto[]
  enabled?: boolean
}

export type RuleOverridesMapDto = Record<string, RuleOverrideDto>

export type RuleListItemDto = {
  id: string
  name: string
  condition: string
  action: string
  categoryId: string
  categoryLabel: string
  priority: RulePriorityDto
  enabled: boolean
  riskObjectId: string
}

export type RuleDetailsDto = {
  id: string
  companyId: string
  name: string
  condition: string
  categoryId: string
  riskObjectId: string
  priority: RulePriorityDto
  responsibleUserId: string
  actions: RuleActionDto[]
  enabled: boolean
  mechanismScriptName: string
  mechanismScriptContent: string
  createdByUserId: string
  savedAt: string
}

export type RuleRiskObjectOption = {
  id: string
  uuid: string
  code: string
  name: string
  detailsId?: string
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
  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const row = item as Record<string, unknown>
          const number = normalizeIntegrationNumber(row.number)
          const status = normalizeIntegrationStatus(row.status)
          if (
            typeof row.id !== 'string' ||
            number === null ||
            typeof row.name !== 'string' ||
            typeof row.updatedAt !== 'string' ||
            status === null ||
            typeof row.authorName !== 'string'
          ) {
            return null
          }
          return {
            id: row.id,
            number,
            name: row.name,
            updatedAt: row.updatedAt,
            status,
            authorName: row.authorName,
          } satisfies IntegrationConfig
        })
        .filter((item): item is IntegrationConfig => item !== null)
    : []
  return {
    items,
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
  const number = normalizeIntegrationNumber(data.number)
  const integrationKind = normalizeIntegrationKind(data.integrationKind)
  const mappingRules = normalizeIntegrationMappingRules(data.mapping_rules)
  const pullConfig = normalizePullConfig(data.pullConfig)
  const status = normalizeIntegrationStatus(data.status)
  if (
    typeof data.id !== 'string' ||
    number === null ||
    typeof data.name !== 'string' ||
    integrationKind === null ||
    typeof data.endpointUrl !== 'string' ||
    typeof data.riskObjectModelId !== 'string' ||
    mappingRules === null ||
    status === null ||
    typeof data.authorName !== 'string' ||
    typeof data.updatedAt !== 'string'
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    id: data.id,
    number,
    name: data.name,
    integrationKind,
    endpointUrl: data.endpointUrl,
    riskObjectModelId: data.riskObjectModelId,
    mapping_rules: mappingRules,
    ...(pullConfig ? { pullConfig } : {}),
    status,
    authorName: data.authorName,
    updatedAt: data.updatedAt,
  }
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

export async function deleteIntegrationConfigById(
  token: string,
  id: string,
  companyId?: string | null,
): Promise<IntegrationDeleteResponse> {
  const effectiveCompanyId = requireCompanyId(companyId)
  const res = await fetch(apiUrl(`integration-configs/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token, effectiveCompanyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    deletedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось удалить интеграцию')
  }
  if (!data.id || !data.deletedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, deletedAt: data.deletedAt }
}

export async function getUsersList(token: string, companyId?: string | null) {
  const effectiveCompanyId = requireCompanyId(companyId)
  const res = await fetch(apiUrl('users'), {
    headers: authHeaders(token, effectiveCompanyId),
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
  companyId?: string | null,
): Promise<AccessPermission[]> {
  const effectiveCompanyId = requireCompanyId(companyId)
  const res = await fetch(apiUrl(`users/${userId}/access`), {
    headers: authHeaders(token, effectiveCompanyId),
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

/** Права текущего пользователя: `GET /api/users/{userId}/access`. */
export async function getMyPermissions(
  token: string,
  userId: string,
  companyId?: string | null,
): Promise<AccessPermission[]> {
  return getUserAccessPermissions(token, userId, companyId)
}

export async function putUserAccessPermissions(
  token: string,
  userId: string,
  accessPermissions: AccessPermission[],
  companyId?: string | null,
): Promise<AccessPermission[]> {
  const effectiveCompanyId = requireCompanyId(companyId)
  const res = await fetch(apiUrl(`users/${userId}/access`), {
    method: 'PUT',
    headers: authHeaders(token, effectiveCompanyId),
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

export async function putUserStatus(
  token: string,
  userId: string,
  status: 'active' | 'blocked',
): Promise<'active' | 'blocked'> {
  const res = await fetch(apiUrl(`users/${userId}/status`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    status?: 'active' | 'blocked'
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось изменить статус пользователя')
  }
  if (data.status !== 'active' && data.status !== 'blocked') {
    throw new Error('Некорректный ответ сервера')
  }
  return data.status
}

export type UpdateUserPayload = {
  email: string
  firstName: string
  lastName: string
}

export async function putUserById(
  token: string,
  userId: string,
  payload: UpdateUserPayload,
): Promise<void> {
  const res = await fetch(apiUrl(`users/${userId}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось обновить профиль')
  }
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
  companyId?: string | null,
): Promise<RiskObjectListPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  const res = await fetch(`${apiUrl('risk-objects')}?${params.toString()}`, {
    headers: authHeaders(token, companyId),
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

export async function getRisks(token: string, companyId?: string | null): Promise<RiskItem[]> {
  const res = await fetch(apiUrl('risks'), {
    headers: authHeaders(token, companyId),
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

const RFC4122_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function pickStringField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** UUID для riskObjectId в POST /risks — только из полей модели, не из «человеческого» id логического объекта. */
function extractRiskObjectModelPayloadUuid(row: Record<string, unknown>): string {
  const directKeys = [
    'uuid',
    'UUID',
    'Uuid',
    'riskObjectUuid',
    'risk_object_uuid',
    'objectUuid',
    'object_uuid',
    'riskObjectUUID',
  ] as const
  const candidates: string[] = []
  for (const k of directKeys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim())
  }
  const nested =
    row.riskObject && typeof row.riskObject === 'object' && !Array.isArray(row.riskObject)
      ? (row.riskObject as Record<string, unknown>)
      : null
  if (nested) {
    for (const k of directKeys) {
      const v = nested[k]
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim())
    }
  }
  const unique = [...new Set(candidates)]
  const rfc = unique.find((s) => RFC4122_UUID_RE.test(s))
  if (rfc) return rfc
  const explicitUuid = typeof row.uuid === 'string' && row.uuid.trim() ? row.uuid.trim() : ''
  if (explicitUuid) return explicitUuid
  return unique[0] ?? ''
}

function normalizeRuleRiskObjectOptions(items: unknown[]): RuleRiskObjectOption[] {
  return items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const payloadUuid = extractRiskObjectModelPayloadUuid(row)
      const idCandidate =
        pickStringField(row, ['id', 'riskObjectId', 'risk_object_id']) || payloadUuid
      const name =
        pickStringField(row, ['name', 'riskObjectName']) ||
        ''
      if (!payloadUuid || !name) return null
      const code = pickStringField(row, ['code', 'riskObjectCode'])
      return {
        id: idCandidate,
        uuid: payloadUuid,
        code,
        name,
        detailsId: pickStringField(row, ['id', 'riskObjectId']) || idCandidate,
      } satisfies RuleRiskObjectOption
    })
    .filter((item): item is RuleRiskObjectOption => item !== null)
}

export async function getRuleRiskObjects(
  token: string,
  companyId?: string | null,
): Promise<RuleRiskObjectOption[]> {
  const res = await fetch(apiUrl('risk-object-models'), {
    headers: authHeaders(token, companyId),
  })
  const parsed = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: unknown[]
    data?: { items?: unknown[] }
  }
  if (!res.ok) {
    throw new Error(parsed.message ?? 'Не удалось загрузить рисковые объекты')
  }
  const items = parsed.items ?? parsed.data?.items
  if (!Array.isArray(items)) return []
  return normalizeRuleRiskObjectOptions(items)
}

export async function getRulesList(
  token: string,
  companyId?: string | null,
): Promise<RuleListItemDto[]> {
  const res = await fetch(apiUrl('risks'), {
    headers: authHeaders(token, companyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RuleListItemDto[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить правила')
  }
  return (data.items ?? [])
    .map((item) => {
      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.condition !== 'string' ||
        typeof item.action !== 'string' ||
        typeof item.categoryId !== 'string' ||
        typeof item.categoryLabel !== 'string' ||
        (item.priority !== 'low' && item.priority !== 'medium' && item.priority !== 'high') ||
        typeof item.enabled !== 'boolean'
      ) {
        return null
      }
      return {
        ...item,
        riskObjectId: typeof item.riskObjectId === 'string' ? item.riskObjectId : '',
      } satisfies RuleListItemDto
    })
    .filter((item): item is RuleListItemDto => item !== null)
}

export async function getRiskCategories(
  token: string,
  companyId?: string | null,
): Promise<RiskCategoryDto[]> {
  const res = await fetch(apiUrl('risk-categories'), {
    headers: authHeaders(token, companyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskCategoryDto[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить категории риска')
  }
  return (data.items ?? []).filter(
    (item): item is RiskCategoryDto =>
      Boolean(item && typeof item.id === 'string' && typeof item.name === 'string'),
  )
}

export async function postRiskCategoryCreate(
  token: string,
  payload: { name: string },
  companyId?: string | null,
): Promise<RiskCategoryDto> {
  const res = await fetch(apiUrl('risk-categories'), {
    method: 'POST',
    headers: authHeaders(token, companyId),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    name?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось создать категорию риска')
  }
  if (!data.id || !data.name) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, name: data.name }
}

export async function putRiskCategoryById(
  token: string,
  id: string,
  payload: { name: string },
  companyId?: string | null,
): Promise<RiskCategoryDto> {
  const res = await fetch(apiUrl(`risk-categories/${id}`), {
    method: 'PUT',
    headers: authHeaders(token, companyId),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    name?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось обновить категорию риска')
  }
  if (!data.id || !data.name) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, name: data.name }
}

export async function deleteRiskCategoryById(
  token: string,
  id: string,
  companyId?: string | null,
): Promise<void> {
  const res = await fetch(apiUrl(`risk-categories/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token, companyId),
  })
  if (res.status === 204) return
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось удалить категорию риска')
  }
}

export async function getRuleOverrides(
  token: string,
  companyId?: string | null,
): Promise<RuleOverridesMapDto> {
  const res = await fetch(apiUrl('rules/overrides'), {
    headers: authHeaders(token, companyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RuleOverridesMapDto
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить настройки правил')
  }
  if (!data.items || typeof data.items !== 'object' || Array.isArray(data.items)) {
    return {}
  }
  return data.items
}

export async function getRuleById(
  token: string,
  id: string,
  companyId?: string | null,
): Promise<RuleDetailsDto> {
  const res = await fetch(apiUrl(`rules/${id}`), {
    headers: authHeaders(token, companyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
  } & Record<string, unknown>
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить правило')
  }
  const item = data
  const priorityValue = item.priority
  const priority: RulePriorityDto =
    priorityValue === 'low' || priorityValue === 'medium' || priorityValue === 'high'
      ? priorityValue
      : 'medium'
  const actions = Array.isArray(item.actions)
    ? item.actions.filter(
        (value): value is RuleActionDto =>
          value === 'createIncident' || value === 'sendNotification',
      )
    : []
  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.condition !== 'string' ||
    typeof item.categoryId !== 'string' ||
    typeof item.riskObjectId !== 'string'
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  return {
    id: item.id,
    companyId: typeof item.companyId === 'string' ? item.companyId : '',
    name: item.name,
    condition: item.condition,
    categoryId: item.categoryId,
    riskObjectId: item.riskObjectId,
    priority,
    responsibleUserId: typeof item.responsibleUserId === 'string' ? item.responsibleUserId : '',
    actions,
    enabled: typeof item.enabled === 'boolean' ? item.enabled : false,
    mechanismScriptName: typeof item.mechanismScriptName === 'string' ? item.mechanismScriptName : '',
    mechanismScriptContent:
      typeof item.mechanismScriptContent === 'string' ? item.mechanismScriptContent : '',
    createdByUserId: typeof item.createdByUserId === 'string' ? item.createdByUserId : '',
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : '',
  }
}

export async function putRuleOverrideById(
  token: string,
  ruleId: string,
  payload: RuleOverrideDto,
  companyId?: string | null,
): Promise<RuleOverrideDto> {
  const res = await fetch(apiUrl(`rules/overrides/${ruleId}`), {
    method: 'PUT',
    headers: authHeaders(token, companyId),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    item?: RuleOverrideDto
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить настройки правила')
  }
  return data.item ?? {}
}

export async function putRuleRiskObjectById(
  token: string,
  ruleId: string,
  payload: { riskObjectId: string | null },
  companyId?: string | null,
): Promise<{ id: string; riskObjectId: string | null }> {
  const requestBody = {
    riskObjectId: payload.riskObjectId,
  }
  const res = await fetch(apiUrl(`rules/${ruleId}/risk-object`), {
    method: 'PUT',
    headers: authHeaders(token, companyId),
    body: JSON.stringify(requestBody),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    ruleId?: string
    riskObjectId?: string | null
    item?: {
      id?: string
      ruleId?: string
      riskObjectId?: string | null
    }
  }
  if (!res.ok || res.status !== 200) {
    throw new Error(data.message ?? 'Не удалось обновить рисковый объект правила')
  }
  const responseId =
    (typeof data.id === 'string' && data.id) ||
    (typeof data.ruleId === 'string' && data.ruleId) ||
    (typeof data.item?.id === 'string' && data.item.id) ||
    (typeof data.item?.ruleId === 'string' && data.item.ruleId) ||
    ruleId
  const responseRiskObjectId =
    typeof data.riskObjectId === 'string' || data.riskObjectId === null
      ? data.riskObjectId
      : typeof data.item?.riskObjectId === 'string' || data.item?.riskObjectId === null
        ? data.item.riskObjectId
        : payload.riskObjectId
  return { id: responseId, riskObjectId: responseRiskObjectId }
}

export async function putRuleById(
  token: string,
  id: string,
  payload: RuleUpdatePayload,
  companyId?: string | null,
): Promise<RuleCreateResponse> {
  const res = await fetch(apiUrl(`rules/${id}`), {
    method: 'PUT',
    headers: authHeaders(token, companyId),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить правило')
  }
  if (!data.id || !data.savedAt) {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, savedAt: data.savedAt }
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

export async function postRuleCreate(
  token: string,
  payload: RuleCreatePayload,
  companyId?: string | null,
): Promise<RuleCreateResponse> {
  const res = await fetch(apiUrl('risks'), {
    method: 'POST',
    headers: authHeaders(token, companyId),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    savedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось создать правило')
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
  companyId?: string | null,
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
    headers: authHeaders(token, companyId),
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

export async function getRuleChangeHistoryById(
  token: string,
  historyId: string,
  companyId?: string | null,
): Promise<RuleChangeHistoryDetails> {
  const res = await fetch(apiUrl(`rules/change-history/${historyId}`), {
    headers: authHeaders(token, companyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
  } & Partial<RuleChangeHistoryDetails>
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить запись истории')
  }
  if (
    typeof data.id !== 'string' ||
    typeof data.changedAt !== 'string' ||
    typeof data.ruleId !== 'string' ||
    typeof data.ruleName !== 'string' ||
    typeof data.description !== 'string' ||
    typeof data.authorId !== 'string' ||
    typeof data.authorName !== 'string' ||
    typeof data.condition !== 'string' ||
    typeof data.categoryId !== 'string' ||
    typeof data.riskObjectId !== 'string'
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  const actions = Array.isArray(data.actions)
    ? data.actions.filter((value): value is string => typeof value === 'string')
    : []
  return {
    id: data.id,
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    ruleId: data.ruleId,
    changedAt: data.changedAt,
    ruleName: data.ruleName,
    description: data.description,
    authorId: data.authorId,
    authorName: data.authorName,
    condition: data.condition,
    categoryId: data.categoryId,
    riskObjectId: data.riskObjectId,
    priority: typeof data.priority === 'string' ? data.priority : '',
    responsibleUserId: typeof data.responsibleUserId === 'string' ? data.responsibleUserId : '',
    actions,
    enabled: typeof data.enabled === 'boolean' ? data.enabled : false,
    mechanismScriptName: typeof data.mechanismScriptName === 'string' ? data.mechanismScriptName : '',
    mechanismScriptContent:
      typeof data.mechanismScriptContent === 'string' ? data.mechanismScriptContent : '',
    createdByUserId: typeof data.createdByUserId === 'string' ? data.createdByUserId : '',
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
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
    definition?: unknown
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить модель рискового объекта')
  }
  if (!data.id || !data.name || data.definition === undefined || data.definition === null) {
    throw new Error('Некорректный ответ сервера')
  }
  let definition: Record<string, unknown>
  if (typeof data.definition === 'string') {
    definition = parseDefinitionObject(data.definition)
  } else if (typeof data.definition === 'object' && !Array.isArray(data.definition)) {
    definition = data.definition as Record<string, unknown>
  } else {
    throw new Error('Некорректный ответ сервера')
  }
  return { id: data.id, name: data.name, definition }
}

export async function getRiskObjectById(
  token: string,
  id: string,
  companyId?: string | null,
): Promise<RiskObjectDetails> {
  const res = await fetch(apiUrl(`risk-objects/${id}`), {
    headers: authHeaders(token, companyId),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    uuid?: string
    riskObjectUuid?: string
    riskObjectId?: string
    code?: string
    name?: string
    status?: RiskObjectDetails['status']
    updatedAt?: string
    definition?: string
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
    typeof data.definition !== 'string'
  ) {
    throw new Error('Некорректный ответ сервера')
  }
  const uuidCandidate =
    (typeof data.uuid === 'string' && data.uuid.trim()) ||
    (typeof data.riskObjectUuid === 'string' && data.riskObjectUuid.trim()) ||
    (typeof data.riskObjectId === 'string' && data.riskObjectId.trim()) ||
    ''
  if (!uuidCandidate) {
    throw new Error('Не удалось получить UUID рискового объекта')
  }
  const definition = parseDefinitionObject(data.definition)
  return {
    id: data.id,
    uuid: uuidCandidate,
    code: data.code,
    name: data.name,
    status: data.status,
    updatedAt: data.updatedAt,
    definition,
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

