import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ClearAllOutlinedIcon from '@mui/icons-material/ClearAllOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
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
  Divider,
  FormControl,
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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getRiskObjectModelById,
  getRiskObjectModels,
  postIntegrationConfigCreate,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type {
  IntegrationKind,
  IntegrationMappingRule,
  RiskObjectModelListItem,
} from '../types/integrationDraft'
import type { IntegrationUpdatePayload } from '../types/integration'

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Пути полей цели из схемы definition (как в экспорте рискового объекта). */
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

type MappingRow = {
  id: string
  from: string
  to: string
  applyJs: string
}

function createEmptyMappingRow(): MappingRow {
  return { id: newId(), from: '', to: '', applyJs: '' }
}

function buildMappingRules(rows: MappingRow[]): IntegrationMappingRule[] {
  return rows
    .filter((r) => r.from.trim() !== '' && r.to.trim() !== '')
    .map((r) => {
      const rule: IntegrationMappingRule = {
        from: r.from.trim(),
        to: r.to.trim(),
      }
      const t = r.applyJs.trim()
      if (t) rule.transform = t
      return rule
    })
}

function buildPayload(
  name: string,
  integrationKind: IntegrationKind | '',
  endpointUrl: string,
  riskObjectModelId: string,
  mappingRows: MappingRow[],
): Omit<IntegrationUpdatePayload, 'integrationKind'> & { integrationKind: IntegrationKind | '' } {
  return {
    name,
    integrationKind,
    endpointUrl,
    riskObjectModelId,
    mapping_rules: buildMappingRules(mappingRows),
  }
}

function integrationExportFilename(name: string): string {
  const raw = name.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)
  return raw ? `${raw}.json` : 'integration-draft.json'
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

function mappingRulesToRows(rules: unknown): MappingRow[] {
  if (!Array.isArray(rules)) return [createEmptyMappingRow()]
  const rows: MappingRow[] = []
  for (const item of rules) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    rows.push({
      id: newId(),
      from: typeof o.from === 'string' ? o.from : '',
      to: typeof o.to === 'string' ? o.to : '',
      applyJs: typeof o.transform === 'string' ? o.transform : '',
    })
  }
  return rows.length > 0 ? rows : [createEmptyMappingRow()]
}

const VALID_INTEGRATION_KINDS = new Set<IntegrationKind>(['pull', 'push', 'broker'])

type IntegrationImportData = {
  name: string
  integrationKind: IntegrationKind | ''
  endpointUrl: string
  riskObjectModelId: string
  mappingRows: MappingRow[]
}

function parseIntegrationImport(
  text: string,
): { ok: true; data: IntegrationImportData } | { ok: false; message: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, message: 'Файл не является корректным JSON.' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'Корень документа должен быть объектом { … }.' }
  }
  const obj = parsed as Record<string, unknown>

  const name = typeof obj.name === 'string' ? obj.name : ''
  const endpointUrl = typeof obj.endpointUrl === 'string' ? obj.endpointUrl : ''
  const riskObjectModelId =
    typeof obj.riskObjectModelId === 'string'
      ? obj.riskObjectModelId
      : typeof obj.riskObjectId === 'string'
        ? obj.riskObjectId
        : ''

  let integrationKind: IntegrationKind | '' = ''
  const rawKind = obj.integrationKind
  if (typeof rawKind === 'string' && VALID_INTEGRATION_KINDS.has(rawKind as IntegrationKind)) {
    integrationKind = rawKind as IntegrationKind
  }

  return {
    ok: true,
    data: {
      name,
      integrationKind,
      endpointUrl,
      riskObjectModelId,
      mappingRows: mappingRulesToRows(obj.mapping_rules),
    },
  }
}

