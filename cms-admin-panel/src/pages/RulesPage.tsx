import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { getRiskObjects, getRisks } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RiskItem, RiskCategory } from '../types/risks'
import type { RiskObject } from '../types/riskObjects'

export function RulesPage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [riskObjects, setRiskObjects] = useState<RiskObject[]>([])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getRisks(token), getRiskObjects(token, 1, 100)])
      .then(([riskItems, riskObjectPage]) => {
        if (cancelled) return
        setRisks(riskItems)
        setRiskObjects(riskObjectPage.items)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить риски')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const riskObjectNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of riskObjects) {
      map.set(row.id, `${row.code} - ${row.name}`)
    }
    return map
  }, [riskObjects])

  const sections = useMemo(() => {
    const grouped = new Map<RiskCategory, RiskItem[]>([
      ['financial', []],
      ['reputational', []],
      ['operational', []],
    ])
    for (const row of risks) {
      const bucket = grouped.get(row.category)
      if (bucket) bucket.push(row)
    }
    return [
      { key: 'financial' as const, title: 'Финансовые риски' },
      { key: 'reputational' as const, title: 'Репутационные риски' },
      { key: 'operational' as const, title: 'Операционные риски' },
    ].map((entry) => ({ ...entry, items: grouped.get(entry.key) ?? [] }))
  }, [risks])

  return (
    <Box>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        Риски
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Каталог рисков с группировкой по категориям и связью с рисковыми объектами.
      </Typography>

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error ? (
        <Stack spacing={3}>
          {sections.map((section) => (
            <Box key={section.key}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                {section.title}
              </Typography>

              {section.items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  В этой категории пока нет рисков.
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, minmax(0, 1fr))',
                    },
                  }}
                >
                  {section.items.map((risk) => (
                    <Box key={risk.id}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Stack spacing={1.25}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ justifyContent: 'space-between' }}
                            >
                              <Stack direction="row" spacing={1} alignItems="center">
                                <ReportProblemOutlinedIcon fontSize="small" color="warning" />
                                <Typography variant="subtitle1">{risk.name}</Typography>
                              </Stack>
                              <Chip label={section.title} size="small" />
                            </Stack>

                            <Typography variant="body2" color="text.secondary">
                              {risk.description}
                            </Typography>

                            <Typography variant="body2">
                              <Box component="span" sx={{ fontWeight: 600 }}>
                                Рисковый объект:
                              </Box>{' '}
                              {riskObjectNameById.get(risk.riskObjectId) ?? 'Не найден'}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      ) : null}
    </Box>
  )
}

