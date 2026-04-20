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
  RuleCreatePayload,
  RuleCreateResponse,
  RuleChangeHistoryPage,
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

function normalizeRuleRiskObjectOptions(items: unknown[]): RuleRiskObjectOption[] {
  return items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const uuidCandidate =
        (typeof row.uuid === 'string' && row.uuid.trim()) ||
        (typeof row.riskObjectUuid === 'string' && row.riskObjectUuid.trim()) ||
        (typeof row.risk_object_uuid === 'string' && row.risk_object_uuid.trim()) ||
        (typeof row.id === 'string' && row.id.trim()) ||
        ''
      const idCandidate =
        (typeof row.id === 'string' && row.id.trim()) ||
        (typeof row.riskObjectId === 'string' && row.riskObjectId.trim()) ||
        (typeof row.risk_object_id === 'string' && row.risk_object_id.trim()) ||
        uuidCandidate
      const name =
        (typeof row.name === 'string' && row.name.trim()) ||
        (typeof row.riskObjectName === 'string' && row.riskObjectName.trim()) ||
        ''
      if (!uuidCandidate || !idCandidate || !name) return null
      const code =
        (typeof row.code === 'string' && row.code.trim()) ||
        (typeof row.riskObjectCode === 'string' && row.riskObjectCode.trim()) ||
        ''
      return {
        id: idCandidate,
        uuid: uuidCandidate,
        code,
        name,
        detailsId: idCandidate,
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
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: unknown[]
  }
  if (!res.ok) {
    if (res.status === 404) {
      const legacy = await getRiskObjects(token, 1, 500, companyId)
      return legacy.items.map((item) => ({
        id: item.id,
        uuid: item.id,
        code: item.code,
        name: item.name,
        detailsId: item.id,
      }))
    }
    throw new Error(data.message ?? 'Не удалось загрузить рисковые объекты')
  }
  if (!Array.isArray(data.items)) return []
  const normalized = normalizeRuleRiskObjectOptions(data.items)
  if (normalized.length > 0 || data.items.length === 0) return normalized
  const legacy = await getRiskObjects(token, 1, 500, companyId)
  return legacy.items.map((item) => ({
    id: item.id,
    uuid: item.id,
    code: item.code,
    name: item.name,
    detailsId: item.id,
  }))
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
  return (data.items ?? []).filter(
    (item): item is RuleListItemDto =>
      Boolean(
        item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.condition === 'string' &&
          typeof item.action === 'string' &&
          typeof item.categoryId === 'string' &&
          typeof item.categoryLabel === 'string' &&
          (item.priority === 'low' || item.priority === 'medium' || item.priority === 'high') &&
          typeof item.enabled === 'boolean' &&
          typeof item.riskObjectId === 'string',
      ),
  )
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
  const definition = parseDefinitionObject(data.definition)
  return {
    id: data.id,
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

