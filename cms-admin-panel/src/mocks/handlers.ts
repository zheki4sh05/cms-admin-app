import { delay, http, HttpResponse } from 'msw'
import type { AppUser } from '../types/user'

const MOCK_TOKEN = 'mock-trustflow-admin-token'

const adminUser: AppUser = {
  id: '1',
  name: 'Алексей Иванов',
  email: 'admin@trustflow.local',
  role: 'admin',
}

const mockUsers: Array<{
  id: string
  name: string
  email: string
  status: string
  createdAt: string
}> = [
  {
    id: '101',
    name: 'ООО «Ромашка»',
    email: 'contact@romashka.example',
    status: 'active',
    createdAt: '2026-03-12',
  },
  {
    id: '102',
    name: 'ИП Сидоров',
    email: 'sidorov@example.com',
    status: 'pending',
    createdAt: '2026-04-01',
  },
  {
    id: '103',
    name: 'Trustflow Demo',
    email: 'demo@trustflow.local',
    status: 'active',
    createdAt: '2026-04-10',
  },
]

const mockIntegrationConfigs = [
  {
    id: 'ic-1',
    number: 1,
    name: 'Обмен с 1С:Бухгалтерия',
    updatedAt: '2026-04-11T14:32:00.000Z',
    status: 'active' as const,
    authorName: 'Алексей Иванов',
  },
  {
    id: 'ic-2',
    number: 2,
    name: 'REST API: платёжный шлюз',
    updatedAt: '2026-04-09T09:15:00.000Z',
    status: 'active' as const,
    authorName: 'Мария Петрова',
  },
  {
    id: 'ic-3',
    number: 3,
    name: 'Webhook: уведомления в Telegram',
    updatedAt: '2026-03-28T18:00:00.000Z',
    status: 'inactive' as const,
    authorName: 'Алексей Иванов',
  },
  {
    id: 'ic-4',
    number: 4,
    name: 'SFTP: выгрузка отчётов',
    updatedAt: '2026-04-02T11:45:00.000Z',
    status: 'inactive' as const,
    authorName: 'Иван Сидоров',
  },
  {
    id: 'ic-5',
    number: 5,
    name: 'OAuth2: корпоративный SSO',
    updatedAt: '2026-04-12T08:20:00.000Z',
    status: 'active' as const,
    authorName: 'Мария Петрова',
  },
]

const HISTORY_TEMPLATES = [
  {
    configName: 'OAuth2: корпоративный SSO',
    description: 'Обновлены параметры подключения',
    authorName: 'Мария Петрова',
  },
  {
    configName: 'REST API: платёжный шлюз',
    description: 'Изменён таймаут и резервный endpoint',
    authorName: 'Алексей Иванов',
  },
  {
    configName: 'Обмен с 1С:Бухгалтерия',
    description: 'Проверка соединения / синхронизация',
    authorName: 'Алексей Иванов',
  },
  {
    configName: 'Webhook: уведомления в Telegram',
    description: 'URL, подпись или статус конфигурации',
    authorName: 'Иван Сидоров',
  },
  {
    configName: 'SFTP: выгрузка отчётов',
    description: 'Каталог, ключ или расписание',
    authorName: 'Мария Петрова',
  },
] as const

function buildMockIntegrationChangeHistory(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = HISTORY_TEMPLATES[i % HISTORY_TEMPLATES.length]
    const day = 1 + (i % 28)
    const hour = 7 + (i % 12)
    const minute = (i * 11) % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      id: `hist-${i + 1}`,
      changedAt: `2026-04-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`,
      configName: t.configName,
      description: `${t.description} (#${i + 1})`,
      authorName: t.authorName,
    }
  })
}

/** Достаточно страниц для демонстрации бесконечной прокрутки (по 5 записей). */
const mockIntegrationChangeHistory = buildMockIntegrationChangeHistory(48)

function parseAuth(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(450)
    const body = (await request.json()) as {
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ''

    if (email === adminUser.email.toLowerCase() && password === 'admin123') {
      return HttpResponse.json({
        accessToken: MOCK_TOKEN,
        user: adminUser,
      })
    }

    return HttpResponse.json(
      { message: 'Неверный email или пароль' },
      { status: 401 },
    )
  }),

  http.get('/api/me', async ({ request }) => {
    await delay(200)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json(adminUser)
  }),

  http.get('/api/dashboard/summary', async ({ request }) => {
    await delay(350)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({
      visitsToday: 1284,
      activeUsers: 42,
      openTickets: 7,
      revenueWeek: 184_500,
    })
  }),

  http.get('/api/users', async ({ request }) => {
    await delay(400)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: mockUsers })
  }),

  http.get('/api/settings', async ({ request }) => {
    await delay(250)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({
      notificationsEmail: true,
      maintenanceMode: false,
      apiRegion: 'eu-central',
    })
  }),

  http.get('/api/integration-configs', async ({ request }) => {
    await delay(320)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: mockIntegrationConfigs })
  }),

  http.get('/api/integration-configs/change-history', async ({ request }) => {
    await delay(280)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const url = new URL(request.url)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const rawSize = Number.parseInt(url.searchParams.get('pageSize') ?? '5', 10)
    const pageSize = Math.min(50, Math.max(1, Number.isFinite(rawSize) ? rawSize : 5))

    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    let pool = mockIntegrationChangeHistory
    if (q) {
      pool = pool.filter(
        (row) =>
          row.configName.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q) ||
          row.authorName.toLowerCase().includes(q),
      )
    }
    // Прочие query-параметры зарезервированы под фильтры (обработку добавим по ТЗ).

    const start = (page - 1) * pageSize
    const items = pool.slice(start, start + pageSize)
    const hasMore = start + items.length < pool.length
    return HttpResponse.json({ items, hasMore })
  }),

  http.put('/api/settings', async ({ request }) => {
    await delay(500)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      notificationsEmail: Boolean(body.notificationsEmail),
      maintenanceMode: Boolean(body.maintenanceMode),
      apiRegion: String(body.apiRegion ?? 'eu-central'),
    })
  }),
]
