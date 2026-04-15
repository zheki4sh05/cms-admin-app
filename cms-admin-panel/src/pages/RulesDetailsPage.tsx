import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRiskObjects, getRisks, getUsersList } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RiskObject } from '../types/riskObjects'
import {
  actionLabels,
  buildRuleRows,
  loadRiskCategories,
  loadRuleOverrides,
  priorityLabels,
  saveRuleOverride,
  type RiskCategoryOption,
  type RuleAction,
  type RuleEditorDraft,
  type RuleOverrides,
  type RuleTableRow,
} from './rulesShared'

type UserOption = {
  id: string
  name: string
  email: string
}

function normalizeUsers(items: unknown[]): UserOption[] {
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.id !== 'string' || typeof row.name !== 'string') return null
      return {
        id: row.id,
        name: row.name,
        email: typeof row.email === 'string' ? row.email : '',
      }
    })
    .filter((item): item is UserOption => Boolean(item))
}

export function RulesDetailsPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveInfo, setSaveInfo] = useState<string | null>(null)
  const [editingEnabled, setEditingEnabled] = useState(false)

  const [ruleRow, setRuleRow] = useState<RuleTableRow | null>(null)
  const [riskObjects, setRiskObjects] = useState<RiskObject[]>([])
  const [categories, setCategories] = useState<RiskCategoryOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [draft, setDraft] = useState<RuleEditorDraft | null>(null)

  useEffect(() => {
    if (!token || !id) return
    let cancelled = false
    const overrides = loadRuleOverrides()
    const currentCategories = loadRiskCategories()
    Promise.all([getRisks(token), getRiskObjects(token, 1, 200), getUsersList(token)])
      .then(([risks, riskObjectPage, usersRaw]) => {
        if (cancelled) return
        const rows = buildRuleRows(risks, overrides, currentCategories)
        const row = rows.find((item) => item.id === id)
        if (!row) {
          setError('Правило не найдено')
          return
        }
        const persisted = overrides[id] as RuleOverrides | undefined
        setRuleRow(row)
        setRiskObjects(riskObjectPage.items)
        setCategories(currentCategories)
        setUsers(normalizeUsers(usersRaw))
        setDraft({
          riskObjectId: persisted?.riskObjectId ?? row.riskObjectId,
          mechanismScriptName: persisted?.mechanismScriptName ?? '',
          mechanismScriptContent: persisted?.mechanismScriptContent ?? '',
          categoryId: persisted?.categoryId ?? row.categoryId,
          priority: persisted?.priority ?? row.priority,
          responsibleUserId: persisted?.responsibleUserId ?? '',
          actions: persisted?.actions ?? ['createIncident'],
          enabled: persisted?.enabled ?? row.enabled,
        })
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить правило')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, id])

  const selectedResponsible =
    draft && draft.responsibleUserId
      ? users.find((user) => user.id === draft.responsibleUserId) ?? null
      : null

  const conditionText = useMemo(() => {
    return ruleRow?.condition ?? ''
  }, [ruleRow])

  function handleSave() {
    if (!id || !draft) return
    saveRuleOverride(id, draft)
    setSaveInfo('Правило сохранено')
    setEditingEnabled(false)
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !ruleRow || !draft) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/rules')} sx={{ mb: 2 }}>
          Назад
        </Button>
        <Alert severity="error">{error ?? 'Правило не найдено'}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/rules')} sx={{ mb: 2 }}>
        Назад
      </Button>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h1">
          Просмотр правила и риска
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/app/risk-categories')}>
            Категории риска
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!editingEnabled}>
            Сохранить
          </Button>
        </Stack>
      </Box>

      {saveInfo ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveInfo(null)}>
          {saveInfo}
        </Alert>
      ) : null}

      <FormControlLabel
        sx={{ mb: 2 }}
        control={<Switch checked={editingEnabled} onChange={(event) => setEditingEnabled(event.target.checked)} />}
        label="Начать редактирование"
      />

      <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
        <TextField label="ID правила" value={ruleRow.id} disabled fullWidth />
        <TextField label="Название правила" value={ruleRow.name} disabled fullWidth />
        <TextField label="Условие срабатывания" value={conditionText} disabled fullWidth multiline minRows={3} />

        <FormControl fullWidth>
          <InputLabel id="rule-risk-object-label">Рисковый объект</InputLabel>
          <Select
            labelId="rule-risk-object-label"
            label="Рисковый объект"
            value={draft.riskObjectId}
            onChange={(event) => {
              const value = event.target.value
              setDraft((prev) => (prev ? { ...prev, riskObjectId: value } : prev))
            }}
            disabled={!editingEnabled || riskObjects.length === 0}
          >
            {riskObjects.map((riskObject) => (
              <MenuItem key={riskObject.id} value={riskObject.id}>
                {riskObject.code} - {riskObject.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {riskObjects.length === 0 ? (
          <Alert severity="info">
            Рисковые объекты еще не созданы. Создайте объект, чтобы привязать его к правилу.
            <Box sx={{ mt: 1 }}>
              <Button size="small" onClick={() => navigate('/app/risk-objects/new')}>
                Перейти к созданию рискового объекта
              </Button>
            </Box>
          </Alert>
        ) : null}

        <Stack spacing={1}>
          <Typography variant="subtitle2">Механизм обнаружения (groovy-скрипт)</Typography>
          <Button variant="outlined" component="label" disabled={!editingEnabled}>
            Загрузить скрипт
            <input
              hidden
              type="file"
              accept=".groovy,text/x-groovy,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file.text().then((content) => {
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          mechanismScriptName: file.name,
                          mechanismScriptContent: content,
                        }
                      : prev,
                  )
                })
              }}
            />
          </Button>
          <TextField
            label="Имя загруженного скрипта"
            value={draft.mechanismScriptName}
            placeholder="Скрипт не загружен"
            fullWidth
            InputProps={{ readOnly: true }}
          />
        </Stack>

        <FormControl fullWidth>
          <InputLabel id="rule-category-label">Категория риска</InputLabel>
          <Select
            labelId="rule-category-label"
            label="Категория риска"
            value={draft.categoryId}
            onChange={(event) => {
              const value = event.target.value
              setDraft((prev) => (prev ? { ...prev, categoryId: value } : prev))
            }}
            disabled={!editingEnabled}
          >
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel id="rule-priority-label">Приоритет по умолчанию</InputLabel>
          <Select
            labelId="rule-priority-label"
            label="Приоритет по умолчанию"
            value={draft.priority}
            onChange={(event) => {
              const value = event.target.value as RuleEditorDraft['priority']
              setDraft((prev) => (prev ? { ...prev, priority: value } : prev))
            }}
            disabled={!editingEnabled}
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          options={users}
          value={selectedResponsible}
          onChange={(_, value) => {
            setDraft((prev) => (prev ? { ...prev, responsibleUserId: value?.id ?? '' } : prev))
          }}
          getOptionLabel={(option) => (option.email ? `${option.name} (${option.email})` : option.name)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Ответственный по умолчанию"
              placeholder="Начните вводить имя"
            />
          )}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          noOptionsText="Пользователи не найдены"
          disabled={!editingEnabled}
        />

        <FormControl fullWidth>
          <InputLabel id="rule-actions-label">Действия при срабатывании</InputLabel>
          <Select
            labelId="rule-actions-label"
            label="Действия при срабатывании"
            multiple
            value={draft.actions}
            onChange={(event) => {
              const raw = event.target.value
              const values = (Array.isArray(raw) ? raw : [raw]).filter(
                (value): value is RuleAction => value === 'createIncident' || value === 'sendNotification',
              )
              setDraft((prev) => (prev ? { ...prev, actions: values } : prev))
            }}
            renderValue={(selected) => selected.map((item) => actionLabels[item]).join(', ')}
            disabled={!editingEnabled}
          >
            <MenuItem value="createIncident">
              <Checkbox checked={draft.actions.includes('createIncident')} />
              <ListItemText primary={actionLabels.createIncident} />
            </MenuItem>
            <MenuItem value="sendNotification">
              <Checkbox checked={draft.actions.includes('sendNotification')} />
              <ListItemText primary={actionLabels.sendNotification} />
            </MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={draft.enabled}
              onChange={(event) => {
                const value = event.target.checked
                setDraft((prev) => (prev ? { ...prev, enabled: value } : prev))
              }}
              disabled={!editingEnabled}
            />
          }
          label={draft.enabled ? 'Правило включено' : 'Правило выключено'}
        />
      </Stack>
    </Box>
  )
}
