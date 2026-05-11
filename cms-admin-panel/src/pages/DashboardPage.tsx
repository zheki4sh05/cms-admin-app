import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { getMonitoringResultsStatistics } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { MonitoringResultStatisticsRow } from '../types/monitoringResults'

function formatProcessDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatisticsTableBlock({
  caption,
  rows,
}: {
  caption: string
  rows: MonitoringResultStatisticsRow[]
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, maxWidth: 900 }}>
        {caption}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Идентификатор</TableCell>
              <TableCell>ID рискового объекта</TableCell>
              <TableCell>Наименование</TableCell>
              <TableCell>Дата обработки</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    Нет записей
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                    {row.id}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                    {row.riskObjectId}
                  </TableCell>
                  <TableCell>{row.riskObjectName}</TableCell>
                  <TableCell>{formatProcessDate(row.processDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export function DashboardPage() {
  const { token } = useAuth()
  const [results, setResults] = useState<MonitoringResultStatisticsRow[]>([])
  const [retries, setRetries] = useState<MonitoringResultStatisticsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getMonitoringResultsStatistics(token)
      .then((data) => {
        if (!cancelled) {
          setResults(data.results)
          setRetries(data.retries)
        }
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

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            Загрузка статистики…
          </Typography>
        </Box>
      ) : (
        <>
          <StatisticsTableBlock
            caption="Получены из внешней системы и готовы к дальнейшей проверке правилами."
            rows={results}
          />
          <StatisticsTableBlock
            caption="Отложенная очередь повторной обработки данных мониторинга."
            rows={retries}
          />
        </>
      )}
    </Box>
  )
}
