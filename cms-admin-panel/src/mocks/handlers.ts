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

let mockIntegrationConfigs = [
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

let mockIntegrationConfigDetails = [
  {
    id: 'ic-1',
    number: 1,
    name: 'Обмен с 1С:Бухгалтерия',
    integrationKind: 'pull',
    endpointUrl: 'https://1c.example.local/api/exchange',
    riskObjectModelId: 'rom-1',
    mapping_rules: [
      { from: 'Ref_Key', to: 'external_id' },
      { from: 'Date', to: 'timestamp', transform: 'date_to_iso' },
    ],
    status: 'active' as const,
    authorName: 'Алексей Иванов',
    updatedAt: '2026-04-11T14:32:00.000Z',
  },
  {
    id: 'ic-2',
    number: 2,
    name: 'REST API: платёжный шлюз',
    integrationKind: 'push',
    endpointUrl: 'https://payments.example.local/v1/hook',
    riskObjectModelId: 'rom-2',
    mapping_rules: [
      { from: 'merchant_id', to: 'external_id' },
      { from: 'created_at', to: 'timestamp', transform: 'date_to_iso' },
    ],
    status: 'active' as const,
    authorName: 'Мария Петрова',
    updatedAt: '2026-04-09T09:15:00.000Z',
  },
  {
    id: 'ic-3',
    number: 3,
    name: 'Webhook: уведомления в Telegram',
    integrationKind: 'broker',
    endpointUrl: 'https://notify.example.local/telegram',
    riskObjectModelId: 'rom-3',
    mapping_rules: [{ from: 'person_id', to: 'external_id' }],
    status: 'inactive' as const,
    authorName: 'Алексей Иванов',
    updatedAt: '2026-03-28T18:00:00.000Z',
  },
  {
    id: 'ic-4',
    number: 4,
    name: 'SFTP: выгрузка отчётов',
    integrationKind: 'pull',
    endpointUrl: 'sftp://reports.example.local/export',
    riskObjectModelId: 'rom-4',
    mapping_rules: [{ from: 'group_id', to: 'group_id' }],
    status: 'inactive' as const,
    authorName: 'Иван Сидоров',
    updatedAt: '2026-04-02T11:45:00.000Z',
  },
  {
    id: 'ic-5',
    number: 5,
    name: 'OAuth2: корпоративный SSO',
    integrationKind: 'push',
    endpointUrl: 'https://sso.example.local/api/sync',
    riskObjectModelId: 'rom-1',
    mapping_rules: [{ from: 'sub', to: 'external_id' }],
    status: 'active' as const,
    authorName: 'Мария Петрова',
    updatedAt: '2026-04-12T08:20:00.000Z',
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

const mockRiskObjectModels = [
  {
    id: 'rom-1',
    name: 'Юридическое лицо',
    definition: {
      Ref_Key: null,
      Date: null,
      external_id: null,
      timestamp: null,
      legal_name: null,
      inn: null,
    },
  },
  {
    id: 'rom-2',
    name: 'Индивидуальный предприниматель',
    definition: {
      inn: null,
      ogrnip: null,
      full_name: null,
      contacts: [{ phone: null, email: null }],
    },
  },
  {
    id: 'rom-3',
    name: 'Физическое лицо',
    definition: {
      passport: null,
      birthDate: null,
      snils: null,
    },
  },
  {
    id: 'rom-4',
    name: 'Группа компаний',
    definition: {
      group_id: null,
      members: [{ role: null, company_code: null }],
    },
  },
]

let integrationDraftCurrent: Record<string, unknown> | null = null

function defaultRiskDefinition(name: string): Record<string, unknown> {
  return {
    external_id: null,
    display_name: null,
    source_name: name,
    attributes: [{ key: null, value: null }],
  }
}

let mockRiskObjects = [
  {
    id: 'ro-1',
    code: 'RO-001',
    name: 'ООО «Вектор»',
    category: 'Контрагент',
    status: 'active' as const,
    updatedAt: '2026-04-12T10:15:00.000Z',
    definition: {
      external_id: null,
      legal_name: null,
      inn: null,
      contacts: [{ phone: null, email: null }],
    },
  },
  {
    id: 'ro-2',
    code: 'RO-002',
    name: 'ИП Соколов',
    category: 'Контрагент',
    status: 'active' as const,
    updatedAt: '2026-04-11T14:40:00.000Z',
    definition: {
      external_id: null,
      fio: null,
      inn: null,
      flags: [{ code: null, value: null }],
    },
  },
  {
    id: 'ro-3',
    code: 'RO-003',
    name: 'АО «Трастфлоу Логистик»',
    category: 'Перевозчик',
    status: 'active' as const,
    updatedAt: '2026-04-10T09:00:00.000Z',
    definition: {
      external_id: null,
      company_name: null,
      route: [{ from: null, to: null }],
    },
  },
  {
    id: 'ro-4',
    code: 'RO-004',
    name: 'ПАО «Северный банк»',
    category: 'Финансовая организация',
    status: 'archived' as const,
    updatedAt: '2026-03-28T16:20:00.000Z',
    definition: {
      external_id: null,
      bank_name: null,
      bic: null,
    },
  },
  {
    id: 'ro-5',
    code: 'RO-005',
    name: 'ООО «Ромашка»',
    category: 'Контрагент',
    status: 'active' as const,
    updatedAt: '2026-04-09T11:30:00.000Z',
    definition: {
      external_id: null,
      short_name: null,
      tags: [{ key: null }],
    },
  },
  {
    id: 'ro-6',
    code: 'RO-006',
    name: 'ГК «Альфа»',
    category: 'Группа',
    status: 'active' as const,
    updatedAt: '2026-04-08T08:45:00.000Z',
    definition: {
      group_id: null,
      group_name: null,
      members: [{ member_id: null, role: null }],
    },
  },
]

const RO_HISTORY_TEMPLATES = [
  {
    riskObjectName: 'ООО «Вектор»',
    description: 'Обновлены реквизиты и контактные лица',
    authorName: 'Алексей Иванов',
  },
  {
    riskObjectName: 'ИП Соколов',
    description: 'Изменена категория риска',
    authorName: 'Мария Петрова',
  },
  {
    riskObjectName: 'АО «Трастфлоу Логистик»',
    description: 'Проверка документов: одобрено',
    authorName: 'Иван Сидоров',
  },
  {
    riskObjectName: 'ПАО «Северный банк»',
    description: 'Объект переведён в архив',
    authorName: 'Мария Петрова',
  },
  {
    riskObjectName: 'ООО «Ромашка»',
    description: 'Добавлена связь с договором',
    authorName: 'Алексей Иванов',
  },
]

function buildMockRiskObjectChangeHistory(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = RO_HISTORY_TEMPLATES[i % RO_HISTORY_TEMPLATES.length]
    const day = 1 + (i % 28)
    const hour = 8 + (i % 11)
    const minute = (i * 9) % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      id: `roh-${i + 1}`,
      changedAt: `2026-04-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`,
      riskObjectName: t.riskObjectName,
      description: `${t.description} (#${i + 1})`,
      authorName: t.authorName,
    }
  })
}

