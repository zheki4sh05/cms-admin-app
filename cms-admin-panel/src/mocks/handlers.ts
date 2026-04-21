import { delay, http, HttpResponse } from 'msw'
import type { AccessPermission } from '../types/permissions'
import type { AppUser } from '../types/user'

let MOCK_TOKEN = 'mock-trustflow-admin-token'
let MOCK_REFRESH_TOKEN = 'mock-trustflow-admin-refresh-token'
let mockTokenVersion = 0

function issueMockTokens() {
  mockTokenVersion += 1
  MOCK_TOKEN = `mock-trustflow-admin-token-${mockTokenVersion}`
  MOCK_REFRESH_TOKEN = `mock-trustflow-admin-refresh-token-${mockTokenVersion}`
  return {
    accessToken: MOCK_TOKEN,
    refreshToken: MOCK_REFRESH_TOKEN,
  }
}

const adminUser: AppUser = {
  id: '1',
  name: 'Алексей Иванов',
  firstName: 'Алексей',
  lastName: 'Иванов',
  email: 'admin@trustflow.local',
  role: 'admin',
  companyId: 'company-trustflow-001',
}

const adminPermissions: AccessPermission[] = [
  'view_all_pages',
  'view_dashboard_page',
  'view_users_page',
  'view_risk_objects_page',
  'view_integrations_page',
  'view_rules_and_risks_page',
  'view_settings_page',
  'view_profile_page',
  'edit_users',
  'manage_risk_objects',
  'manage_integrations',
  'manage_rules_and_risks',
]

const managerUser: AppUser = {
  id: '101',
  name: 'Алексей Иванов',
  firstName: 'Алексей',
  lastName: 'Иванов',
  email: 'manager@trustflow.local',
  role: 'manager',
  companyId: 'company-trustflow-001',
}

const managerPermissions: AccessPermission[] = [
  'view_dashboard_page',
  'view_users_page',
  'view_risk_objects_page',
  'view_profile_page',
  'edit_users',
  'manage_risk_objects',
]

const headUser: AppUser = {
  id: '102',
  name: 'Мария Петрова',
  firstName: 'Мария',
  lastName: 'Петрова',
  email: 'head@trustflow.local',
  role: 'head',
  companyId: 'company-trustflow-001',
}

const headPermissions: AccessPermission[] = [
  'view_dashboard_page',
  'view_users_page',
  'view_risk_objects_page',
  'view_integrations_page',
  'view_profile_page',
  'manage_risk_objects',
  'manage_integrations',
]

const topManagerUser: AppUser = {
  id: '103',
  name: 'Иван Сидоров',
  firstName: 'Иван',
  lastName: 'Сидоров',
  email: 'top@trustflow.local',
  role: 'top_management',
  companyId: 'company-trustflow-001',
}

const topManagerPermissions: AccessPermission[] = [
  'view_all_pages',
  'view_dashboard_page',
  'view_users_page',
  'view_risk_objects_page',
  'view_integrations_page',
  'view_rules_and_risks_page',
  'view_settings_page',
  'view_profile_page',
  'edit_users',
  'manage_risk_objects',
  'manage_integrations',
  'manage_rules_and_risks',
]

const demoAuthAccounts = [
  {
    email: adminUser.email.toLowerCase(),
    password: 'admin123',
    user: adminUser,
    permissions: adminPermissions,
  },
  {
    email: managerUser.email.toLowerCase(),
    password: 'manager123',
    user: managerUser,
    permissions: managerPermissions,
  },
  {
    email: headUser.email.toLowerCase(),
    password: 'head123',
    user: headUser,
    permissions: headPermissions,
  },
  {
    email: topManagerUser.email.toLowerCase(),
    password: 'top123',
    user: topManagerUser,
    permissions: topManagerPermissions,
  },
] as const

const mockCompanies = [
  {
    id: 'company-trustflow-001',
    name: 'Trustflow LLC',
  },
] as const

let currentAuthAccount =
  demoAuthAccounts.find((account) => account.user.email === adminUser.email) ??
  demoAuthAccounts[0]

