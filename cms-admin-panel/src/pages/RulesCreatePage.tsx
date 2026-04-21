import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getRiskCategories,
  getRuleRiskObjects,
  getUsersList,
  postRuleCreate,
  type RuleRiskObjectOption,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  actionLabels,
  priorityLabels,
  type RiskCategoryOption,
  type RuleAction,
  type RuleEditorDraft,
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

export function RulesCreatePage() {
  const navigate = useNavigate()
  const { token, user, hasPermission } = useAuth()
  const canManageRulesAndRisks = hasPermission('manage_rules_and_risks')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<RiskCategoryOption[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [riskObjectId, setRiskObjectId] = useState('')
  const [riskObjects, setRiskObjects] = useState<RuleRiskObjectOption[]>([])
  const [mechanismScriptName, setMechanismScriptName] = useState('')
  const [mechanismScriptContent, setMechanismScriptContent] = useState('')
  const [priority, setPriority] = useState<RuleEditorDraft['priority']>('medium')
  const [responsibleUserId, setResponsibleUserId] = useState('')
  const [actions, setActions] = useState<RuleAction[]>(['createIncident'])
  const [enabled, setEnabled] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [scriptFileLoading, setScriptFileLoading] = useState(false)

  const [loadingRiskObjects, setLoadingRiskObjects] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoadingCategories(true)
    getRiskCategories(token, user?.companyId)
      .then((items) => {
        if (cancelled) return
        setCategories(items)
        setCategoryId((prev) => prev || items[0]?.id || '')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить категории риска')
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoadingRiskObjects(true)
    setError(null)
    getRuleRiskObjects(token, user?.companyId)
      .then((items) => {
        if (cancelled) return
        setRiskObjects(items)
        setRiskObjectId((prev) => {
          if (items.length === 0) return ''
          if (!prev) return items[0].uuid
          const matched = items.find((item) => item.uuid === prev || item.id === prev)
          return matched?.uuid ?? ''
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить рисковые объекты')
      })
      .finally(() => {
        if (!cancelled) setLoadingRiskObjects(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoadingUsers(true)
    getUsersList(token, user?.companyId)
      .then((items) => {
        if (cancelled) return
        setUsers(normalizeUsers(items))
      })
      .catch(() => {
        if (cancelled) return
        setUsers([])
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId])

  const selectedResponsible = useMemo(
    () => users.find((user) => user.id === responsibleUserId) ?? null,
    [users, responsibleUserId],
  )

  const handleSave = useCallback(async () => {
    if (!token) return
    if (!canManageRulesAndRisks) {
      setError('Недостаточно прав для редактирования')
      return
    }
    if (!name.trim() || !description.trim()) {
      setError('Заполните название и описание')
      return
    }
    if (!categoryId) {
      setError('Выберите категорию риска')
      return
    }
    if (scriptFileLoading) {
      setError('Дождитесь загрузки содержимого файла скрипта')
      return
    }
    const selectedRiskObject = riskObjects.find(
      (item) => item.uuid === riskObjectId || item.id === riskObjectId,
    )
    const riskObjectUuid = selectedRiskObject?.uuid ?? ''
    if (riskObjectId && !riskObjectUuid) {
      setError('Не найден выбранный рисковый объект в каталоге моделей')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await postRuleCreate(
        token,
        {
        name: name.trim(),
        condition: description.trim(),
        categoryId,
        riskObjectId: riskObjectUuid || undefined,
        priority,
        responsibleUserId: responsibleUserId || undefined,
        actions,
        enabled: riskObjectUuid ? enabled : false,
        mechanismScriptName,
        mechanismScriptContent,
        },
        user?.companyId,
      )
      setSuccess('Правило риска создано')
      navigate(`/app/rules/${result.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось создать правило риска')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    name,
    description,
    categoryId,
    riskObjectId,
    riskObjects,
    mechanismScriptName,
    mechanismScriptContent,
    priority,
    responsibleUserId,
    actions,
    enabled,
    scriptFileLoading,
    user?.companyId,
    canManageRulesAndRisks,
    navigate,
  ])

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/rules')} sx={{ mb: 2 }}>
        Назад
      </Button>

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
          Создание правила риска
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          onClick={() => void handleSave()}
          disabled={
            saving ||
            scriptFileLoading ||
            loadingRiskObjects ||
            loadingUsers ||
            loadingCategories ||
            !canManageRulesAndRisks
          }
        >
          Сохранить
        </Button>
      </Box>
      {!canManageRulesAndRisks ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Создание и редактирование правил отключено.
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Название риска"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            disabled={!canManageRulesAndRisks}
          />
          <TextField
            label="Описание / условие срабатывания"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            disabled={!canManageRulesAndRisks}
          />
          <FormControl fullWidth>
            <InputLabel id="create-rule-category-label">Категория риска</InputLabel>
            <Select
              labelId="create-rule-category-label"
              label="Категория риска"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canManageRulesAndRisks || loadingCategories}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            fullWidth
            disabled={!canManageRulesAndRisks || loadingRiskObjects || riskObjects.length === 0}
          >
            <InputLabel id="create-rule-risk-object-label">Рисковый объект</InputLabel>
            <Select
              labelId="create-rule-risk-object-label"
              label="Рисковый объект"
              value={riskObjectId}
              onChange={(e) => {
                const value = e.target.value
                setRiskObjectId(value)
                if (!value) setEnabled(false)
              }}
            >
              <MenuItem value="">
                <em>— не выбрано —</em>
              </MenuItem>
              {riskObjects.map((riskObject) => (
                <MenuItem key={riskObject.uuid} value={riskObject.uuid}>
                  {riskObject.code ? `${riskObject.code} - ${riskObject.name}` : riskObject.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Механизм обнаружения (groovy-скрипт)</Typography>
            <Button
              variant="outlined"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={!canManageRulesAndRisks}
            >
              Загрузить скрипт
            </Button>
            <input
              ref={fileInputRef}
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
                    setMechanismScriptName(file.name)
                    setMechanismScriptContent(content)
                  })
                  .catch(() => {
                    setMechanismScriptName(file.name)
                    setMechanismScriptContent('')
                    setError('Не удалось прочитать файл скрипта')
                  })
                  .finally(() => {
                    setScriptFileLoading(false)
                  })
              }}
            />
            <TextField
              label="Имя загруженного скрипта"
              value={mechanismScriptName}
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
            <InputLabel id="create-rule-priority-label">Приоритет по умолчанию</InputLabel>
            <Select
              labelId="create-rule-priority-label"
              label="Приоритет по умолчанию"
              value={priority}
              onChange={(event) => setPriority(event.target.value as RuleEditorDraft['priority'])}
              disabled={!canManageRulesAndRisks}
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
            onChange={(_, value) => setResponsibleUserId(value?.id ?? '')}
            getOptionLabel={(option) => (option.email ? `${option.name} (${option.email})` : option.name)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ответственный по умолчанию"
                placeholder={loadingUsers ? 'Загрузка пользователей…' : 'Начните вводить имя'}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={loadingUsers ? 'Загрузка…' : 'Пользователи не найдены'}
            disabled={loadingUsers || !canManageRulesAndRisks}
          />

          <FormControl fullWidth>
            <InputLabel id="create-rule-actions-label">Действия при срабатывании</InputLabel>
            <Select
              labelId="create-rule-actions-label"
              label="Действия при срабатывании"
              multiple
              value={actions}
              onChange={(event) => {
                const raw = event.target.value
                const values = (Array.isArray(raw) ? raw : [raw]).filter(
                  (value): value is RuleAction =>
                    value === 'createIncident' || value === 'sendNotification',
                )
                setActions(values)
              }}
              renderValue={(selected) => selected.map((item) => actionLabels[item]).join(', ')}
              disabled={!canManageRulesAndRisks}
            >
              <MenuItem value="createIncident">
                <Checkbox checked={actions.includes('createIncident')} />
                <ListItemText primary={actionLabels.createIncident} />
              </MenuItem>
              <MenuItem value="sendNotification">
                <Checkbox checked={actions.includes('sendNotification')} />
                <ListItemText primary={actionLabels.sendNotification} />
              </MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={!riskObjectId || !canManageRulesAndRisks}
              />
            }
            label={
              riskObjectId
                ? enabled
                  ? 'Правило включено'
                  : 'Правило выключено'
                : 'Правило выключено (сначала выберите рисковый объект)'
            }
          />
        </Stack>
      </Paper>
    </Box>
  )
}
