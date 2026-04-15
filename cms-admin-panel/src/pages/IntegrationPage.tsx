import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
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
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getIntegrationChangeHistory,
  getIntegrationConfigs,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type {
  IntegrationChangeHistoryEntry,
  IntegrationConfig,
} from '../types/integration'

function formatUpdatedAt(iso: string) {
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

export function IntegrationPage() {
  const navigate = useNavigate()
  const { token, hasPermission } = useAuth()
  const canManageIntegrations = hasPermission('manage_integrations')
  const LIST_PAGE_SIZE = 6
  const [rows, setRows] = useState<IntegrationConfig[]>([])
  const [listPage, setListPage] = useState(1)
  const [listHasMore, setListHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [historyItems, setHistoryItems] = useState<IntegrationChangeHistoryEntry[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyInitialLoading, setHistoryInitialLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historySearchInput, setHistorySearchInput] = useState('')
  const [historySearchDebounced, setHistorySearchDebounced] = useState('')

  const historyScrollRef = useRef<HTMLDivElement | null>(null)
  const historySentinelRef = useRef<HTMLDivElement | null>(null)
  const historyLastPageRef = useRef(0)
  const fetchingHistoryRef = useRef(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setHistorySearchDebounced(historySearchInput.trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [historySearchInput])

  useEffect(() => {
    if (!token) return
    setListPage(1)
  }, [token])

  const fetchHistoryPage = useCallback(
    async (page: number, append: boolean) => {
      if (!token || fetchingHistoryRef.current) return
      fetchingHistoryRef.current = true
      if (append) setHistoryLoadingMore(true)
      else setHistoryInitialLoading(true)
      setHistoryError(null)
      try {
        const { items, hasMore } = await getIntegrationChangeHistory(token, page, 5, {
          q: historySearchDebounced || undefined,
        })
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
    [token, historySearchDebounced],
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getIntegrationConfigs(token, listPage, LIST_PAGE_SIZE)
      .then(({ items, hasMore }) => {
        if (!cancelled) {
          setRows(items)
          setListHasMore(hasMore)
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
  }, [token, listPage])

  useEffect(() => {
    if (!token) return
    historyLastPageRef.current = 0
    setHistoryItems([])
    setHistoryHasMore(true)
    void fetchHistoryPage(1, false)
  }, [token, historySearchDebounced, fetchHistoryPage])

  /** Бесконечная подгрузка: корень — блок с вертикальной прокруткой, а не всё окно. */
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
    historySearchDebounced,
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
          Интеграция
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="medium"
          onClick={() => navigate('/app/integration/new')}
          disabled={!canManageIntegrations}
        >
          Создать
        </Button>
      </Box>
      {!canManageIntegrations ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Создание и редактирование интеграций отключено.
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxWidth: '100%', overflowX: 'auto', mb: 4 }}
      >
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell width={56}>№</TableCell>
              <TableCell>Наименование</TableCell>
              <TableCell>Дата последнего изменения</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Автор</TableCell>
              <TableCell align="right" width={140}>
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.number}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{formatUpdatedAt(row.updatedAt)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status === 'active' ? 'Активно' : 'Не активно'}
                        color={row.status === 'active' ? 'success' : 'default'}
                        variant={row.status === 'active' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>{row.authorName}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                        onClick={() => {
                          navigate(`/app/integration/${row.id}`)
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          mb: 4,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
          Страница {listPage}
        </Typography>
        <IconButton
          size="small"
          aria-label="Предыдущая страница"
          onClick={() => setListPage((p) => Math.max(1, p - 1))}
          disabled={loading || listPage <= 1}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Следующая страница"
          onClick={() => setListPage((p) => p + 1)}
          disabled={loading || !listHasMore}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        История изменений
      </Typography>

      <Paper variant="outlined" sx={{ mb: 2, px: { xs: 1, sm: 2 }, py: 1.5 }}>
        <Toolbar
          disableGutters
          variant="dense"
          sx={{ flexWrap: 'wrap', gap: 1.5, minHeight: 'auto', py: 0.5 }}
        >
          <TextField
            size="small"
            placeholder="Поиск по слову…"
            value={historySearchInput}
            onChange={(e) => setHistorySearchInput(e.target.value)}
            sx={{ flex: '1 1 220px', minWidth: 180, maxWidth: 480 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: historySearchInput ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Очистить поиск"
                    onClick={() => setHistorySearchInput('')}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Toolbar>
      </Paper>

      {historyError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {historyError}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {historyInitialLoading ? (
          <Box
            sx={{
              maxHeight: 380,
              overflowY: 'hidden',
              py: 3,
              px: 2,
            }}
          >
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
                <Typography color="text.secondary">
                  Ничего не найдено. Попробуйте другой запрос.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {historyItems.map((entry, index) => (
                  <Box key={entry.id}>
                    {index > 0 ? <Divider component="li" /> : null}
                    <ListItem
                      alignItems="flex-start"
                      sx={{ py: 1.5, px: 2, gap: 1.5, justifyContent: 'space-between' }}
                    >
                      <ListItemText
                        primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
                        primary={entry.configName}
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
                              {formatUpdatedAt(entry.changedAt)} · {entry.authorName}
                            </Typography>
                          </>
                        }
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                        onClick={() =>
                          entry.integrationId
                            ? navigate(`/app/integration/${entry.integrationId}?readonly=1`)
                            : undefined
                        }
                        disabled={!entry.integrationId}
                      >
                        Просмотреть
                      </Button>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}

            <Box
              ref={historySentinelRef}
              sx={{ height: 1, width: '100%' }}
              aria-hidden
            />

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