const mockUsers: Array<{
  id: string
  name: string
  email: string
  status: 'active' | 'blocked'
  jobTitle: 'manager' | 'head' | 'top_management'
  accessPermissions: AccessPermission[]
  createdAt: string
}> = [
  {
    id: '1',
    name: 'Алексей Иванов',
    email: 'admin@trustflow.local',
    status: 'active',
    jobTitle: 'top_management',
    accessPermissions: adminPermissions,
    createdAt: '2026-02-01',
  },
  {
    id: '101',
    name: 'Алексей Иванов',
    email: managerUser.email,
    status: 'active',
    jobTitle: 'manager',
    accessPermissions: [
      'view_dashboard_page',
      'view_users_page',
      'view_risk_objects_page',
      'edit_users',
      'manage_risk_objects',
    ],
    createdAt: '2026-03-12',
  },
  {
    id: '102',
    name: 'Мария Петрова',
    email: headUser.email,
    status: 'blocked',
    jobTitle: 'head',
    accessPermissions: [
      'view_dashboard_page',
      'view_risk_objects_page',
      'view_integrations_page',
      'manage_risk_objects',
      'manage_integrations',
    ],
    createdAt: '2026-04-01',
  },
  {
    id: '103',
    name: 'Иван Сидоров',
    email: topManagerUser.email,
    status: 'active',
    jobTitle: 'top_management',
    accessPermissions: [
      'view_all_pages',
      'view_dashboard_page',
      'view_users_page',
      'view_risk_objects_page',
      'view_integrations_page',
      'view_rules_and_risks_page',
      'view_settings_page',
      'view_profile_page',
      'edit_users',
      'manage_risk_objects',
      'manage_integrations',
      'manage_rules_and_risks',
    ],
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
    const integrationId = mockIntegrationConfigs.find((c) => c.name === t.configName)?.id
    return {
      id: `hist-${i + 1}`,
      integrationId,
      changedAt: `2026-04-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`,
      configName: t.configName,
      description: `${t.description} (#${i + 1})`,
      authorName: t.authorName,
    }
  })
}

/** Достаточно страниц для демонстрации бесконечной прокрутки (по 5 записей). */
const mockIntegrationChangeHistory = buildMockIntegrationChangeHistory(48)

