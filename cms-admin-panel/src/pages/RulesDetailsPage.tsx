import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import {
  getRuleById,
  getRiskCategories,
  getRiskObjectById,
  getRuleRiskObjects,
  getUsersList,
  putRuleById,
  type RuleRiskObjectOption,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { RuleUpdatePayload } from '../types/risks'
import type { RiskObjectDetails } from '../types/riskObjects'
import {
  actionLabels,
  priorityLabels,
  type RiskCategoryOption,
  type RuleAction,
  type RuleEditorDraft,
  type RuleTableRow,
} from './rulesShared'

type UserOption = {
  id: string
  name: string
  email: string
}

type EditableRuleState = Omit<RuleUpdatePayload, 'description'>

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
  const { token, user, hasPermission } = useAuth()
  const canManageRulesAndRisks = hasPermission('manage_rules_and_risks')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveInfo, setSaveInfo] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [scriptFileLoading, setScriptFileLoading] = useState(false)
  const [editingEnabled, setEditingEnabled] = useState(false)

  const [ruleRow, setRuleRow] = useState<RuleTableRow | null>(null)
  const [riskObjects, setRiskObjects] = useState<RuleRiskObjectOption[]>([])
  const [riskObjectPreviewOpen, setRiskObjectPreviewOpen] = useState(false)
  const [riskObjectPreviewLoading, setRiskObjectPreviewLoading] = useState(false)
  const [riskObjectPreviewError, setRiskObjectPreviewError] = useState<string | null>(null)
  const [riskObjectPreview, setRiskObjectPreview] = useState<RiskObjectDetails | null>(null)
  const [categories, setCategories] = useState<RiskCategoryOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [ruleName, setRuleName] = useState('')
  const [ruleCondition, setRuleCondition] = useState('')
  const [draft, setDraft] = useState<RuleEditorDraft | null>(null)
  const [originalRule, setOriginalRule] = useState<EditableRuleState | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveComment, setSaveComment] = useState('')
  const [saveCommentError, setSaveCommentError] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<string[]>([])
  const canEdit = editingEnabled && canManageRulesAndRisks

  useEffect(() => {
    if (!token || !id) return
    let cancelled = false
    Promise.all([
      getRuleById(token, id, user?.companyId),
      getRuleRiskObjects(token, user?.companyId),
      getUsersList(token, user?.companyId),
      getRiskCategories(token, user?.companyId),
    ])
      .then(([rule, riskObjectItems, usersRaw, categoryItems]) => {
        if (cancelled) return
        const row: RuleTableRow = {
          id: rule.id,
          name: rule.name,
          condition: rule.condition,
          action: '',
          categoryId: rule.categoryId,
          categoryLabel: rule.categoryId,
          priority: rule.priority,
          enabled: rule.enabled,
          riskObjectId: rule.riskObjectId,
        }
        const selectedRiskObject =
          riskObjectItems.find(
            (item) => item.uuid === rule.riskObjectId || item.id === rule.riskObjectId,
          ) ?? null
        setRuleRow(row)
        setRuleName(rule.name)
        setRuleCondition(rule.condition)
        setRiskObjects(riskObjectItems)
        setCategories(categoryItems)
        setUsers(normalizeUsers(usersRaw))
        setDraft({
          riskObjectId: selectedRiskObject?.uuid ?? rule.riskObjectId,
          mechanismScriptName: rule.mechanismScriptName ?? '',
          mechanismScriptContent: rule.mechanismScriptContent ?? '',
          categoryId: rule.categoryId,
          priority: rule.priority,
          responsibleUserId: rule.responsibleUserId ?? '',
          actions: rule.actions && rule.actions.length > 0 ? rule.actions : ['createIncident'],
          enabled: rule.enabled,
        })
        setOriginalRule({
          name: rule.name,
          condition: rule.condition,
          categoryId: rule.categoryId,
          riskObjectId: selectedRiskObject?.uuid ?? rule.riskObjectId,
          priority: rule.priority,
          responsibleUserId: rule.responsibleUserId ?? '',
          actions: rule.actions && rule.actions.length > 0 ? rule.actions : ['createIncident'],
          enabled: rule.enabled,
          mechanismScriptName: rule.mechanismScriptName ?? '',
          mechanismScriptContent: rule.mechanismScriptContent ?? '',
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
  }, [token, id, user?.companyId])

  const selectedResponsible =
    draft && draft.responsibleUserId
      ? users.find((user) => user.id === draft.responsibleUserId) ?? null
      : null

  async function handleOpenRiskObjectPreview() {
    if (!token || !draft?.riskObjectId) return
    const selectedRiskObject = riskObjects.find((item) => item.uuid === draft.riskObjectId)
    const detailsId = selectedRiskObject?.detailsId ?? selectedRiskObject?.id ?? draft.riskObjectId
    setRiskObjectPreviewOpen(true)
    setRiskObjectPreviewLoading(true)
    setRiskObjectPreviewError(null)
    setRiskObjectPreview(null)
    try {
      const details = await getRiskObjectById(token, detailsId, user?.companyId)
      setRiskObjectPreview(details)
    } catch (e: unknown) {
      setRiskObjectPreviewError(
        e instanceof Error ? e.message : 'Не удалось загрузить рисковый объект',
      )
    } finally {
      setRiskObjectPreviewLoading(false)
    }
  }

  const riskObjectPreviewJson = useMemo(() => {
    if (!riskObjectPreview?.definition) return '{}'
    try {
      return JSON.stringify(riskObjectPreview.definition, null, 2)
    } catch {
      return '{}'
    }
  }, [riskObjectPreview])

  function buildEditableRuleState(currentDraft: RuleEditorDraft): EditableRuleState {
    return {
      name: ruleName.trim(),
      condition: ruleCondition.trim(),
      categoryId: currentDraft.categoryId,
      riskObjectId: currentDraft.riskObjectId,
      priority: currentDraft.priority,
      responsibleUserId: currentDraft.responsibleUserId,
      actions: currentDraft.actions,
      enabled: currentDraft.enabled,
      mechanismScriptName: currentDraft.mechanismScriptName,
      mechanismScriptContent: currentDraft.mechanismScriptContent,
    }
  }

  function getPendingChanges(next: EditableRuleState): string[] {
    if (!originalRule) return []
    const changes: string[] = []
    if (originalRule.name !== next.name) changes.push(`Название: "${originalRule.name}" -> "${next.name}"`)
    if (originalRule.condition !== next.condition) changes.push('Изменено условие срабатывания')
    if (originalRule.categoryId !== next.categoryId) {
      changes.push(`Категория: ${originalRule.categoryId} -> ${next.categoryId}`)
    }
    if (originalRule.riskObjectId !== next.riskObjectId) {
      changes.push(
        `Рисковый объект: ${originalRule.riskObjectId || 'не привязан'} -> ${next.riskObjectId || 'не привязан'}`,
      )
    }
    if (originalRule.priority !== next.priority) {
      changes.push(`Приоритет: ${priorityLabels[originalRule.priority]} -> ${priorityLabels[next.priority]}`)
    }
    if (originalRule.responsibleUserId !== next.responsibleUserId) changes.push('Изменен ответственный')
    if (originalRule.enabled !== next.enabled) {
      changes.push(`Статус: ${originalRule.enabled ? 'включено' : 'выключено'} -> ${next.enabled ? 'включено' : 'выключено'}`)
    }
    if (originalRule.mechanismScriptName !== next.mechanismScriptName) {
      changes.push('Изменен файл скрипта')
    }
    if (originalRule.mechanismScriptContent !== next.mechanismScriptContent) {
      changes.push('Изменено содержимое скрипта')
    }
    const originalActions = originalRule.actions.join(',')
    const nextActions = next.actions.join(',')
    if (originalActions !== nextActions) {
      changes.push('Изменены действия при срабатывании')
    }
    return changes
  }

  function handleOpenSaveDialog() {
    if (!canManageRulesAndRisks) return
    if (!id || !draft || !originalRule) return
    if (scriptFileLoading) {
      setError('Дождитесь загрузки содержимого файла скрипта')
      return
    }
    const normalizedName = ruleName.trim()
    const normalizedCondition = ruleCondition.trim()
    if (!normalizedName || !normalizedCondition) {
      setError('Заполните название и условие срабатывания')
      return
    }
    const nextState = buildEditableRuleState(draft)
    const changes = getPendingChanges(nextState)
    if (changes.length === 0) {
      setSaveInfo('Изменений для сохранения нет')
      return
    }
    setPendingChanges(changes)
    setSaveComment('')
    setSaveCommentError(null)
    setSaveDialogOpen(true)
  }

  async function handleSave() {
    if (!token) return
    if (!id || !draft || !originalRule) return
    const comment = saveComment.trim()
    if (!comment) {
      setSaveCommentError('Добавьте комментарий изменений')
      return
    }
    const nextState = buildEditableRuleState(draft)
    setSaveLoading(true)
    try {
      await putRuleById(
        token,
        id,
        {
          description: comment,
          ...nextState,
        },
        user?.companyId,
      )
      setRuleRow((prev) =>
        prev
          ? {
              ...prev,
              name: nextState.name,
              condition: nextState.condition,
              categoryId: nextState.categoryId,
              priority: nextState.priority,
              enabled: nextState.enabled,
              riskObjectId: nextState.riskObjectId,
            }
          : prev,
      )
      setOriginalRule(nextState)
      setSaveInfo('Правило сохранено')
      setEditingEnabled(false)
      setSaveDialogOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить правило')
    } finally {
      setSaveLoading(false)
    }
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
          <Button
            variant="outlined"
            onClick={() => navigate('/app/risk-categories')}
            disabled={!canManageRulesAndRisks}
          >
            Категории риска
          </Button>
          <Button
            variant="contained"
            onClick={() => handleOpenSaveDialog()}
            disabled={!canEdit || saveLoading || scriptFileLoading}
          >
            Сохранить
          </Button>
        </Stack>
      </Box>
      {!canManageRulesAndRisks ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Редактирование правил и рисков отключено.
        </Alert>
      ) : null}

      {saveInfo ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveInfo(null)}>
          {saveInfo}
        </Alert>
      ) : null}

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Switch
            checked={editingEnabled}
            onChange={(event) => setEditingEnabled(event.target.checked)}
            disabled={!canManageRulesAndRisks}
          />
        }
        label="Начать редактирование"
      />

      <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
        <TextField label="ID правила" value={ruleRow.id} disabled fullWidth />
        <TextField
          label="Название правила"
          value={ruleName}
          onChange={(event) => setRuleName(event.target.value)}
          disabled={!canEdit}
          fullWidth
        />
        <TextField
          label="Условие срабатывания"
          value={ruleCondition}
          onChange={(event) => setRuleCondition(event.target.value)}
          disabled={!canEdit}
          fullWidth
          multiline
          minRows={3}
        />

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
            disabled={!canEdit || riskObjects.length === 0}
          >
            {riskObjects.map((riskObject) => (
              <MenuItem key={riskObject.uuid} value={riskObject.uuid}>
                {riskObject.code ? `${riskObject.code} - ${riskObject.name}` : riskObject.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {riskObjects.length === 0 ? (
          <Alert severity="info">
            Рисковые объекты еще не созданы. Создайте объект, чтобы привязать его к правилу.
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                onClick={() => navigate('/app/risk-objects/new')}
                disabled={!canManageRulesAndRisks}
              >
                Перейти к созданию рискового объекта
              </Button>
            </Box>
          </Alert>
        ) : null}
        <Box sx={{ mt: -1 }}>
          <Button
            variant="outlined"
            startIcon={<VisibilityOutlinedIcon />}
            onClick={() => void handleOpenRiskObjectPreview()}
            disabled={!draft.riskObjectId}
          >
            Просмотреть рисковый объект
          </Button>
        </Box>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Механизм обнаружения (groovy-скрипт)</Typography>
          <Button variant="outlined" component="label" disabled={!canEdit}>
            Загрузить скрипт
            <input
              hidden
              type="file"
              accept=".groovy,text/x-groovy,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                setScriptFileLoading(true)
                setError(null)
                void file
                  .text()
                  .then((content) => {
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
                  .catch(() => {
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            mechanismScriptName: file.name,
                            mechanismScriptContent: '',
                          }
                        : prev,
                    )
                    setError('Не удалось прочитать файл скрипта')
                  })
                  .finally(() => {
                    setScriptFileLoading(false)
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
          {scriptFileLoading ? (
            <Typography variant="caption" color="text.secondary">
              Чтение файла скрипта...
            </Typography>
          ) : null}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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
          disabled={!canEdit}
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
            disabled={!canEdit}
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
              disabled={!canEdit}
            />
          }
          label={draft.enabled ? 'Правило включено' : 'Правило выключено'}
        />
      </Stack>

      <Dialog
        open={riskObjectPreviewOpen}
        onClose={() => setRiskObjectPreviewOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Просмотр рискового объекта</DialogTitle>
        <DialogContent dividers>
          {riskObjectPreviewLoading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : riskObjectPreviewError ? (
            <Alert severity="error">{riskObjectPreviewError}</Alert>
          ) : riskObjectPreview ? (
            <Stack spacing={2}>
              <TextField label="Код" value={riskObjectPreview.code} fullWidth disabled />
              <TextField label="Наименование" value={riskObjectPreview.name} fullWidth disabled />
              <TextField
                label="Статус"
                value={riskObjectPreview.status === 'active' ? 'Active' : 'Disable'}
                fullWidth
                disabled
              />
              <TextField
                label="Обновлён"
                value={
                  riskObjectPreview.updatedAt
                    ? new Date(riskObjectPreview.updatedAt).toLocaleString('ru-RU')
                    : ''
                }
                fullWidth
                disabled
              />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  JSON-структура
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                    fontSize: 12,
                    lineHeight: 1.5,
                    overflow: 'auto',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    maxHeight: 320,
                  }}
                >
                  {riskObjectPreviewJson}
                </Box>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRiskObjectPreviewOpen(false)}>Закрыть</Button>
          {riskObjectPreview?.id ? (
            <Button
              variant="outlined"
              onClick={() => navigate(`/app/risk-objects/${riskObjectPreview.id}?readonly=1`)}
            >
              Открыть полную карточку
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Подтвердите сохранение изменений</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2">Будут сохранены изменения:</Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {pendingChanges.map((line) => (
                <Typography key={line} component="li" variant="body2">
                  {line}
                </Typography>
              ))}
            </Box>
            <TextField
              label="Комментарий изменений (description)"
              value={saveComment}
              onChange={(event) => {
                setSaveComment(event.target.value)
                if (saveCommentError) setSaveCommentError(null)
              }}
              error={Boolean(saveCommentError)}
              helperText={saveCommentError ?? 'Этот текст будет отправлен в поле description'}
              required
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saveLoading}>
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
