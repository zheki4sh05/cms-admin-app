import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRisks } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RiskItem } from '../types/risks'
import {
  buildRuleRows,
  loadRiskCategories,
  loadRuleOverrides,
  type RiskCategoryOption,
  type RuleTableRow,
  type RulePriority,
  priorityLabels,
} from './rulesShared'

type PrioritySwitcherValue = 'all' | RulePriority
type CategoryFilterValue = 'all' | string

export function RulesPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [categories] = useState<RiskCategoryOption[]>(() => loadRiskCategories())
  const [ruleOverrides] = useState(() => loadRuleOverrides())
  const [prioritySwitcher, setPrioritySwitcher] = useState<PrioritySwitcherValue>('all')
  const [priorityFilter, setPriorityFilter] = useState<PrioritySwitcherValue>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('all')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getRisks(token)
      .then((riskItems) => {
        if (cancelled) return
        setError(null)
        setRisks(riskItems)
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

  const tableRows = useMemo(() => {
    return buildRuleRows(risks, ruleOverrides, categories)
  }, [risks, ruleOverrides, categories])

  const filteredRows = useMemo(() => {
    return tableRows.filter((row) => {
      const passPriority = priorityFilter === 'all' || row.priority === priorityFilter
      const passCategory = categoryFilter === 'all' || row.categoryId === categoryFilter
      return passPriority && passCategory
    })
  }, [categoryFilter, priorityFilter, tableRows])

  function getRowBackground(row: RuleTableRow) {
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
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        Бизнес-правила для выявления рисков
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Настройка правил, условий срабатывания и реакций системы по категориям риска.
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={() => navigate('/app/risk-categories')}>
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
                  <TableCell align="right">Действие</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
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
        </Stack>
      ) : null}
    </Box>
  )
}

