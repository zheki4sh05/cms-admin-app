import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { getMonitoringResultsStatistics, getRisksProcessingStatistic } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { MonitoringResultStatisticsRow } from '../types/monitoringResults'
import type { RisksProcessingStatistic } from '../types/risks'

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

function formatCount(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function RefreshButton({
  onClick,
  loading,
  ariaLabel = 'Обновить',
}: {
  onClick: () => void
  loading: boolean
  ariaLabel?: string
}) {
  return (
    <Tooltip title="Обновить">
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={loading}
          aria-label={ariaLabel}
          sx={{ mt: -0.25 }}
        >
          {loading ? <CircularProgress color="inherit" size={20} /> : <RefreshOutlinedIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  )
}

function StatisticsTableBlock({
  caption,
  rows,
  onRefresh,
  refreshing,
}: {
  caption: string
  rows: MonitoringResultStatisticsRow[]
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, maxWidth: 900, pr: 1 }}>
          {caption}
        </Typography>
        <RefreshButton onClick={onRefresh} loading={refreshing} ariaLabel="Обновить таблицы мониторинга" />
      </Box>
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

function ProcessingStatisticTable({
  data,
  onRefresh,
  refreshing,
}: {
  data: RisksProcessingStatistic
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, maxWidth: 900, pr: 1 }}>
          Статистика обработки рисков
        </Typography>
        <RefreshButton onClick={onRefresh} loading={refreshing} ariaLabel="Обновить статистику обработки рисков" />
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Показатель</TableCell>
              <TableCell align="right" sx={{ width: 160 }}>
                Количество строк
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>
                <Typography variant="body2" component="div">
                  Очередь{' '}
                  <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
                    outboox_monitoring
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                  Входящие данные мониторинга, которые ещё не прошли проверку правилами.
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {formatCount(data.outboxCount)}
                </Typography>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <Typography variant="body2" component="div">
                  Таблица{' '}
                  <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
                    verification_result
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                  Итоги автоматической проверки по вашей компании: учитываются только её записи.
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {formatCount(data.verificationResultCount)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export function DashboardPage() {
  const { token, user } = useAuth()
  const [results, setResults] = useState<MonitoringResultStatisticsRow[]>([])
  const [retries, setRetries] = useState<MonitoringResultStatisticsRow[]>([])
  const [processing, setProcessing] = useState<RisksProcessingStatistic | null>(null)
  const [monitoringError, setMonitoringError] = useState<string | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshingMonitoring, setRefreshingMonitoring] = useState(false)
  const [refreshingProcessing, setRefreshingProcessing] = useState(false)

  const fetchMonitoring = useCallback(async () => {
    if (!token) return
    try {
      const data = await getMonitoringResultsStatistics(token)
      setResults(data.results)
      setRetries(data.retries)
      setMonitoringError(null)
    } catch (e: unknown) {
      setResults([])
      setRetries([])
      setMonitoringError(e instanceof Error ? e.message : 'Ошибка загрузки статистики мониторинга')
    }
  }, [token])

  const fetchProcessing = useCallback(async () => {
    if (!token) return
    try {
      const data = await getRisksProcessingStatistic(token, user?.companyId ?? null)
      setProcessing(data)
      setProcessingError(null)
    } catch (e: unknown) {
      setProcessing(null)
      setProcessingError(
        e instanceof Error ? e.message : 'Ошибка загрузки статистики обработки рисков',
      )
    }
  }, [token, user?.companyId])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setMonitoringError(null)
    setProcessingError(null)
    Promise.allSettled([fetchMonitoring(), fetchProcessing()]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId, fetchMonitoring, fetchProcessing])

  const handleRefreshMonitoring = useCallback(async () => {
    setRefreshingMonitoring(true)
    try {
      await fetchMonitoring()
    } finally {
      setRefreshingMonitoring(false)
    }
  }, [fetchMonitoring])

  const handleRefreshProcessing = useCallback(async () => {
    setRefreshingProcessing(true)
    try {
      await fetchProcessing()
    } finally {
      setRefreshingProcessing(false)
    }
  }, [fetchProcessing])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Рабочий стол
      </Typography>

      {monitoringError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {monitoringError}
        </Alert>
      ) : null}
      {processingError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {processingError}
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
          {processing ? (
            <ProcessingStatisticTable
              data={processing}
              onRefresh={() => void handleRefreshProcessing()}
              refreshing={refreshingProcessing}
            />
          ) : null}
          <StatisticsTableBlock
            caption="Получены из внешней системы и готовы к дальнейшей проверке правилами."
            rows={results}
            onRefresh={() => void handleRefreshMonitoring()}
            refreshing={refreshingMonitoring}
          />
          <StatisticsTableBlock
            caption="Отложенная очередь повторной обработки данных мониторинга."
            rows={retries}
            onRefresh={() => void handleRefreshMonitoring()}
            refreshing={refreshingMonitoring}
          />
        </>
      )}
    </Box>
  )
}
