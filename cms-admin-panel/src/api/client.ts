import { apiUrl } from './baseUrl'
import type {
  IntegrationChangeHistoryPage,
  IntegrationConfig,
} from '../types/integration'

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
