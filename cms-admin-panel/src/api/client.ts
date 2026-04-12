import { apiUrl } from './baseUrl'
import type {
  IntegrationChangeHistoryPage,
  IntegrationConfig,
} from '../types/integration'
import type {
  IntegrationDraftPayload,
  IntegrationDraftSaveResponse,
  RiskObjectModel,
} from '../types/integrationDraft'
import type {
  RiskObject,
  RiskObjectCreatePayload,
  RiskObjectCreateResponse,
  RiskObjectHistoryPage,
} from '../types/riskObjects'

function authHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
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

export async function getIntegrationConfigs(token: string) {
  const res = await fetch(apiUrl('integration-configs'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: IntegrationConfig[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить конфигурации')
  }
  return (data.items ?? []) as IntegrationConfig[]
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

export async function getRiskObjectModels(token: string): Promise<RiskObjectModel[]> {
  const res = await fetch(apiUrl('risk-object-models'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskObjectModel[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить модели')
  }
  return data.items ?? []
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

export async function getRiskObjects(token: string): Promise<RiskObject[]> {
  const res = await fetch(apiUrl('risk-objects'), {
    headers: authHeaders(token),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    items?: RiskObject[]
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось загрузить рисковые объекты')
  }
  return (data.items ?? []) as RiskObject[]
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

export async function putIntegrationDraftCurrent(
  token: string,
  payload: IntegrationDraftPayload,
): Promise<IntegrationDraftSaveResponse> {
  const res = await fetch(apiUrl('integration-drafts/current'), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    id?: string
    updatedAt?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Не удалось сохранить черновик')
  }
  if (!data.id || !data.updatedAt) {
    throw new Error('Некорректный ответ при сохранении черновика')
  }
  return { id: data.id, updatedAt: data.updatedAt }
}