const mockRiskObjectModelsCatalog = [
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

const mockRiskObjectModelsList = mockRiskObjectModelsCatalog.map(({ id, name }) => ({ id, name }))

function defaultRiskDefinition(name: string): Record<string, unknown> {
  return {
    external_id: null,
    display_name: null,
    source_name: name,
    attributes: [{ key: null, value: null }],
  }
}

type MockRiskObject = {
  id: string
  code: string
  name: string
  status: 'active' | 'archived'
  updatedAt: string
  definition: Record<string, unknown>
}

let mockRiskObjects: MockRiskObject[] = [
  {
    id: 'ro-1',
    code: 'RO-001',
    name: 'ООО «Вектор»',
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
    status: 'active' as const,
    updatedAt: '2026-04-08T08:45:00.000Z',
    definition: {
      group_id: null,
      group_name: null,
      members: [{ member_id: null, role: null }],
    },
  },
]

let mockRisks = [
  {
    id: 'risk-1',
    category: 'financial' as const,
    name: 'Падение платёжной дисциплины',
    description: 'Клиент систематически задерживает оплату, что увеличивает кассовый разрыв.',
    riskObjectId: 'ro-1',
  },
  {
    id: 'risk-2',
    category: 'financial' as const,
    name: 'Высокая долговая нагрузка',
    description: 'У контрагента растёт отношение долга к выручке по последним отчётам.',
    riskObjectId: 'ro-4',
  },
  {
    id: 'risk-3',
    category: 'reputational' as const,
    name: 'Негативный новостной фон',
    description: 'В публичных источниках появились сведения о судебных претензиях и нарушениях.',
    riskObjectId: 'ro-3',
  },
  {
    id: 'risk-4',
    category: 'reputational' as const,
    name: 'Жалобы ключевых партнёров',
    description: 'Зафиксированы повторные жалобы на срыв сроков и качество взаимодействия.',
    riskObjectId: 'ro-5',
  },
  {
    id: 'risk-5',
    category: 'operational' as const,
    name: 'Сбой в интеграции данных',
    description: 'При обмене с внешней системой часть записей теряется или приходит с задержкой.',
    riskObjectId: 'ro-2',
  },
  {
    id: 'risk-6',
    category: 'operational' as const,
    name: 'Ограниченный кадровый резерв',
    description: 'Критичные процессы зависят от узкого круга сотрудников без резервного покрытия.',
    riskObjectId: 'ro-6',
  },
]

let mockRiskCategories = [
  { id: 'financial', name: 'Финансовый' },
  { id: 'reputational', name: 'Репутационный' },
  { id: 'operational', name: 'Операционный' },
]

type MockRuleOverride = {
  riskObjectId?: string
  mechanismScriptName?: string
  mechanismScriptContent?: string
  categoryId?: string
  priority?: 'low' | 'medium' | 'high'
  responsibleUserId?: string
  actions?: Array<'createIncident' | 'sendNotification'>
  enabled?: boolean
}

let mockRuleOverrides: Record<string, MockRuleOverride> = {}

const rulePriorityPattern: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low']

const fallbackActionByCategory: Record<'financial' | 'reputational' | 'operational', string> = {
  financial: 'Отправить объект на расширенную финансовую проверку',
  reputational: 'Добавить объект в мониторинг новостного фона',
  operational: 'Создать задачу комплаенс-аналитику',
}

const actionLabelByCode: Record<'createIncident' | 'sendNotification', string> = {
  createIncident: 'Создать инцидент',
  sendNotification: 'Отправить уведомление',
}

function buildMockRulesTableRows() {
  return mockRisks.map((risk, index) => {
    const override = mockRuleOverrides[risk.id] ?? {}
    const categoryId = override.categoryId ?? risk.category
    const categoryLabel = mockRiskCategories.find((item) => item.id === categoryId)?.name ?? categoryId
    const riskObjectId = override.riskObjectId ?? risk.riskObjectId

    const action =
      (override.actions ?? []).length > 0
        ? (override.actions ?? []).map((item) => actionLabelByCode[item]).join(', ')
        : fallbackActionByCategory[
            isRiskCategory(categoryId) ? categoryId : 'operational'
          ]

    return {
      id: risk.id,
      name: risk.name,
      condition: risk.description,
      action,
      categoryId,
      categoryLabel,
      priority: override.priority ?? rulePriorityPattern[index % rulePriorityPattern.length],
      enabled: override.enabled ?? index % 5 !== 4,
      riskObjectId,
    }
  })
}

const RULE_HISTORY_TEMPLATES = [
  {
    ruleName: 'Падение платёжной дисциплины',
    description: 'Изменён порог срабатывания и период оценки',
    authorName: 'Алексей Иванов',
  },
  {
    ruleName: 'Высокая долговая нагрузка',
    description: 'Обновлены действия системы при срабатывании',
    authorName: 'Мария Петрова',
  },
  {
    ruleName: 'Негативный новостной фон',
    description: 'Назначен новый ответственный сотрудник',
    authorName: 'Иван Сидоров',
  },
  {
    ruleName: 'Жалобы ключевых партнёров',
    description: 'Категория риска изменена на репутационную',
    authorName: 'Мария Петрова',
  },
  {
    ruleName: 'Сбой в интеграции данных',
    description: 'Правило временно отключено',
    authorName: 'Алексей Иванов',
  },
] as const

function buildMockRuleChangeHistory(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = RULE_HISTORY_TEMPLATES[i % RULE_HISTORY_TEMPLATES.length]
    const day = 1 + (i % 28)
    const hour = 7 + (i % 13)
    const minute = (i * 7) % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    const ruleId = mockRisks.find((r) => r.name === t.ruleName)?.id
    return {
      id: `rhist-${i + 1}`,
      ruleId,
      changedAt: `2026-04-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`,
      ruleName: t.ruleName,
      description: `${t.description} (#${i + 1})`,
      authorName: t.authorName,
    }
  })
}

const mockRuleChangeHistory = buildMockRuleChangeHistory(44)

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
    const riskObjectId = mockRiskObjects.find((r) => r.name === t.riskObjectName)?.id
    return {
      id: `roh-${i + 1}`,
      riskObjectId,
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

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? '', lastName: '' }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function isRiskCategory(categoryId: string): categoryId is 'financial' | 'reputational' | 'operational' {
  return categoryId === 'financial' || categoryId === 'reputational' || categoryId === 'operational'
}