export function IntegrationCreatePage() {
  const navigate = useNavigate()
  const { token, hasPermission } = useAuth()
  const canManageIntegrations = hasPermission('manage_integrations')

  const [name, setName] = useState('')
  const [integrationKind, setIntegrationKind] = useState<IntegrationKind | ''>('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [riskObjectModelId, setRiskObjectModelId] = useState('')

  const [mappingRows, setMappingRows] = useState<MappingRow[]>([])

  const [riskModels, setRiskModels] = useState<RiskObjectModelListItem[]>([])
  const [riskModelsLoading, setRiskModelsLoading] = useState(true)
  const [riskModelsError, setRiskModelsError] = useState<string | null>(null)
  const [modelDefinition, setModelDefinition] = useState<Record<string, unknown> | null>(null)
  const [modelDefinitionLoading, setModelDefinitionLoading] = useState(false)
  const [modelDefinitionError, setModelDefinitionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

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

  const handleToastExited = useCallback(() => {
    setToast(null)
  }, [])

  const targetPaths = useMemo(
    () => (modelDefinition ? flattenTargetPaths(modelDefinition) : []),
    [modelDefinition],
  )

  const mappingPreviewJson = useMemo(() => {
    const mapping_rules = buildMappingRules(mappingRows)
    try {
      return JSON.stringify({ mapping_rules }, null, 2)
    } catch {
      return '{"mapping_rules":[]}'
    }
  }, [mappingRows])

  const loadRiskModels = useCallback(async () => {
    if (!token) return
    setRiskModelsLoading(true)
    setRiskModelsError(null)
    try {
      const items = await getRiskObjectModels(token)
      setRiskModels(items)
    } catch (e: unknown) {
      setRiskModelsError(e instanceof Error ? e.message : 'Ошибка загрузки списка')
      setRiskModels([])
    } finally {
      setRiskModelsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadRiskModels()
  }, [loadRiskModels])

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

  useEffect(() => {
    if (!riskObjectModelId) {
      setMappingRows([])
      return
    }
    setMappingRows((prev) => {
      if (prev.length === 0) return [createEmptyMappingRow()]
      const paths = modelDefinition ? flattenTargetPaths(modelDefinition) : []
      return prev.map((row) => ({
        ...row,
        to: paths.length === 0 || paths.includes(row.to) ? row.to : '',
      }))
    })
  }, [riskObjectModelId, modelDefinition])

  const addMappingRow = useCallback(() => {
    setMappingRows((prev) => [...prev, createEmptyMappingRow()])
  }, [])

  const removeMappingRow = useCallback((id: string) => {
    setMappingRows((prev) => {
      const next = prev.filter((r) => r.id !== id)
      return next.length > 0 ? next : [createEmptyMappingRow()]
    })
  }, [])

  const patchMappingRow = useCallback((id: string, patch: Partial<MappingRow>) => {
    setMappingRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
  }, [])

  const handleToolbarSave = useCallback(async () => {
    if (!token) {
      showToast({ severity: 'error', text: 'Нет сессии — войдите снова.' })
      return
    }
    if (!canManageIntegrations) {
      showToast({ severity: 'error', text: 'Недостаточно прав для редактирования' })
      return
    }
    const payload = buildPayload(
      name,
      integrationKind,
      endpointUrl,
      riskObjectModelId,
      mappingRows,
    )
    if (
      payload.name.trim() === '' ||
      payload.integrationKind === '' ||
      payload.endpointUrl.trim() === '' ||
      payload.riskObjectModelId.trim() === ''
    ) {
      showToast({
        severity: 'error',
        text: 'Заполните обязательные поля: название, вид, URL и модель рискового объекта.',
      })
      return
    }
    setSaving(true)
    try {
      await postIntegrationConfigCreate(token, {
        ...payload,
        integrationKind: payload.integrationKind,
      })
      showToast({ severity: 'success', text: 'Интеграция создана.' })
      navigate('/app/integration')
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось создать интеграцию.',
      })
    } finally {
      setSaving(false)
    }
  }, [
    token,
    canManageIntegrations,
    name,
    integrationKind,
    endpointUrl,
    riskObjectModelId,
    mappingRows,
    showToast,
    navigate,
  ])

  const handleExport = useCallback(() => {
    const payload = buildPayload(
      name,
      integrationKind,
      endpointUrl,
      riskObjectModelId,
      mappingRows,
    )
    downloadJsonFile(integrationExportFilename(name), JSON.stringify(payload, null, 2))
    showToast({ severity: 'success', text: 'Экспорт выполнен.' })
  }, [name, integrationKind, endpointUrl, riskObjectModelId, mappingRows, showToast])

  const confirmClear = useCallback(() => {
    setName('')
    setIntegrationKind('')
    setEndpointUrl('')
    setRiskObjectModelId('')
    setMappingRows([])
    setModelDefinition(null)
    setModelDefinitionError(null)
    setClearDialogOpen(false)
    showToast({ severity: 'success', text: 'Форма очищена.' })
  }, [showToast])

  const onImportFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const r = parseIntegrationImport(text)
        if (!r.ok) {
          showToast({ severity: 'error', text: r.message })
          return
        }
        const d = r.data
        setName(d.name)
        setIntegrationKind(d.integrationKind)
        setEndpointUrl(d.endpointUrl)
        setRiskObjectModelId(d.riskObjectModelId)
        setMappingRows(d.mappingRows)
        showToast({ severity: 'success', text: 'Данные загружены из файла.' })
      }
      reader.onerror = () => {
        showToast({ severity: 'error', text: 'Не удалось прочитать файл.' })
      }
      reader.readAsText(file, 'UTF-8')
    },
    [showToast],
  )

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/app/integration')}
        sx={{ mb: 2 }}
      >
        Назад
      </Button>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1">
          Создание новой интеграции
        </Typography>
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExport}
            disabled={!canManageIntegrations}
          >
            Экспорт
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => void handleToolbarSave()}
            disabled={!token || saving || !canManageIntegrations}
          >
            Сохранить
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ClearAllOutlinedIcon />}
            onClick={() => setClearDialogOpen(true)}
            disabled={!canManageIntegrations}
          >
            Очистить
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<UploadFileOutlinedIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canManageIntegrations}
          >
            Импорт
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImportFile}
          />
        </Stack>
      </Box>
      {!canManageIntegrations ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Создание и редактирование интеграций отключено.
        </Alert>
      ) : null}

      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Очистить форму?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Будут сброшены название, вид интеграции, URL, выбранная модель и все
            правила сопоставления.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Отмена</Button>
          <Button onClick={confirmClear} color="warning" variant="contained" autoFocus>
            Очистить
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
          <TextField
            label="Название интеграции"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={!canManageIntegrations}
          />

          <FormControl fullWidth>
            <FormLabel sx={{ mb: 1 }}>Вид интеграции</FormLabel>
            <ToggleButtonGroup
              exclusive
              value={integrationKind === '' ? null : integrationKind}
              onChange={(_, value: IntegrationKind | null) => {
                setIntegrationKind(value ?? '')
              }}
              aria-label="Вид интеграции"
              fullWidth
              disabled={!canManageIntegrations}
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
            type="url"
            placeholder="https://"
            autoComplete="off"
            disabled={!canManageIntegrations}
          />

          <Divider sx={{ borderBottomWidth: 2 }} />

          <FormControl
            fullWidth
            disabled={!canManageIntegrations || riskModelsLoading || riskModels.length === 0}
            error={Boolean(riskModelsError)}
          >
            <FormLabel id="risk-object-model-label" sx={{ mb: 0.75, display: 'block' }}>
              Модель рискового объекта
            </FormLabel>
            <Select
              aria-labelledby="risk-object-model-label"
              value={riskObjectModelId}
              onChange={(e) => setRiskObjectModelId(e.target.value as string)}
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
              <FormHelperText error>{riskModelsError}</FormHelperText>
            ) : riskModels.length === 0 ? (
              <FormHelperText>
                Список моделей пуст — выбор недоступен, пока сервер не вернёт данные.
              </FormHelperText>
            ) : null}
          </FormControl>

          {riskObjectModelId ? (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                Сопоставление полей
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                «Преобразовать в» — поля из структуры выбранной модели. «Применив» — по
                желанию: идентификатор преобразования или фрагмент кода; попадёт в JSON как{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  transform
                </Box>
                , если заполнено.
              </Typography>
              {modelDefinitionLoading ? (
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
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Правило {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="Удалить правило"
                          onClick={() => removeMappingRow(row.id)}
                          disabled={!canManageIntegrations}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        label="Взять из"
                        value={row.from}
                        onChange={(e) => patchMappingRow(row.id, { from: e.target.value })}
                        fullWidth
                        size="small"
                        placeholder="Имя поля источника"
                        autoComplete="off"
                        disabled={!canManageIntegrations}
                      />
                      {modelDefinitionLoading ? (
                        <TextField
                          label="Преобразовать в"
                          value=""
                          fullWidth
                          size="small"
                          disabled
                          placeholder="Загрузка схемы…"
                          autoComplete="off"
                        />
                      ) : targetPaths.length > 0 ? (
                        <FormControl fullWidth size="small">
                          <FormLabel
                            id={`map-to-${row.id}`}
                            sx={{ mb: 0.5, display: 'block', typography: 'body2', fontWeight: 500 }}
                          >
                            Преобразовать в
                          </FormLabel>
                          <Select
                            aria-labelledby={`map-to-${row.id}`}
                            value={row.to}
                            displayEmpty
                            onChange={(e) =>
                              patchMappingRow(row.id, { to: e.target.value as string })
                            }
                            disabled={!canManageIntegrations}
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
                          placeholder="Введите путь вручную"
                          helperText={
                            modelDefinitionError
                              ? undefined
                              : modelDefinition
                                ? 'В схеме нет распознанных путей — введите вручную.'
                                : 'Структура объекта не загружена.'
                          }
                          autoComplete="off"
                          disabled={!canManageIntegrations}
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
                        placeholder="Необязательно: date_to_iso, код и т.п."
                        autoComplete="off"
                        disabled={!canManageIntegrations}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addMappingRow}
                sx={{ mt: 2 }}
                disabled={!canManageIntegrations}
              >
                Добавить правило
              </Button>
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 28 }}>
            {saving ? (
              <>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Создание интеграции…
                </Typography>
              </>
            ) : null}
          </Box>
        </Stack>

        {riskObjectModelId ? (
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
              Итоговый JSON
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              При создании также отправляются название, URL, вид и модель рискового объекта. Здесь — только блок{' '}
              <Box component="span" sx={{ fontFamily: 'monospace' }}>
                mapping_rules
              </Box>
              .
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
              {mappingPreviewJson}
            </Box>
          </Paper>
        ) : null}
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
            sx={{
              minWidth: { xs: 260, sm: 300 },
              maxWidth: 440,
              alignItems: 'center',
              borderRadius: 2,
            }}
          >
            {toast.text}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  )
}
