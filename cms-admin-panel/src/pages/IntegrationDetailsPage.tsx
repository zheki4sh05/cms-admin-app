import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ClearAllOutlinedIcon from '@mui/icons-material/ClearAllOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Slide,
  type SlideProps,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getIntegrationConfigById,
  getRiskObjectModelById,
  getRiskObjectModels,
  putIntegrationConfigById,
  putIntegrationConfigStatusById,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type {
  IntegrationDetails,
  IntegrationMappingRule,
  IntegrationStatusUpdatePayload,
  IntegrationUpdatePayload,
} from '../types/integration'
import type { RiskObjectModelListItem } from '../types/integrationDraft'

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type MappingRow = {
  id: string
  from: string
  to: string
  applyJs: string
}

type EditorSnapshot = {
  name: string
  integrationKind: IntegrationDetails['integrationKind']
  endpointUrl: string
  riskObjectModelId: string
  status: IntegrationDetails['status']
  mappingRows: MappingRow[]
}

function flattenTargetPaths(def: Record<string, unknown>): string[] {
  const paths: string[] = []
  for (const [key, val] of Object.entries(def)) {
    if (
      val === null ||
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean'
    ) {
      paths.push(key)
      continue
    }
    if (Array.isArray(val)) {
      const first = val[0]
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        for (const inner of Object.keys(first as Record<string, unknown>)) {
          paths.push(`${key}[].${inner}`)
        }
      } else {
        paths.push(key)
      }
    }
  }
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b))
}

function toRows(rules: IntegrationMappingRule[]): MappingRow[] {
  if (!rules || rules.length === 0) return [{ id: newId(), from: '', to: '', applyJs: '' }]
  return rules.map((r) => ({
    id: newId(),
    from: r.from,
    to: r.to,
    applyJs: r.transform ?? '',
  }))
}

function toRules(rows: MappingRow[]): IntegrationMappingRule[] {
  return rows
    .filter((r) => r.from.trim() !== '' && r.to.trim() !== '')
    .map((r) => ({
      from: r.from.trim(),
      to: r.to.trim(),
      ...(r.applyJs.trim() ? { transform: r.applyJs.trim() } : {}),
    }))
}

function exportFilename(name: string): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)
  return safe ? `${safe}.json` : 'integration.json'
}

