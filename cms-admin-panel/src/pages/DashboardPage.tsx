import { Alert, Box, Card, CardContent, Skeleton, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import {
  getDashboardSummary,
  getIntegrationConfigs,
  getRisks,
  getRiskObjects,
  getSettings,
  getUsersList,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { roleLabel } from '../utils/roleLabel'

type DashboardCard = {
  section: string
  title: string
  value: string
}

export function DashboardPage() {
  const { token, user, hasPageAccess } = useAuth()
  const [data, setData] = useState<{
    visitsToday: number
    activeUsers: number
    openTickets: number
    revenueWeek: number
  } | null>(null)
  const [cards, setCards] = useState<DashboardCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getDashboardSummary(token),
      hasPageAccess('view_users_page') ? getUsersList(token, user?.companyId) : Promise.resolve([]),
      hasPageAccess('view_risk_objects_page')
        ? getRiskObjects(token, 1, 500)
        : Promise.resolve({ items: [], hasMore: false }),
      hasPageAccess('view_integrations_page')
        ? getIntegrationConfigs(token, 1, 500)
        : Promise.resolve({ items: [], hasMore: false }),
      hasPageAccess('view_rules_and_risks_page') ? getRisks(token) : Promise.resolve([]),
      hasPageAccess('view_settings_page')
        ? getSettings(token)
        : Promise.resolve({ notificationsEmail: false, maintenanceMode: false, apiRegion: '' }),
    ])
      .then(([summary, users, riskObjectsPage, integrationsPage, risks, settings]) => {
        if (cancelled) return
        setData(summary)

        const nextCards: DashboardCard[] = [
          {
            section: 'Общие показатели',
            title: 'Визиты сегодня',
            value: summary.visitsToday.toLocaleString('ru-RU'),
          },
          {
            section: 'Общие показатели',
            title: 'Активные пользователи',
            value: String(summary.activeUsers),
          },
          {
            section: 'Общие показатели',
            title: 'Открытые заявки',
            value: String(summary.openTickets),
          },
          {
            section: 'Общие показатели',
            title: 'Выручка за неделю',
            value: `${summary.revenueWeek.toLocaleString('ru-RU')} ₽`,
          },
        ]

        if (hasPageAccess('view_users_page')) {
          const rows = users as Array<{ status?: string }>
          const active = rows.filter((item) => item.status === 'active').length
          const blocked = rows.filter((item) => item.status === 'blocked').length
          nextCards.push(
            {
              section: 'Пользователи',
              title: 'Всего пользователей',
              value: String(rows.length),
            },
            {
              section: 'Пользователи',
              title: 'Active / Blocked',
              value: `${active} / ${blocked}`,
            },
          )
        }

        if (hasPageAccess('view_risk_objects_page')) {
          const items = riskObjectsPage.items
          const active = items.filter((item) => item.status === 'active').length
          const archived = items.filter((item) => item.status === 'archived').length
          nextCards.push(
            {
              section: 'Рисковые объекты',
              title: 'Всего объектов',
              value: String(items.length),
            },
            {
              section: 'Рисковые объекты',
              title: 'Активные / Архивные',
              value: `${active} / ${archived}`,
            },
          )
        }

        if (hasPageAccess('view_integrations_page')) {
          const items = integrationsPage.items
          const active = items.filter((item) => item.status === 'active').length
          const inactive = items.filter((item) => item.status === 'inactive').length
          nextCards.push(
            {
              section: 'Интеграции',
              title: 'Всего интеграций',
              value: String(items.length),
            },
            {
              section: 'Интеграции',
              title: 'Активные / Неактивные',
              value: `${active} / ${inactive}`,
            },
          )
        }

        if (hasPageAccess('view_rules_and_risks_page')) {
          const items = risks
          const financial = items.filter((item) => item.category === 'financial').length
          const reputational = items.filter((item) => item.category === 'reputational').length
          const operational = items.filter((item) => item.category === 'operational').length
          nextCards.push(
            {
              section: 'Правила и риски',
              title: 'Всего правил риска',
              value: String(items.length),
            },
            {
              section: 'Правила и риски',
              title: 'Фин / Реп / Опер',
              value: `${financial} / ${reputational} / ${operational}`,
            },
          )
        }

        if (hasPageAccess('view_settings_page')) {
          nextCards.push(
            {
              section: 'Настройки',
              title: 'Режим обслуживания',
              value: settings.maintenanceMode ? 'Включен' : 'Выключен',
            },
            {
              section: 'Настройки',
              title: 'Регион API',
              value: settings.apiRegion || '—',
            },
          )
        }

        if (hasPageAccess('view_profile_page')) {
          nextCards.push(
            {
              section: 'Личный кабинет',
              title: 'Текущий пользователь',
              value: user?.name ?? '—',
            },
            {
              section: 'Личный кабинет',
              title: 'Роль',
              value: roleLabel(user?.role),
            },
          )
        }

        setCards(nextCards)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user, hasPageAccess])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Рабочий стол
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        {(loading ? [1, 2, 3, 4] : cards).map((item, i) => (
          <Card key={i} variant="outlined">
            <CardContent>
              {loading ? (
                <>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" height={40} />
                </>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {(item as DashboardCard).section}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {(item as DashboardCard).title}
                  </Typography>
                  <Typography variant="h5">
                    {(item as DashboardCard).value}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
