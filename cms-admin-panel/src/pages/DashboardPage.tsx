import { Alert, Box, Card, CardContent, Skeleton, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { getDashboardSummary } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { token } = useAuth()
  const [data, setData] = useState<{
    visitsToday: number
    activeUsers: number
    openTickets: number
    revenueWeek: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getDashboardSummary(token)
      .then((res) => {
        if (!cancelled) setData(res)
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
  }, [token])

  const cards = data
    ? [
        { title: 'Визиты сегодня', value: data.visitsToday.toLocaleString('ru-RU') },
        { title: 'Активные пользователи', value: String(data.activeUsers) },
        { title: 'Открытые заявки', value: String(data.openTickets) },
        {
          title: 'Выручка за неделю',
          value: `${data.revenueWeek.toLocaleString('ru-RU')} ₽`,
        },
      ]
    : []

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Рабочий стол
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Данные приходят с API (сейчас через MSW-имитацию сервера).
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
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {(item as (typeof cards)[0]).title}
                  </Typography>
                  <Typography variant="h5">
                    {(item as (typeof cards)[0]).value}
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