function downloadJsonFile(filename: string, jsonText: string) {
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function IntegrationDetailsPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { token } = useAuth()
  const isReadOnlyView = searchParams.get('readonly') === '1'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingEnabled, setEditingEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const canEdit = editingEnabled && !isReadOnlyView

  const [number, setNumber] = useState(0)
  const [authorName, setAuthorName] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [name, setName] = useState('')
  const [integrationKind, setIntegrationKind] = useState<IntegrationDetails['integrationKind']>('pull')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [riskObjectModelId, setRiskObjectModelId] = useState('')
  const [status, setStatus] = useState<IntegrationDetails['status']>('active')
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([{ id: newId(), from: '', to: '', applyJs: '' }])
  const [initialSnapshot, setInitialSnapshot] = useState<EditorSnapshot | null>(null)

  const [riskModels, setRiskModels] = useState<RiskObjectModelListItem[]>([])
  const [riskModelsLoading, setRiskModelsLoading] = useState(true)
  const [riskModelsError, setRiskModelsError] = useState<string | null>(null)
  const [modelDefinition, setModelDefinition] = useState<Record<string, unknown> | null>(null)
  const [modelDefinitionLoading, setModelDefinitionLoading] = useState(false)
  const [modelDefinitionError, setModelDefinitionError] = useState<string | null>(null)

  type OperationToast = { severity: 'success' | 'error'; text: string }
  const [toast, setToast] = useState<OperationToast | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const showToast = useCallback((payload: OperationToast) => {
    setToast(payload)
    setToastOpen(true)
  }, [])
  const handleToastClose = useCallback(
    (_: SyntheticEvent | Event, _reason?: 'timeout' | 'clickaway' | 'escapeKeyDown') => {
      setToastOpen(false)
    },
    [],
  )
  const handleToastExited = useCallback(() => setToast(null), [])

  const targetPaths = useMemo(
    () => (modelDefinition ? flattenTargetPaths(modelDefinition) : []),
    [modelDefinition],
  )

  const previewJson = useMemo(() => {
    try {
      return JSON.stringify({ mapping_rules: toRules(mappingRows) }, null, 2)
    } catch {
      return '{"mapping_rules":[]}'
    }
  }, [mappingRows])

  const setFromSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setName(snapshot.name)
    setIntegrationKind(snapshot.integrationKind)
    setEndpointUrl(snapshot.endpointUrl)
    setRiskObjectModelId(snapshot.riskObjectModelId)
    setStatus(snapshot.status)
    setMappingRows(snapshot.mappingRows.map((r) => ({ ...r, id: newId() })))
  }, [])

  useEffect(() => {
    if (!token || !id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setRiskModelsLoading(true)
    setRiskModelsError(null)
    Promise.all([getIntegrationConfigById(token, id), getRiskObjectModels(token)])
      .then(([details, models]) => {
        if (cancelled) return
        setRiskModels(models)
        setRiskModelsError(null)
        setNumber(details.number)
        setAuthorName(details.authorName)
        setUpdatedAt(details.updatedAt)
        const rows = toRows(details.mapping_rules)
        setName(details.name)
        setIntegrationKind(details.integrationKind)
        setEndpointUrl(details.endpointUrl)
        setRiskObjectModelId(details.riskObjectModelId)
        setStatus(details.status)
        setMappingRows(rows)
        setInitialSnapshot({
          name: details.name,
          integrationKind: details.integrationKind,
          endpointUrl: details.endpointUrl,
          riskObjectModelId: details.riskObjectModelId,
          status: details.status,
          mappingRows: rows,
        })
        setEditingEnabled(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки интеграции')
          setRiskModelsError(e instanceof Error ? e.message : 'Ошибка загрузки списка моделей')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRiskModelsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, id])

  useEffect(() => {
    if (!token || !riskObjectModelId) {
      setModelDefinition(null)
      setModelDefinitionLoading(false)
      setModelDefinitionError(null)
      return
    }
    let cancelled = false
    setModelDefinitionLoading(true)
    setModelDefinitionError(null)
    getRiskObjectModelById(token, riskObjectModelId)
      .then((model) => {
        if (!cancelled) setModelDefinition(model.definition)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setModelDefinition(null)
          setModelDefinitionError(e instanceof Error ? e.message : 'Не удалось загрузить структуру модели')
        }
      })
      .finally(() => {
        if (!cancelled) setModelDefinitionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, riskObjectModelId])

  const patchMappingRow = useCallback((rowId: string, patch: Partial<MappingRow>) => {
    setMappingRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }, [])

  const addMappingRow = useCallback(() => {
    setMappingRows((prev) => [...prev, { id: newId(), from: '', to: '', applyJs: '' }])
  }, [])

  const removeMappingRow = useCallback((rowId: string) => {
    setMappingRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId)
      return next.length > 0 ? next : [{ id: newId(), from: '', to: '', applyJs: '' }]
    })
  }, [])

  useEffect(() => {
    setMappingRows((prev) =>
      prev.map((row) => ({
        ...row,
        to: targetPaths.length === 0 || targetPaths.includes(row.to) ? row.to : '',
      })),
    )
  }, [riskObjectModelId, targetPaths])

  const handleReset = useCallback(() => {
    if (!initialSnapshot) return
    setFromSnapshot(initialSnapshot)
    setEditingEnabled(false)
    showToast({ severity: 'success', text: 'Изменения сброшены.' })
  }, [initialSnapshot, setFromSnapshot, showToast])

  const handleSave = useCallback(async () => {
    if (isReadOnlyView) return
    if (!token || !id) {
      showToast({ severity: 'error', text: 'Нет сессии — войдите снова.' })
      return
    }
    setSaving(true)
    const payload: IntegrationUpdatePayload = {
      name: name.trim() || 'Без названия',
      integrationKind,
      endpointUrl: endpointUrl.trim(),
      riskObjectModelId: riskObjectModelId.trim(),
      mapping_rules: toRules(mappingRows),
    }
    try {
      const res = await putIntegrationConfigById(token, id, payload)
      setUpdatedAt(res.savedAt)
      setAuthorName('Алексей Иванов')
      const snapshot: EditorSnapshot = {
        name: payload.name,
        integrationKind: payload.integrationKind,
        endpointUrl: payload.endpointUrl,
        riskObjectModelId: payload.riskObjectModelId,
        status,
        mappingRows,
      }
      setInitialSnapshot(snapshot)
      setEditingEnabled(false)
      showToast({ severity: 'success', text: 'Интеграция сохранена.' })
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось сохранить интеграцию',
      })
    } finally {
      setSaving(false)
    }
  }, [
    isReadOnlyView,
    token,
    id,
    name,
    integrationKind,
    endpointUrl,
    riskObjectModelId,
    mappingRows,
    status,
    showToast,
  ])

  const handleStatusSwitch = useCallback(
    async (checked: boolean) => {
      if (isReadOnlyView) return
      if (!token || !id) {
        showToast({ severity: 'error', text: 'Нет сессии — войдите снова.' })
        return
      }
      const prevStatus = status
      const nextStatus: IntegrationDetails['status'] = checked ? 'active' : 'inactive'
      setStatus(nextStatus)
      setStatusUpdating(true)
      try {
        const payload: IntegrationStatusUpdatePayload = { status: nextStatus }
        const result = await putIntegrationConfigStatusById(token, id, payload)
        setUpdatedAt(result.savedAt)
        setAuthorName('Алексей Иванов')
        setInitialSnapshot((prev) =>
          prev
            ? {
                ...prev,
                status: nextStatus,
              }
            : prev,
        )
        showToast({
          severity: 'success',
          text: nextStatus === 'active' ? 'Статус: Active.' : 'Статус: Disable.',
        })
      } catch (e: unknown) {
        setStatus(prevStatus)
        showToast({
          severity: 'error',
          text: e instanceof Error ? e.message : 'Не удалось обновить статус интеграции',
        })
      } finally {
        setStatusUpdating(false)
      }
    },
    [isReadOnlyView, token, id, status, showToast],
  )

  const handleExport = useCallback(() => {
    const payload: IntegrationUpdatePayload = {
      name,
      integrationKind,
      endpointUrl,
      riskObjectModelId,
      mapping_rules: toRules(mappingRows),
    }
    downloadJsonFile(exportFilename(name), JSON.stringify(payload, null, 2))
    showToast({ severity: 'success', text: 'Экспорт выполнен.' })
  }, [name, integrationKind, endpointUrl, riskObjectModelId, mappingRows, showToast])

  if (loading) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/integration')} sx={{ mb: 2 }}>
          Назад
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/integration')} sx={{ mb: 2 }}>
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
          Просмотр интеграции
        </Typography>
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, alignItems: 'center' }}>
          <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => void handleSave()} disabled={!canEdit || saving}>
            Сохранить
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
            Экспорт
          </Button>
          <Button size="small" variant="outlined" color="warning" startIcon={<ClearAllOutlinedIcon />} onClick={() => setClearDialogOpen(true)} disabled={!canEdit}>
            Сбросить
          </Button>
        </Stack>
      </Box>

      {isReadOnlyView ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Страница открыта в режиме просмотра: редактирование отключено.
        </Typography>
      ) : (
        <FormControlLabel
          sx={{ mb: 2 }}
          control={<Switch checked={editingEnabled} onChange={(e) => setEditingEnabled(e.target.checked)} />}
          label="Начать редактирование"
        />
      )}

      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Сбросить изменения?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Текущие несохранённые изменения будут удалены.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Отмена</Button>
          <Button
            color="warning"
            variant="contained"
            autoFocus
            onClick={() => {
              setClearDialogOpen(false)
              handleReset()
            }}
          >
            Сбросить
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: 'flex-start',
          gap: 3,
        }}
      >
        <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
          <TextField label="№" value={number} fullWidth disabled />
          <TextField
            label="Название интеграции"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            disabled={!canEdit}
          />

          <FormControl fullWidth>
            <FormLabel sx={{ mb: 1 }}>Вид интеграции</FormLabel>
            <ToggleButtonGroup
              exclusive
              value={integrationKind}
              onChange={(_, value: IntegrationDetails['integrationKind'] | null) => {
                if (!value) return
                setIntegrationKind(value)
              }}
              fullWidth
              disabled={!canEdit}
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="pull" sx={{ flex: 1, textTransform: 'none' }}>
                Pull
              </ToggleButton>
              <ToggleButton value="push" sx={{ flex: 1, textTransform: 'none' }}>
                Push
              </ToggleButton>
              <ToggleButton value="broker" sx={{ flex: 1, textTransform: 'none' }}>
                Broker
              </ToggleButton>
            </ToggleButtonGroup>
          </FormControl>

          <TextField
            label="URL"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            fullWidth
            disabled={!canEdit}
          />

          <FormControlLabel
            control={
              <Switch
                checked={status === 'active'}
                onChange={(e) => void handleStatusSwitch(e.target.checked)}
                disabled={statusUpdating || saving || isReadOnlyView}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">Статус:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {status === 'active' ? 'Active' : 'Disable'}
                </Typography>
                {statusUpdating ? <CircularProgress size={14} /> : null}
              </Box>
            }
          />

          <TextField label="Автор изменения" value={authorName} fullWidth disabled />
          <TextField label="Обновлён" value={updatedAt ? new Date(updatedAt).toLocaleString('ru-RU') : ''} fullWidth disabled />

          <FormControl
            fullWidth
            disabled={!canEdit || riskModelsLoading || riskModels.length === 0}
            error={Boolean(riskModelsError)}
          >
            <FormLabel id="risk-object-model-label" sx={{ mb: 0.75, display: 'block' }}>
              Модель рискового объекта
            </FormLabel>
            <Select
              aria-labelledby="risk-object-model-label"
              value={riskObjectModelId}
              onChange={(e) => setRiskObjectModelId(e.target.value as string)}
              disabled={!canEdit}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) {
                  return (
                    <Typography component="span" color="text.secondary">
                      {riskModels.length === 0 && !riskModelsLoading
                        ? 'Нет доступных моделей'
                        : '— не выбрано —'}
                    </Typography>
                  )
                }
                const m = riskModels.find((x) => x.id === selected)
                return m ? m.name : selected
              }}
            >
              {riskModels.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
            {riskModelsLoading ? (
              <FormHelperText>Загрузка списка…</FormHelperText>
            ) : riskModelsError ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {riskModelsError}
              </Alert>
            ) : riskModels.length === 0 ? (
              <FormHelperText>Список моделей пуст.</FormHelperText>
            ) : null}
          </FormControl>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              Сопоставление полей
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {isReadOnlyView
                ? 'Эта карточка открыта только для просмотра.'
                : 'В режиме просмотра поля отключены. Включите «Начать редактирование», чтобы менять правила.'}
            </Typography>
            {riskObjectModelId && modelDefinitionLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Загрузка структуры модели…
                </Typography>
              </Box>
            ) : null}
            {modelDefinitionError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {modelDefinitionError}
              </Alert>
            ) : null}
            <Stack spacing={2}>
              {mappingRows.map((row, index) => (
                <Paper key={row.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Правило {index + 1}
                      </Typography>
                      <IconButton size="small" onClick={() => removeMappingRow(row.id)} disabled={!canEdit}>
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <TextField
                      label="Взять из"
                      value={row.from}
                      onChange={(e) => patchMappingRow(row.id, { from: e.target.value })}
                      fullWidth
                      size="small"
                      disabled={!canEdit}
                    />
                    {modelDefinitionLoading ? (
                      <TextField
                        label="Преобразовать в"
                        value=""
                        fullWidth
                        size="small"
                        disabled
                        placeholder="Загрузка схемы…"
                      />
                    ) : targetPaths.length > 0 ? (
                      <FormControl fullWidth size="small">
                        <FormLabel id={`map-to-${row.id}`} sx={{ mb: 0.5, display: 'block', typography: 'body2', fontWeight: 500 }}>
                          Преобразовать в
                        </FormLabel>
                        <Select
                          aria-labelledby={`map-to-${row.id}`}
                          value={row.to}
                          onChange={(e) => patchMappingRow(row.id, { to: e.target.value as string })}
                          disabled={!canEdit}
                        >
                          <MenuItem value="">
                            <em>— не выбрано —</em>
                          </MenuItem>
                          {targetPaths.map((p) => (
                            <MenuItem key={p} value={p}>
                              {p}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        label="Преобразовать в"
                        value={row.to}
                        onChange={(e) => patchMappingRow(row.id, { to: e.target.value })}
                        fullWidth
                        size="small"
                        disabled={!canEdit}
                        helperText={
                          modelDefinitionError
                            ? undefined
                            : modelDefinition
                              ? 'В схеме нет распознанных путей — введите вручную.'
                              : 'Структура модели не загружена.'
                        }
                      />
                    )}
                    <TextField
                      label="Применив"
                      value={row.applyJs}
                      onChange={(e) => patchMappingRow(row.id, { applyJs: e.target.value })}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      disabled={!canEdit}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <Button variant="outlined" onClick={addMappingRow} sx={{ mt: 2 }} disabled={!canEdit}>
              Добавить правило
            </Button>
          </Box>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            width: '100%',
            flex: { lg: '0 0 380px' },
            maxWidth: { lg: 420 },
            position: { lg: 'sticky' },
            top: { lg: 16 },
            alignSelf: 'stretch',
            p: 2,
            maxHeight: { lg: 'calc(100vh - 120px)' },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 200,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Готовый JSON
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
              flex: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {previewJson}
          </Box>
        </Paper>
      </Box>

      <Snackbar
        open={toastOpen}
        autoHideDuration={5600}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slots={{ transition: Slide }}
        slotProps={{
          transition: {
            appear: true,
            direction: 'up',
            timeout: { enter: 400, exit: 320 },
            onExited: handleToastExited,
          } as SlideProps,
        }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            elevation={6}
            onClose={() => setToastOpen(false)}
            sx={{ minWidth: { xs: 260, sm: 300 }, maxWidth: 440, borderRadius: 2 }}
          >
            {toast.text}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  )
}

