import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Slide,
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
import {
  getRuleChangeHistoryById,
  getRulesList,
  getRulesChangeHistory,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RuleChangeHistoryDetails, RuleChangeHistoryEntry } from '../types/risks'
import {
  type RuleTableRow,
  type RulePriority,
  actionLabels,
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
  const { token, user, hasPermission } = useAuth()
  const canManageRulesAndRisks = hasPermission('manage_rules_and_risks')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableRows, setTableRows] = useState<RuleTableRow[]>([])
  const [prioritySwitcher, setPrioritySwitcher] = useState<PrioritySwitcherValue>('all')
  const [ruleNameFilter, setRuleNameFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PrioritySwitcherValue>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('all')
  const [riskObjectFilter, setRiskObjectFilter] = useState<RiskObjectFilterValue>('all')
  const [draftRuleNameFilter, setDraftRuleNameFilter] = useState('')
  const [draftPriorityFilter, setDraftPriorityFilter] = useState<PrioritySwitcherValue>('all')
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<CategoryFilterValue>('all')
  const [draftRiskObjectFilter, setDraftRiskObjectFilter] = useState<RiskObjectFilterValue>('all')
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<RuleChangeHistoryEntry[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyInitialLoading, setHistoryInitialLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historySearchInput, setHistorySearchInput] = useState('')
  const [historySearchDebounced, setHistorySearchDebounced] = useState('')
  const [historyDetailsOpen, setHistoryDetailsOpen] = useState(false)
  const [historyDetailsLoading, setHistoryDetailsLoading] = useState(false)
  const [historyDetailsError, setHistoryDetailsError] = useState<string | null>(null)
  const [historyDetails, setHistoryDetails] = useState<RuleChangeHistoryDetails | null>(null)

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
    getRulesList(token, user?.companyId)
      .then((items) => {
        if (cancelled) return
        setError(null)
        setTableRows(items)
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
  }, [token, user?.companyId])

  const fetchHistoryPage = useCallback(
    async (page: number, append: boolean) => {
      if (!token || fetchingHistoryRef.current) return
      fetchingHistoryRef.current = true
      if (append) setHistoryLoadingMore(true)
      else setHistoryInitialLoading(true)
      setHistoryError(null)
      try {
        const { items, hasMore } = await getRulesChangeHistory(
          token,
          page,
          5,
          {
            q: historySearchDebounced || undefined,
          },
          user?.companyId,
        )
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
    [token, historySearchDebounced, user?.companyId],
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

  const categoryOptions = useMemo(
    () =>
      Array.from(new Map(tableRows.map((row) => [row.categoryId, row.categoryLabel])).entries()).map(
        ([id, name]) => ({ id, name }),
      ),
    [tableRows],
  )

  const riskObjectOptions = useMemo(
    () =>
      Array.from(
        new Map(
          tableRows
            .filter((row) => row.riskObjectId)
            .map((row) => [
              row.riskObjectId,
              row.riskObjectId,
            ]),
        ).entries(),
      ).map(([id, label]) => ({ id, label })),
    [tableRows],
  )

  const filteredRows = useMemo(() => {
    const normalizedName = ruleNameFilter.trim().toLowerCase()
    return tableRows.filter((row) => {
      const passRuleName =
        normalizedName === '' || row.name.toLowerCase().includes(normalizedName)
      const passPriority = priorityFilter === 'all' || row.priority === priorityFilter
      const passCategory = categoryFilter === 'all' || row.categoryId === categoryFilter
      const passRiskObject = riskObjectFilter === 'all' || row.riskObjectId === riskObjectFilter
      return passRuleName && passPriority && passCategory && passRiskObject
    })
  }, [ruleNameFilter, categoryFilter, priorityFilter, riskObjectFilter, tableRows])

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

  async function handleOpenHistoryDetails(entryId: string) {
    if (!token) return
    setHistoryDetailsOpen(true)
    setHistoryDetailsLoading(true)
    setHistoryDetailsError(null)
    setHistoryDetails(null)
    try {
      const details = await getRuleChangeHistoryById(token, entryId, user?.companyId)
      setHistoryDetails(details)
    } catch (e: unknown) {
      setHistoryDetailsError(e instanceof Error ? e.message : 'Не удалось загрузить запись истории')
    } finally {
      setHistoryDetailsLoading(false)
    }
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
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<TuneOutlinedIcon />}
            onClick={() => setFiltersPanelOpen((prev) => !prev)}
          >
            {filtersPanelOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="medium"
            onClick={() => navigate('/app/rules/new')}
            disabled={!canManageRulesAndRisks}
          >
            Создать
          </Button>
        </Stack>
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
        <Box
          sx={{
            position: 'relative',
          }}
        >
          <Stack spacing={2}>
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
                          {row.riskObjectId || 'Не привязан'}
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
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                                onClick={() => void handleOpenHistoryDetails(entry.id)}
                              >
                                Подробнее
                              </Button>
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
                            </Stack>
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

            <Dialog
              open={historyDetailsOpen}
              onClose={() => setHistoryDetailsOpen(false)}
              fullWidth
              maxWidth="md"
            >
              <DialogTitle>Подробности изменения</DialogTitle>
              <DialogContent dividers>
                {historyDetailsLoading ? (
                  <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress />
                  </Box>
                ) : historyDetailsError ? (
                  <Alert severity="error">{historyDetailsError}</Alert>
                ) : historyDetails ? (
                  <Stack spacing={2}>
                    <TextField label="ID записи" value={historyDetails.id} fullWidth disabled />
                    <TextField label="Название правила" value={historyDetails.ruleName} fullWidth disabled />
                    <TextField
                      label="Описание изменения"
                      value={historyDetails.description}
                      fullWidth
                      disabled
                      multiline
                      minRows={3}
                    />
                    <TextField
                      label="Дата и время"
                      value={formatDateTime(historyDetails.changedAt)}
                      fullWidth
                      disabled
                    />
                    <TextField label="Автор" value={historyDetails.authorName} fullWidth disabled />
                    <TextField label="ID автора" value={historyDetails.authorId} fullWidth disabled />
                    <TextField label="ID правила" value={historyDetails.ruleId} fullWidth disabled />
                    <TextField label="ID компании" value={historyDetails.companyId} fullWidth disabled />
                    <TextField
                      label="Условие правила"
                      value={historyDetails.condition}
                      fullWidth
                      disabled
                      multiline
                      minRows={2}
                    />
                    <TextField label="Категория (ID)" value={historyDetails.categoryId} fullWidth disabled />
                    <TextField
                      label="Рисковый объект (ID)"
                      value={historyDetails.riskObjectId}
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Приоритет"
                      value={
                        historyDetails.priority in priorityLabels
                          ? priorityLabels[historyDetails.priority as RulePriority]
                          : historyDetails.priority
                      }
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Ответственный (ID)"
                      value={historyDetails.responsibleUserId}
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Действия"
                      value={historyDetails.actions
                        .map((action) =>
                          action in actionLabels
                            ? actionLabels[action as keyof typeof actionLabels]
                            : action,
                        )
                        .join(', ')}
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Статус"
                      value={historyDetails.enabled ? 'Включено' : 'Отключено'}
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Имя скрипта"
                      value={historyDetails.mechanismScriptName}
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Содержимое скрипта"
                      value={historyDetails.mechanismScriptContent}
                      fullWidth
                      disabled
                      multiline
                      minRows={4}
                    />
                    <TextField
                      label="Создал (ID)"
                      value={historyDetails.createdByUserId}
                      fullWidth
                      disabled
                    />
                    <TextField
                      label="Сохранено"
                      value={historyDetails.savedAt ? formatDateTime(historyDetails.savedAt) : ''}
                      fullWidth
                      disabled
                    />
                  </Stack>
                ) : null}
              </DialogContent>
              <DialogActions>
                {historyDetails?.ruleId ? (
                  <Button
                    variant="outlined"
                    onClick={() => navigate(`/app/rules/${historyDetails.ruleId}`)}
                  >
                    Открыть правило
                  </Button>
                ) : null}
                <Button onClick={() => setHistoryDetailsOpen(false)}>Закрыть</Button>
              </DialogActions>
            </Dialog>
          </Stack>

          {filtersPanelOpen ? (
            <Box
              onClick={() => setFiltersPanelOpen(false)}
              sx={{
                position: 'fixed',
                inset: 0,
                bgcolor: 'rgba(0, 0, 0, 0.28)',
                zIndex: (t) => t.zIndex.drawer + 1,
              }}
            />
          ) : null}

          <Slide
            direction="left"
            in={filtersPanelOpen}
            mountOnEnter
            unmountOnExit
            appear
            timeout={{ enter: 260, exit: 180 }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                position: 'fixed',
                top: { xs: 72, md: 88 },
                right: { xs: 8, md: 16 },
                bottom: 16,
                width: { xs: 'calc(100vw - 16px)', sm: 380, md: 420 },
                overflowY: 'auto',
                zIndex: (t) => t.zIndex.drawer + 2,
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Stack spacing={2} sx={{ height: '100%' }}>
                <Box>
                  <IconButton
                    size="small"
                    aria-label="Закрыть панель фильтров"
                    onClick={() => setFiltersPanelOpen(false)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Фильтры рисков
                </Typography>

                <TextField
                  size="small"
                  label="Поиск по названию правила"
                  placeholder="Введите название…"
                  value={draftRuleNameFilter}
                  onChange={(e) => setDraftRuleNameFilter(e.target.value)}
                  fullWidth
                />

                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Приоритет риска
                  </Typography>
                  <ToggleButtonGroup
                    value={draftPriorityFilter}
                    exclusive
                    size="small"
                    onChange={(_, value: PrioritySwitcherValue | null) => {
                      if (value) setDraftPriorityFilter(value)
                    }}
                    aria-label="Фильтр по приоритету риска"
                    fullWidth
                  >
                    <ToggleButton value="all">Все</ToggleButton>
                    <ToggleButton value="low">Низкий</ToggleButton>
                    <ToggleButton value="medium">Средний</ToggleButton>
                    <ToggleButton value="high">Высокий</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <FormControl size="small" fullWidth>
                  <InputLabel id="rules-category-filter-label">Категория риска</InputLabel>
                  <Select
                    labelId="rules-category-filter-label"
                    label="Категория риска"
                    value={draftCategoryFilter}
                    onChange={(event) => {
                      setDraftCategoryFilter(event.target.value as CategoryFilterValue)
                    }}
                  >
                    <MenuItem value="all">Все категории</MenuItem>
                    {categoryOptions.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel id="rules-risk-object-filter-label">Рисковый объект</InputLabel>
                  <Select
                    labelId="rules-risk-object-filter-label"
                    label="Рисковый объект"
                    value={draftRiskObjectFilter}
                    onChange={(event) => {
                      setDraftRiskObjectFilter(event.target.value as RiskObjectFilterValue)
                    }}
                  >
                    <MenuItem value="all">Все рисковые объекты</MenuItem>
                    {riskObjectOptions.map((riskObject) => (
                      <MenuItem key={riskObject.id} value={riskObject.id}>
                        {riskObject.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider />

                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Подсветка приоритета
                  </Typography>
                  <ToggleButtonGroup
                    value={prioritySwitcher}
                    exclusive
                    size="small"
                    onChange={(_, value: PrioritySwitcherValue | null) => {
                      if (value) setPrioritySwitcher(value)
                    }}
                    aria-label="Подсветка приоритета"
                    fullWidth
                  >
                    <ToggleButton value="off">Откл</ToggleButton>
                    <ToggleButton value="all">Все</ToggleButton>
                    <ToggleButton value="low">Низк</ToggleButton>
                    <ToggleButton value="medium">Средн</ToggleButton>
                    <ToggleButton value="high">Высок</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Box sx={{ mt: 'auto' }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => {
                        setRuleNameFilter(draftRuleNameFilter)
                        setPriorityFilter(draftPriorityFilter)
                        setCategoryFilter(draftCategoryFilter)
                        setRiskObjectFilter(draftRiskObjectFilter)
                        setFiltersPanelOpen(false)
                      }}
                    >
                      Найти
                    </Button>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => {
                        setDraftRuleNameFilter('')
                        setDraftPriorityFilter('all')
                        setDraftCategoryFilter('all')
                        setDraftRiskObjectFilter('all')
                      }}
                    >
                      Сбросить
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Slide>
        </Box>
      ) : null}
    </Box>
  )
}

