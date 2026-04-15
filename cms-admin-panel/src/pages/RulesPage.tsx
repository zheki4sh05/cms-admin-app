import AddIcon from '@mui/icons-material/Add'
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
  FormControl,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  InputLabel,
  MenuItem,
  Paper,
  Skeleton,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRiskObjects, getRisks, getRulesChangeHistory } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RiskObject } from '../types/riskObjects'
import type { RiskItem, RuleChangeHistoryEntry } from '../types/risks'
import {
  buildRuleRows,
  loadRiskCategories,
  loadRuleOverrides,
  type RiskCategoryOption,
  type RuleTableRow,
  type RulePriority,
  priorityLabels,
} from './rulesShared'

type PrioritySwitcherValue = 'off' | 'all' | RulePriority
type CategoryFilterValue = 'all' | string
type RiskObjectFilterValue = 'all' | string

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

export function RulesPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { token, hasPermission } = useAuth()
  const canManageRulesAndRisks = hasPermission('manage_rules_and_risks')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [riskObjects, setRiskObjects] = useState<RiskObject[]>([])
  const [categories] = useState<RiskCategoryOption[]>(() => loadRiskCategories())
  const [ruleOverrides] = useState(() => loadRuleOverrides())
  const [prioritySwitcher, setPrioritySwitcher] = useState<PrioritySwitcherValue>('all')
  const [priorityFilter, setPriorityFilter] = useState<PrioritySwitcherValue>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('all')
  const [riskObjectFilter, setRiskObjectFilter] = useState<RiskObjectFilterValue>('all')
  const [historyItems, setHistoryItems] = useState<RuleChangeHistoryEntry[]>([])
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
    let cancelled = false
    Promise.all([getRisks(token), getRiskObjects(token, 1, 500)])
      .then(([riskItems, riskObjectPage]) => {
        if (cancelled) return
        setError(null)
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

  const fetchHistoryPage = useCallback(
    async (page: number, append: boolean) => {
      if (!token || fetchingHistoryRef.current) return
      fetchingHistoryRef.current = true
      if (append) setHistoryLoadingMore(true)
      else setHistoryInitialLoading(true)
      setHistoryError(null)
      try {
        const { items, hasMore } = await getRulesChangeHistory(token, page, 5, {
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
    historyLastPageRef.current = 0
    setHistoryItems([])
    setHistoryHasMore(true)
    void fetchHistoryPage(1, false)
  }, [token, historySearchDebounced, fetchHistoryPage])

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

  const tableRows = useMemo(() => {
    return buildRuleRows(risks, ruleOverrides, categories)
  }, [risks, ruleOverrides, categories])

  const riskObjectNameById = useMemo(() => {
    return new Map<string, string>(
      riskObjects.map((item) => [item.id, `${item.code} - ${item.name}`]),
    )
  }, [riskObjects])

  const filteredRows = useMemo(() => {
    return tableRows.filter((row) => {
      const passPriority = priorityFilter === 'all' || row.priority === priorityFilter
      const passCategory = categoryFilter === 'all' || row.categoryId === categoryFilter
      const passRiskObject = riskObjectFilter === 'all' || row.riskObjectId === riskObjectFilter
      return passPriority && passCategory && passRiskObject
    })
  }, [categoryFilter, priorityFilter, riskObjectFilter, tableRows])

  function getRowBackground(row: RuleTableRow) {
    if (prioritySwitcher === 'off') {
      return theme.palette.background.paper
    }
    if (!row.enabled) {
      return theme.palette.background.paper
    }
    if (prioritySwitcher !== 'all' && row.priority !== prioritySwitcher) {
      return theme.palette.background.paper
    }
    if (row.priority === 'high') {
      return alpha(theme.palette.error.main, 0.12)
    }
    if (row.priority === 'medium') {
      return alpha(theme.palette.warning.main, 0.2)
    }
    return alpha(theme.palette.info.main, 0.12)
  }

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
          Бизнес-правила для выявления рисков
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="medium"
          onClick={() => navigate('/app/rules/new')}
          disabled={!canManageRulesAndRisks}
        >
          Создать
        </Button>
      </Box>
      {!canManageRulesAndRisks ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Редактирование правил и рисков отключено.
        </Alert>
      ) : null}
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Настройка правил, условий срабатывания и реакций системы по категориям риска.
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          onClick={() => navigate('/app/risk-categories')}
          disabled={!canManageRulesAndRisks}
        >
          Управление категориями рисков
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error ? (
        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Фильтр отображения:
            </Typography>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: { sm: 130 } }}>
                  Приоритет риска:
                </Typography>
                <ToggleButtonGroup
                  value={priorityFilter}
                  exclusive
                  size="small"
                  onChange={(_, value: PrioritySwitcherValue | null) => {
                    if (value) setPriorityFilter(value)
                  }}
                  aria-label="Фильтр по приоритету риска"
                >
                  <ToggleButton value="all">Все</ToggleButton>
                  <ToggleButton value="low">Низкий</ToggleButton>
                  <ToggleButton value="medium">Средний</ToggleButton>
                  <ToggleButton value="high">Высокий</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: { sm: 130 } }}>
                  Категория:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel id="rules-category-filter-label">Категория риска</InputLabel>
                  <Select
                    labelId="rules-category-filter-label"
                    label="Категория риска"
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value as CategoryFilterValue)
                    }}
                  >
                    <MenuItem value="all">Все категории</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: { sm: 130 } }}>
                  Рисковый объект:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 320 }}>
                  <InputLabel id="rules-risk-object-filter-label">Рисковый объект</InputLabel>
                  <Select
                    labelId="rules-risk-object-filter-label"
                    label="Рисковый объект"
                    value={riskObjectFilter}
                    onChange={(event) => {
                      setRiskObjectFilter(event.target.value as RiskObjectFilterValue)
                    }}
                  >
                    <MenuItem value="all">Все рисковые объекты</MenuItem>
                    {riskObjects.map((riskObject) => (
                      <MenuItem key={riskObject.id} value={riskObject.id}>
                        {riskObject.code} - {riskObject.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={1.5}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Подсветка приоритета:
            </Typography>
            <ToggleButtonGroup
              value={prioritySwitcher}
              exclusive
              size="small"
              onChange={(_, value: PrioritySwitcherValue | null) => {
                if (value) setPrioritySwitcher(value)
              }}
              aria-label="Подсветка приоритета"
            >
              <ToggleButton value="off">Отключить</ToggleButton>
              <ToggleButton value="all">Все</ToggleButton>
              <ToggleButton value="low">Низкий</ToggleButton>
              <ToggleButton value="medium">Средний</ToggleButton>
              <ToggleButton value="high">Высокий</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID правила</TableCell>
                  <TableCell>Название правила</TableCell>
                  <TableCell>Условие срабатывания</TableCell>
                  <TableCell>Действие системы</TableCell>
                  <TableCell>Категория риска</TableCell>
                  <TableCell>Рисковый объект</TableCell>
                  <TableCell align="right">Действие</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        По выбранным фильтрам правил не найдено.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        bgcolor: getRowBackground(row),
                        '&:last-child td, &:last-child th': { border: 0 },
                      }}
                    >
                      <TableCell>{row.id}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                          <Typography variant="body2">{row.name}</Typography>
                          <Chip
                            size="small"
                            label={row.enabled ? priorityLabels[row.priority] : 'Отключено'}
                            color={row.enabled ? 'default' : 'warning'}
                            variant={row.enabled ? 'outlined' : 'filled'}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>{row.condition}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.categoryLabel}</TableCell>
                      <TableCell>
                        {riskObjectNameById.get(row.riskObjectId) ?? row.riskObjectId ?? 'Не привязан'}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/app/rules/${row.id}`)}
                        >
                          Просмотреть
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
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
                            primary={entry.ruleName}
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
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                            onClick={() =>
                              entry.ruleId ? navigate(`/app/rules/${entry.ruleId}`) : undefined
                            }
                            disabled={!entry.ruleId}
                          >
                            Просмотреть
                          </Button>
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
        </Stack>
      ) : null}
    </Box>
  )
}

