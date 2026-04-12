import AddIcon from '@mui/icons-material/Add'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRiskObjects, getRiskObjectsChangeHistory } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RiskObject, RiskObjectHistoryEntry } from '../types/riskObjects'

function formatDateTime(iso: string) {
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

export function RiskObjectsPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [rows, setRows] = useState<RiskObject[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)

  const [historyItems, setHistoryItems] = useState<RiskObjectHistoryEntry[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyInitialLoading, setHistoryInitialLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)

  const historyScrollRef = useRef<HTMLDivElement | null>(null)
  const historySentinelRef = useRef<HTMLDivElement | null>(null)
  const historyLastPageRef = useRef(0)
  const fetchingHistoryRef = useRef(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setListLoading(true)
    setListError(null)
    getRiskObjects(token)
      .then((items) => {
        if (!cancelled) setRows(items)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : 'Ошибка загрузки')
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const fetchHistoryPage = useCallback(
    async (page: number, append: boolean) => {
      if (!token || fetchingHistoryRef.current) return
      fetchingHistoryRef.current = true
      if (append) setHistoryLoadingMore(true)
      else setHistoryInitialLoading(true)
      setHistoryError(null)
      try {
        const { items, hasMore } = await getRiskObjectsChangeHistory(token, page, 5)
        setHistoryItems((prev) => (append ? [...prev, ...items] : items))
        setHistoryHasMore(hasMore)
        historyLastPageRef.current = page
      } catch (e: unknown) {
        setHistoryError(e instanceof Error ? e.message : 'Ошибка загрузки истории')
      } finally {
        fetchingHistoryRef.current = false
        setHistoryLoadingMore(false)
        setHistoryInitialLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    if (!token) return
    historyLastPageRef.current = 0
    setHistoryItems([])
    setHistoryHasMore(true)
    void fetchHistoryPage(1, false)
  }, [token, fetchHistoryPage])

  useLayoutEffect(() => {
    if (!token || historyInitialLoading) return
    const root = historyScrollRef.current
    const target = historySentinelRef.current
    if (!root || !target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (!historyHasMore || fetchingHistoryRef.current) return
        void fetchHistoryPage(historyLastPageRef.current + 1, true)
      },
      { root, rootMargin: '48px', threshold: 0 },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [
    token,
    historyHasMore,
    historyInitialLoading,
    historyItems.length,
    fetchHistoryPage,
  ])

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h1">
          Рисковые объекты
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="medium"
          onClick={() => navigate('/app/risk-objects/new')}
        >
          Создать
        </Button>
      </Box>

      {listError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {listError}
        </Alert>
      ) : null}

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell>Код</TableCell>
              <TableCell>Наименование</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Изменён</TableCell>
              <TableCell align="right" width={160}>
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status === 'active' ? 'Активен' : 'В архиве'}
                        color={row.status === 'active' ? 'success' : 'default'}
                        variant={row.status === 'active' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                        onClick={() => {
                          /* экран просмотра — позже */
                        }}
                      >
                        Просмотреть
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        История изменений
      </Typography>

      {historyError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {historyError}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {historyInitialLoading ? (
          <Box sx={{ maxHeight: 380, overflowY: 'hidden', py: 3, px: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} sx={{ my: 1.5 }} height={48} />
            ))}
          </Box>
        ) : (
          <Box
            ref={historyScrollRef}
            sx={{
              maxHeight: 380,
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain',
            }}
          >
            {!historyInitialLoading && historyItems.length === 0 ? (
              <Box sx={{ py: 5, px: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">Нет записей в истории.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {historyItems.map((entry, index) => (
                  <Box key={entry.id}>
                    {index > 0 ? <Divider component="li" /> : null}
                    <ListItem alignItems="flex-start" sx={{ py: 1.5, px: 2 }}>
                      <ListItemText
                        primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
                        primary={entry.riskObjectName}
                        secondaryTypographyProps={{ component: 'div' }}
                        secondary={
                          <>
                            <Typography
                              component="div"
                              variant="body2"
                              sx={{ mt: 0.5, color: 'text.primary' }}
                            >
                              {entry.description}
                            </Typography>
                            <Typography
                              component="div"
                              variant="caption"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
                              {formatDateTime(entry.changedAt)} · {entry.authorName}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}

            <Box ref={historySentinelRef} sx={{ height: 1, width: '100%' }} aria-hidden />

            {historyLoadingMore ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} aria-label="Загрузка" />
              </Box>
            ) : null}

            {!historyHasMore && historyItems.length > 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center', pb: 2, px: 2 }}
              >
                Все записи загружены
              </Typography>
            ) : null}
          </Box>
        )}
      </Paper>
    </Box>
  )
}