export const handlers = [
  http.post('/api/auth/admin/login', async ({ request }) => {
    await delay(450)
    const body = (await request.json()) as {
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ''

    const account = demoAuthAccounts.find(
      (item) => item.email === email && item.password === password,
    )
    if (account) {
      currentAuthAccount = account
      const tokens = issueMockTokens()
      return HttpResponse.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: account.user,
      })
    }

    return HttpResponse.json(
      { message: 'Неверный email или пароль' },
      { status: 401 },
    )
  }),

  http.post('/api/auth/admin/refresh', async ({ request }) => {
    await delay(250)
    const body = (await request.json()) as {
      refreshToken?: string
    }
    if (!body.refreshToken || body.refreshToken !== MOCK_REFRESH_TOKEN) {
      return HttpResponse.json({ message: 'Сессия истекла' }, { status: 401 })
    }
    const tokens = issueMockTokens()
    return HttpResponse.json(tokens)
  }),

  http.get('/api/users/me', async ({ request }) => {
    await delay(200)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const userFromDirectory = mockUsers.find((item) => item.id === currentAuthAccount.user.id)
    if (userFromDirectory) {
      const parsedName = splitName(userFromDirectory.name)
      return HttpResponse.json({
        ...currentAuthAccount.user,
        name: userFromDirectory.name,
        firstName: parsedName.firstName || currentAuthAccount.user.firstName,
        lastName: parsedName.lastName,
        email: userFromDirectory.email,
      })
    }
    return HttpResponse.json(currentAuthAccount.user)
  }),

  http.get('/api/companies/by-employee/:employeeId', async ({ request, params }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const employeeId = String(params.employeeId ?? '')
    const employee = demoAuthAccounts.find((item) => item.user.id === employeeId)
    if (!employee) {
      return HttpResponse.json({ message: 'Сотрудник не найден' }, { status: 404 })
    }
    const company = mockCompanies.find((item) => item.id === employee.user.companyId)
    if (!company) {
      return HttpResponse.json({ message: 'Компания не найдена' }, { status: 404 })
    }
    return HttpResponse.json(company)
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
    const companyId = request.headers.get('CompanyId')?.trim()
    if (!companyId) {
      return HttpResponse.json({ message: 'Требуется заголовок CompanyId' }, { status: 400 })
    }
    return HttpResponse.json({ items: mockUsers })
  }),

  http.get('/api/users/:id/access', async ({ request, params }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const companyId = request.headers.get('CompanyId')?.trim()
    if (!companyId) {
      return HttpResponse.json({ message: 'Требуется заголовок CompanyId' }, { status: 400 })
    }
    const id = String(params.id ?? '')
    const user = mockUsers.find((item) => item.id === id)
    if (!user) {
      return HttpResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }
    return HttpResponse.json({ accessPermissions: user.accessPermissions })
  }),

  http.put('/api/users/:id', async ({ request, params }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const userIndex = mockUsers.findIndex((item) => item.id === id)
    if (userIndex < 0) {
      return HttpResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown
      firstName?: unknown
      lastName?: unknown
    }
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    if (!email || !firstName || !fullName) {
      return HttpResponse.json({ message: 'Некорректные данные пользователя' }, { status: 400 })
    }
    mockUsers[userIndex] = {
      ...mockUsers[userIndex],
      email,
      name: fullName,
    }
    return HttpResponse.json({
      id,
      email,
      firstName,
      lastName,
    })
  }),

  http.put('/api/users/:id/status', async ({ request, params }) => {
    await delay(230)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const userIndex = mockUsers.findIndex((item) => item.id === id)
    if (userIndex < 0) {
      return HttpResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as {
      status?: unknown
    }
    if (body.status !== 'active' && body.status !== 'blocked') {
      return HttpResponse.json({ message: 'Некорректный статус' }, { status: 400 })
    }
    mockUsers[userIndex] = {
      ...mockUsers[userIndex],
      status: body.status,
    }
    return HttpResponse.json({ status: mockUsers[userIndex].status })
  }),

  http.put('/api/users/:id/access', async ({ request, params }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const companyId = request.headers.get('CompanyId')?.trim()
    if (!companyId) {
      return HttpResponse.json({ message: 'Требуется заголовок CompanyId' }, { status: 400 })
    }
    const id = String(params.id ?? '')
    const userIndex = mockUsers.findIndex((item) => item.id === id)
    if (userIndex < 0) {
      return HttpResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as {
      accessPermissions?: unknown
    }
    if (!Array.isArray(body.accessPermissions)) {
      return HttpResponse.json({ message: 'Некорректный формат прав доступа' }, { status: 400 })
    }
    const nextPermissions = body.accessPermissions.filter(
      (item): item is AccessPermission => typeof item === 'string',
    )
    mockUsers[userIndex] = {
      ...mockUsers[userIndex],
      accessPermissions: nextPermissions,
    }
    return HttpResponse.json({ accessPermissions: nextPermissions })
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

  http.post('/api/integration-configs', async ({ request }) => {
    await delay(300)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      (body.integrationKind !== 'pull' &&
        body.integrationKind !== 'push' &&
        body.integrationKind !== 'broker') ||
      typeof body.endpointUrl !== 'string' ||
      !body.endpointUrl.trim() ||
      typeof body.riskObjectModelId !== 'string' ||
      !body.riskObjectModelId.trim()
    ) {
      return HttpResponse.json(
        { message: 'Некорректные данные для создания интеграции' },
        { status: 400 },
      )
    }
    const id = `ic-${Date.now()}`
    const number = mockIntegrationConfigs.length + 1
    const updatedAt = new Date().toISOString()
    const status = 'active' as const
    const mappingRules = Array.isArray(body.mapping_rules) ? body.mapping_rules : []

    const listRow = {
      id,
      number,
      name: body.name.trim(),
      updatedAt,
      status,
      authorName: adminUser.name,
    }
    mockIntegrationConfigs = [listRow, ...mockIntegrationConfigs]

    mockIntegrationConfigDetails = [
      {
        id,
        number,
        name: body.name.trim(),
        integrationKind: body.integrationKind,
        endpointUrl: body.endpointUrl.trim(),
        riskObjectModelId: body.riskObjectModelId.trim(),
        mapping_rules: mappingRules,
        status,
        authorName: adminUser.name,
        updatedAt,
      },
      ...mockIntegrationConfigDetails,
    ]

    return HttpResponse.json({ id, savedAt: updatedAt }, { status: 201 })
  }),

  http.get('/api/integration-configs', async ({ request }) => {
    await delay(320)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const url = new URL(request.url)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const rawSize = Number.parseInt(url.searchParams.get('pageSize') ?? '6', 10)
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(rawSize) ? rawSize : 6))
    const start = (page - 1) * pageSize
    const items = mockIntegrationConfigs.slice(start, start + pageSize)
    const hasMore = start + items.length < mockIntegrationConfigs.length
    return HttpResponse.json({ items, hasMore })
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
      status: prev.status,
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

  http.put('/api/integration-configs/:id/status', async ({ request, params }) => {
    await delay(220)
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
    if (body.status !== 'active' && body.status !== 'inactive') {
      return HttpResponse.json({ message: 'Некорректный статус' }, { status: 400 })
    }
    const updatedAt = new Date().toISOString()
    const nextStatus = body.status
    mockIntegrationConfigDetails[idx] = {
      ...mockIntegrationConfigDetails[idx],
      status: nextStatus,
      updatedAt,
      authorName: adminUser.name,
    }
    mockIntegrationConfigs = mockIntegrationConfigs.map((it) =>
      it.id === id
        ? { ...it, status: nextStatus, updatedAt, authorName: adminUser.name }
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
    return HttpResponse.json({ items: mockRiskObjectModelsList })
  }),

  http.get('/api/risk-object-models/:modelId', async ({ request, params }) => {
    await delay(200)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const modelId = String(params.modelId ?? '')
    const row = mockRiskObjectModelsCatalog.find((m) => m.id === modelId)
    if (!row) {
      return HttpResponse.json({ message: 'Модель не найдена' }, { status: 404 })
    }
    return HttpResponse.json({ id: row.id, name: row.name, definition: row.definition })
  }),

  http.get('/api/risk-categories', async ({ request }) => {
    await delay(180)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: mockRiskCategories })
  }),

  http.post('/api/risk-categories', async ({ request }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json().catch(() => ({}))) as { name?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return HttpResponse.json({ message: 'Введите название категории' }, { status: 400 })
    }
    const duplicate = mockRiskCategories.some((item) => item.name.toLowerCase() === name.toLowerCase())
    if (duplicate) {
      return HttpResponse.json(
        { message: 'Категория с таким названием уже существует' },
        { status: 409 },
      )
    }
    const id = `cat-${Date.now()}`
    const created = { id, name }
    mockRiskCategories = [...mockRiskCategories, created]
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/risk-categories/:id', async ({ request, params }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const idx = mockRiskCategories.findIndex((item) => item.id === id)
    if (idx < 0) {
      return HttpResponse.json({ message: 'Категория не найдена' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as { name?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return HttpResponse.json({ message: 'Название категории не может быть пустым' }, { status: 400 })
    }
    const duplicate = mockRiskCategories.some(
      (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      return HttpResponse.json(
        { message: 'Категория с таким названием уже существует' },
        { status: 409 },
      )
    }
    mockRiskCategories[idx] = { ...mockRiskCategories[idx], name }
    return HttpResponse.json(mockRiskCategories[idx])
  }),

  http.delete('/api/risk-categories/:id', async ({ request, params }) => {
    await delay(200)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const exists = mockRiskCategories.some((item) => item.id === id)
    if (!exists) {
      return HttpResponse.json({ message: 'Категория не найдена' }, { status: 404 })
    }
    mockRiskCategories = mockRiskCategories.filter((item) => item.id !== id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/rules/overrides', async ({ request }) => {
    await delay(200)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: mockRuleOverrides })
  }),

  http.put('/api/rules/overrides/:ruleId', async ({ request, params }) => {
    await delay(240)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const ruleId = String(params.ruleId ?? '')
    const riskExists = mockRisks.some((item) => item.id === ruleId)
    if (!riskExists) {
      return HttpResponse.json({ message: 'Правило не найдено' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as MockRuleOverride
    const next: MockRuleOverride = {
      riskObjectId: typeof body.riskObjectId === 'string' ? body.riskObjectId : '',
      mechanismScriptName:
        typeof body.mechanismScriptName === 'string' ? body.mechanismScriptName : '',
      mechanismScriptContent:
        typeof body.mechanismScriptContent === 'string' ? body.mechanismScriptContent : '',
      categoryId: typeof body.categoryId === 'string' ? body.categoryId : undefined,
      priority:
        body.priority === 'low' || body.priority === 'medium' || body.priority === 'high'
          ? body.priority
          : undefined,
      responsibleUserId:
        typeof body.responsibleUserId === 'string' ? body.responsibleUserId : '',
      actions: Array.isArray(body.actions)
        ? body.actions.filter(
            (item): item is 'createIncident' | 'sendNotification' =>
              item === 'createIncident' || item === 'sendNotification',
          )
        : [],
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    }
    mockRuleOverrides = {
      ...mockRuleOverrides,
      [ruleId]: next,
    }
    return HttpResponse.json({ item: next })
  }),

  http.put('/api/rules/:ruleId/risk-object', async ({ request, params }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const ruleId = String(params.ruleId ?? '')
    const riskIndex = mockRisks.findIndex((item) => item.id === ruleId)
    if (riskIndex < 0) {
      return HttpResponse.json({ message: 'Правило не найдено' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as { riskObjectId?: unknown }
    const riskObjectId = typeof body.riskObjectId === 'string' ? body.riskObjectId.trim() : ''
    const riskObjectExists = !riskObjectId || mockRiskObjects.some((item) => item.id === riskObjectId)
    if (!riskObjectExists) {
      return HttpResponse.json({ message: 'Рисковый объект не найден' }, { status: 404 })
    }

    mockRisks = mockRisks.map((risk, index) =>
      index === riskIndex
        ? {
            ...risk,
            riskObjectId,
          }
        : risk,
    )
    mockRuleOverrides = {
      ...mockRuleOverrides,
      [ruleId]: {
        ...(mockRuleOverrides[ruleId] ?? {}),
        riskObjectId,
      },
    }

    return HttpResponse.json({ id: ruleId, riskObjectId })
  }),

  http.get('/api/risks', async ({ request }) => {
    await delay(220)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: mockRisks })
  }),

  http.post('/api/risks', async ({ request }) => {
    await delay(250)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const category = body.category
    const riskObjectId =
      typeof body.riskObjectId === 'string' ? body.riskObjectId.trim() : ''

    if (!name || !description) {
      return HttpResponse.json(
        { message: 'Заполните название и описание' },
        { status: 400 },
      )
    }
    if (
      category !== 'financial' &&
      category !== 'reputational' &&
      category !== 'operational'
    ) {
      return HttpResponse.json({ message: 'Некорректная категория риска' }, { status: 400 })
    }
    const riskObjectExists = riskObjectId
      ? mockRiskObjects.some((item) => item.id === riskObjectId)
      : true
    if (!riskObjectExists) {
      return HttpResponse.json({ message: 'Рисковый объект не найден' }, { status: 404 })
    }

    const id = `risk-${Date.now()}`
    mockRisks = [
      {
        id,
        category,
        name,
        description,
        riskObjectId,
      },
      ...mockRisks,
    ]
    return HttpResponse.json({ id, savedAt: new Date().toISOString() }, { status: 201 })
  }),

  http.get('/api/rules', async ({ request }) => {
    await delay(240)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    return HttpResponse.json({ items: buildMockRulesTableRows() })
  }),

  http.post('/api/rules', async ({ request }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const condition = typeof body.condition === 'string' ? body.condition.trim() : ''
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
    const riskObjectId = typeof body.riskObjectId === 'string' ? body.riskObjectId.trim() : ''
    if (!description || !name || !condition || !categoryId) {
      return HttpResponse.json({ message: 'Заполните обязательные поля правила' }, { status: 400 })
    }
    const categoryExists = mockRiskCategories.some((item) => item.id === categoryId)
    if (!categoryExists) {
      return HttpResponse.json({ message: 'Категория риска не найдена' }, { status: 404 })
    }
    if (riskObjectId) {
      const riskObjectExists = mockRiskObjects.some((item) => item.id === riskObjectId)
      if (!riskObjectExists) {
        return HttpResponse.json({ message: 'Рисковый объект не найден' }, { status: 404 })
      }
    }
    const id = `risk-${Date.now()}`
    const fallbackCategory: 'financial' | 'reputational' | 'operational' = isRiskCategory(categoryId)
      ? categoryId
      : 'operational'
    mockRisks = [
      {
        id,
        category: fallbackCategory,
        name,
        description: condition,
        riskObjectId,
      },
      ...mockRisks,
    ]

    mockRuleOverrides = {
      ...mockRuleOverrides,
      [id]: {
        categoryId,
        riskObjectId,
        priority:
          body.priority === 'low' || body.priority === 'medium' || body.priority === 'high'
            ? body.priority
            : 'medium',
        responsibleUserId:
          typeof body.responsibleUserId === 'string' ? body.responsibleUserId : '',
        actions: Array.isArray(body.actions)
          ? body.actions.filter(
              (item): item is 'createIncident' | 'sendNotification' =>
                item === 'createIncident' || item === 'sendNotification',
            )
          : [],
        enabled: typeof body.enabled === 'boolean' ? body.enabled : false,
        mechanismScriptName:
          typeof body.mechanismScriptName === 'string' ? body.mechanismScriptName : '',
        mechanismScriptContent:
          typeof body.mechanismScriptContent === 'string' ? body.mechanismScriptContent : '',
      },
    }

    return HttpResponse.json({ id, savedAt: new Date().toISOString() }, { status: 201 })
  }),

  http.put('/api/rules/:id', async ({ request, params }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const riskIndex = mockRisks.findIndex((item) => item.id === id)
    if (riskIndex < 0) {
      return HttpResponse.json({ message: 'Правило не найдено' }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const condition = typeof body.condition === 'string' ? body.condition.trim() : ''
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
    const riskObjectId = typeof body.riskObjectId === 'string' ? body.riskObjectId.trim() : ''
    if (!name || !condition || !categoryId) {
      return HttpResponse.json({ message: 'Заполните обязательные поля правила' }, { status: 400 })
    }
    const categoryExists = mockRiskCategories.some((item) => item.id === categoryId)
    if (!categoryExists) {
      return HttpResponse.json({ message: 'Категория риска не найдена' }, { status: 404 })
    }
    if (riskObjectId) {
      const riskObjectExists = mockRiskObjects.some((item) => item.id === riskObjectId)
      if (!riskObjectExists) {
        return HttpResponse.json({ message: 'Рисковый объект не найден' }, { status: 404 })
      }
    }
    const fallbackCategory: 'financial' | 'reputational' | 'operational' = isRiskCategory(categoryId)
      ? categoryId
      : 'operational'
    mockRisks[riskIndex] = {
      ...mockRisks[riskIndex],
      name,
      description: condition,
      category: fallbackCategory,
      riskObjectId,
    }
    return HttpResponse.json({ id, savedAt: new Date().toISOString() })
  }),

  http.get('/api/rules/change-history', async ({ request }) => {
    await delay(260)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const url = new URL(request.url)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const rawSize = Number.parseInt(url.searchParams.get('pageSize') ?? '5', 10)
    const pageSize = Math.min(50, Math.max(1, Number.isFinite(rawSize) ? rawSize : 5))

    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    let pool = mockRuleChangeHistory
    if (q) {
      pool = pool.filter(
        (row) =>
          row.ruleName.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q) ||
          row.authorName.toLowerCase().includes(q),
      )
    }

    const start = (page - 1) * pageSize
    const items = pool.slice(start, start + pageSize)
    const hasMore = start + items.length < pool.length
    return HttpResponse.json({ items, hasMore })
  }),

  http.get('/api/rules/change-history/:id', async ({ request, params }) => {
    await delay(240)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const historyItem = mockRuleChangeHistory.find((item) => item.id === id)
    if (!historyItem) {
      return HttpResponse.json({ message: 'Запись истории не найдена' }, { status: 404 })
    }
    const rule = historyItem.ruleId ? mockRisks.find((r) => r.id === historyItem.ruleId) : undefined
    const override = historyItem.ruleId ? mockRuleOverrides[historyItem.ruleId] ?? {} : {}
    const categoryId = override.categoryId ?? rule?.category ?? 'financial'
    const priority = override.priority ?? 'medium'
    const riskObjectId = override.riskObjectId ?? rule?.riskObjectId ?? ''
    return HttpResponse.json({
      id: historyItem.id,
      companyId: 'company-1',
      ruleId: historyItem.ruleId ?? '',
      ruleName: historyItem.ruleName,
      description: historyItem.description,
      authorId: mockUsers[0]?.id ?? '',
      authorName: historyItem.authorName,
      condition: rule?.description ?? '',
      categoryId,
      riskObjectId,
      priority,
      responsibleUserId: override.responsibleUserId ?? '',
      actions: override.actions ?? [],
      enabled: typeof override.enabled === 'boolean' ? override.enabled : true,
      mechanismScriptName: override.mechanismScriptName ?? '',
      mechanismScriptContent: override.mechanismScriptContent ?? '',
      createdByUserId: mockUsers[0]?.id ?? '',
      savedAt: new Date().toISOString(),
      changedAt: historyItem.changedAt,
    })
  }),

  http.get('/api/rules/:id', async ({ request, params }) => {
    await delay(240)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const id = String(params.id ?? '')
    const riskIndex = mockRisks.findIndex((item) => item.id === id)
    if (riskIndex < 0) {
      return HttpResponse.json({ message: 'Правило не найдено' }, { status: 404 })
    }
    const risk = mockRisks[riskIndex]
    const override = mockRuleOverrides[id] ?? {}
    const categoryId = override.categoryId ?? risk.category
    const priority = override.priority ?? rulePriorityPattern[riskIndex % rulePriorityPattern.length]
    const enabled = override.enabled ?? riskIndex % 5 !== 4
    const riskObjectId = override.riskObjectId ?? risk.riskObjectId
    return HttpResponse.json({
      id: risk.id,
      companyId: 'company-1',
      name: risk.name,
      condition: risk.description,
      categoryId,
      riskObjectId,
      priority,
      responsibleUserId: override.responsibleUserId ?? '',
      actions: override.actions ?? [],
      enabled,
      mechanismScriptName: override.mechanismScriptName ?? '',
      mechanismScriptContent: override.mechanismScriptContent ?? '',
      createdByUserId: mockUsers[0]?.id ?? '',
      savedAt: new Date().toISOString(),
    })
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
    const url = new URL(request.url)
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const rawSize = Number.parseInt(url.searchParams.get('pageSize') ?? '6', 10)
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(rawSize) ? rawSize : 6))
    const start = (page - 1) * pageSize
    const items = mockRiskObjects.slice(start, start + pageSize)
    const hasMore = start + items.length < mockRiskObjects.length
    return HttpResponse.json({ items, hasMore })
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

  http.get('/api/risk-objects/change-history/:historyId', async ({ request, params }) => {
    await delay(230)
    const token = parseAuth(request)
    if (token !== MOCK_TOKEN) {
      return HttpResponse.json({ message: 'Требуется вход' }, { status: 401 })
    }
    const historyId = String(params.historyId ?? '')
    const entry = mockRiskObjectChangeHistory.find((row) => row.id === historyId)
    if (!entry) {
      return HttpResponse.json({ message: 'Запись истории не найдена' }, { status: 404 })
    }
    if (!entry.riskObjectId) {
      return HttpResponse.json(
        { message: 'Для записи истории не найден связанный рисковый объект' },
        { status: 404 },
      )
    }
    return HttpResponse.json(entry)
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
      uuid: row.id,
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

  http.put('/api/risk-objects/:id/status', async ({ request, params }) => {
    await delay(220)
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
    const statusRaw = body.status
    if (
      statusRaw !== 'active' &&
      statusRaw !== 'archived' &&
      statusRaw !== 'inactive' &&
      statusRaw !== 'disable'
    ) {
      return HttpResponse.json({ message: 'Некорректный статус' }, { status: 400 })
    }
    const nextStatus = statusRaw === 'active' ? 'active' : 'archived'
    const updatedAt = new Date().toISOString()
    mockRiskObjects[idx] = {
      ...mockRiskObjects[idx],
      status: nextStatus,
      updatedAt,
    }
    return HttpResponse.json({ id, savedAt: updatedAt })
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