const mockRiskObjectChangeHistory = buildMockRiskObjectChangeHistory(42)

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

  http.get('/api/integration-configs/:id', async ({ request, params }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const row = mockIntegrationConfigDetails.find((it) => it.id === id)
    if (!row) {
      return HttpResponse.json({ message: 'Интеграция не найдена' }, { status: 404 })
    }
    return HttpResponse.json(row)
  }),

  http.put('/api/integration-configs/:id', async ({ request, params }) => {
    await delay(300)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const idx = mockIntegrationConfigDetails.findIndex((it) => it.id === id)
    if (idx < 0) {
      return HttpResponse.json({ message: 'Интеграция не найдена' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const updatedAt = new Date().toISOString()
    const prev = mockIntegrationConfigDetails[idx]
    const next = {
      ...prev,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : prev.name,
      integrationKind:
        body.integrationKind === 'pull' ||
        body.integrationKind === 'push' ||
        body.integrationKind === 'broker'
          ? body.integrationKind
          : prev.integrationKind,
      endpointUrl:
        typeof body.endpointUrl === 'string' && body.endpointUrl.trim()
          ? body.endpointUrl.trim()
          : prev.endpointUrl,
      riskObjectModelId:
        typeof body.riskObjectModelId === 'string' && body.riskObjectModelId.trim()
          ? body.riskObjectModelId.trim()
          : prev.riskObjectModelId,
      mapping_rules: Array.isArray(body.mapping_rules)
        ? body.mapping_rules
        : prev.mapping_rules,
      status:
        body.status === 'active' || body.status === 'inactive'
          ? body.status
          : prev.status,
      authorName: adminUser.name,
      updatedAt,
    }
    mockIntegrationConfigDetails[idx] = next
    mockIntegrationConfigs = mockIntegrationConfigs.map((it) =>
      it.id === id
        ? {
            ...it,
            name: next.name,
            status: next.status,
            authorName: next.authorName,
            updatedAt: next.updatedAt,
          }
        : it,
    )
    return HttpResponse.json({ id, savedAt: updatedAt })
  }),

  http.get('/api/risk-object-models', async ({ request }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const url = new URL(request.url)
    if (url.searchParams.get('empty') === '1') {
      return HttpResponse.json({ items: [] as { id: string; name: string }[] })
    }
    return HttpResponse.json({ items: mockRiskObjectModels })
  }),

  http.post('/api/risk-objects', async ({ request }) => {
    await delay(320)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nameRaw = body.name
    const name =
      typeof nameRaw === 'string' && nameRaw.trim() !== ''
        ? nameRaw.trim()
        : 'Новый рисковый объект'
    const id = `ro-${Date.now()}`
    const n = mockRiskObjects.length + 1
    const code = `RO-${String(n).padStart(3, '0')}`
    const row = {
      id,
      code,
      name,
      category: 'Конструктор',
      status: 'active' as const,
      updatedAt: new Date().toISOString(),
      definition:
        body.definition && typeof body.definition === 'object' && !Array.isArray(body.definition)
          ? (body.definition as Record<string, unknown>)
          : defaultRiskDefinition(name),
    }
    mockRiskObjects = [row, ...mockRiskObjects]
    return HttpResponse.json(
      { id, savedAt: row.updatedAt },
      { status: 201 },
    )
  }),

  http.get('/api/risk-objects', async ({ request }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: mockRiskObjects })
  }),

  http.get('/api/risk-objects/change-history', async ({ request }) => {
    await delay(270)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const url = new URL(request.url)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const rawSize = Number.parseInt(url.searchParams.get('pageSize') ?? '5', 10)
    const pageSize = Math.min(50, Math.max(1, Number.isFinite(rawSize) ? rawSize : 5))

    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    let pool = mockRiskObjectChangeHistory
    if (q) {
      pool = pool.filter(
        (row) =>
          row.riskObjectName.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q) ||
          row.authorName.toLowerCase().includes(q),
      )
    }

    const start = (page - 1) * pageSize
    const items = pool.slice(start, start + pageSize)
    const hasMore = start + items.length < pool.length
    return HttpResponse.json({ items, hasMore })
  }),

  http.get('/api/risk-objects/:id', async ({ request, params }) => {
    await delay(240)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const row = mockRiskObjects.find((r) => r.id === id)
    if (!row) {
      return HttpResponse.json({ message: 'Объект не найден' }, { status: 404 })
    }
    return HttpResponse.json({
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
      updatedAt: row.updatedAt,
      definition:
        row.definition && typeof row.definition === 'object' && !Array.isArray(row.definition)
          ? row.definition
          : defaultRiskDefinition(row.name),
    })
  }),

  http.put('/api/risk-objects/:id', async ({ request, params }) => {
    await delay(300)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const idx = mockRiskObjects.findIndex((r) => r.id === id)
    if (idx < 0) {
      return HttpResponse.json({ message: 'Объект не найден' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nameRaw = body.name
    const nextName =
      typeof nameRaw === 'string' && nameRaw.trim() !== ''
        ? nameRaw.trim()
        : mockRiskObjects[idx].name
    const updatedAt = new Date().toISOString()
    const nextDefinition =
      body.definition && typeof body.definition === 'object' && !Array.isArray(body.definition)
        ? (body.definition as Record<string, unknown>)
        : mockRiskObjects[idx].definition
    mockRiskObjects[idx] = {
      ...mockRiskObjects[idx],
      name: nextName,
      updatedAt,
      definition: nextDefinition,
    }
    return HttpResponse.json({ id, savedAt: updatedAt })
  }),

  http.put('/api/integration-drafts/current', async ({ request }) => {
    await delay(240)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json()) as Record<string, unknown>
    const updatedAt = new Date().toISOString()
    integrationDraftCurrent = {
      ...integrationDraftCurrent,
      ...body,
      updatedAt,
    }
    return HttpResponse.json({
      id: 'draft-current',
      updatedAt,
      ...integrationDraftCurrent,
    })
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
