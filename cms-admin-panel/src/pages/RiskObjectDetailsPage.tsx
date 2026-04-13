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
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getRiskObjectById,
  putRiskObjectById,
  putRiskObjectStatusById,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type {
  RiskObjectStatusUpdatePayload,
  RiskObjectUpdatePayload,
} from '../types/riskObjects'

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type ValueKind = 'text' | 'array'

type ObjectFieldKey = {
  id: string
  key: string
}

type ArrayObjectRow = {
  id: string
  fieldKeys: ObjectFieldKey[]
}

type RootField = {
  id: string
  keyName: string
  valueKind: ValueKind
  arrayRows: ArrayObjectRow[]
}

type RiskEditorSnapshot = {
  name: string
  code: string
  status: 'active' | 'archived'
  updatedAt: string
  rootFields: RootField[]
}

function createEmptyFieldKey(): ObjectFieldKey {
  return { id: newId(), key: '' }
}

function createEmptyArrayRow(): ArrayObjectRow {
  return { id: newId(), fieldKeys: [createEmptyFieldKey()] }
}

function createEmptyRootField(): RootField {
  return { id: newId(), keyName: '', valueKind: 'text', arrayRows: [createEmptyArrayRow()] }
}

function buildPayloadObject(fields: RootField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const key = f.keyName.trim()
    if (!key) continue
    if (f.valueKind === 'text') {
      out[key] = null
      continue
    }
    out[key] = f.arrayRows.map((row) => {
      const obj: Record<string, null> = {}
      for (const fk of row.fieldKeys) {
        const k = fk.key.trim()
        if (k) obj[k] = null
      }
      return obj
    })
  }
  return out
}

function exportFilename(name: string, code: string): string {
  const base = `${name || code || 'risk-object'}`.trim()
  const safe = base.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)
  return safe ? `${safe}.json` : 'risk-object.json'
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

function arrayRowFromJsonItem(item: unknown): ArrayObjectRow {
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
    const keys = Object.keys(item as Record<string, unknown>)
    return {
      id: newId(),
      fieldKeys: keys.length > 0 ? keys.map((key) => ({ id: newId(), key })) : [createEmptyFieldKey()],
    }
  }
  return { id: newId(), fieldKeys: [createEmptyFieldKey()] }
}

function rootFieldsFromDefinition(definition: Record<string, unknown>): RootField[] {
  const fields: RootField[] = []
  for (const [k, v] of Object.entries(definition)) {
    if (Array.isArray(v)) {
      let rows = v.map(arrayRowFromJsonItem)
      if (rows.length === 0) rows = [createEmptyArrayRow()]
      fields.push({
        id: newId(),
        keyName: k,
        valueKind: 'array',
        arrayRows: rows,
      })
      continue
    }
    fields.push({
      id: newId(),
      keyName: k,
      valueKind: 'text',
      arrayRows: [createEmptyArrayRow()],
    })
  }
  return fields
}

export function RiskObjectDetailsPage() {
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveComment, setSaveComment] = useState('')
  const [saveCommentError, setSaveCommentError] = useState(false)
  const canEdit = editingEnabled && !isReadOnlyView

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [updatedAt, setUpdatedAt] = useState('')
  const [rootFields, setRootFields] = useState<RootField[]>([])
  const [initialSnapshot, setInitialSnapshot] = useState<RiskEditorSnapshot | null>(null)

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

  useEffect(() => {
    if (!token || !id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getRiskObjectById(token, id)
      .then((data) => {
        if (cancelled) return
        const fields = rootFieldsFromDefinition(data.definition ?? {})
        setName(data.name)
        setCode(data.code)
        setStatus(data.status)
        setUpdatedAt(data.updatedAt)
        setRootFields(fields)
        setInitialSnapshot({
          name: data.name,
          code: data.code,
          status: data.status,
          updatedAt: data.updatedAt,
          rootFields: fields,
        })
        setEditingEnabled(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки объекта')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, id])

  const previewJson = useMemo(() => {
    try {
      return JSON.stringify(buildPayloadObject(rootFields), null, 2)
    } catch {
      return '{}'
    }
  }, [rootFields])

  const setFromSnapshot = useCallback((snapshot: RiskEditorSnapshot) => {
    const clonedFields = snapshot.rootFields.map((f) => ({
      ...f,
      id: newId(),
      arrayRows: f.arrayRows.map((row) => ({
        ...row,
        id: newId(),
        fieldKeys: row.fieldKeys.map((fk) => ({ ...fk, id: newId() })),
      })),
    }))
    setName(snapshot.name)
    setCode(snapshot.code)
    setStatus(snapshot.status)
    setUpdatedAt(snapshot.updatedAt)
    setRootFields(clonedFields)
  }, [])

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
    const comment = saveComment.trim()
    if (!comment) {
      setSaveCommentError(true)
      return
    }
    const payload: RiskObjectUpdatePayload = {
      name: name.trim(),
      definition: buildPayloadObject(rootFields),
      changeComment: comment,
    }
    setSaving(true)
    try {
      const result = await putRiskObjectById(token, id, payload)
      setUpdatedAt(result.savedAt)
      const snapshot: RiskEditorSnapshot = {
        name: payload.name || name,
        code,
        status,
        updatedAt: result.savedAt,
        rootFields,
      }
      setInitialSnapshot(snapshot)
      setEditingEnabled(false)
      setSaveDialogOpen(false)
      setSaveComment('')
      setSaveCommentError(false)
      showToast({ severity: 'success', text: 'Изменения сохранены.' })
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось сохранить',
      })
    } finally {
      setSaving(false)
    }
  }, [isReadOnlyView, token, id, name, rootFields, code, status, saveComment, showToast])

  const handleStatusSwitch = useCallback(
    async (checked: boolean) => {
      if (isReadOnlyView) return
      if (!token || !id) {
        showToast({ severity: 'error', text: 'Нет сессии — войдите снова.' })
        return
      }
      const prevStatus = status
      const nextStatus: 'active' | 'archived' = checked ? 'active' : 'archived'
      setStatus(nextStatus)
      setStatusUpdating(true)
      try {
        const payload: RiskObjectStatusUpdatePayload = {
          status: nextStatus,
        }
        const result = await putRiskObjectStatusById(token, id, payload)
        setUpdatedAt(result.savedAt)
        setInitialSnapshot((prev) =>
          prev
            ? {
                ...prev,
                status: nextStatus,
                updatedAt: result.savedAt,
                rootFields,
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
          text: e instanceof Error ? e.message : 'Не удалось обновить статус',
        })
      } finally {
        setStatusUpdating(false)
      }
    },
    [isReadOnlyView, token, id, status, rootFields, showToast],
  )

  const handleExport = useCallback(() => {
    const text = JSON.stringify(buildPayloadObject(rootFields), null, 2)
    downloadJsonFile(exportFilename(name, code), text)
    showToast({ severity: 'success', text: 'Экспорт выполнен.' })
  }, [name, code, rootFields, showToast])

  const addRootField = useCallback(() => {
    setRootFields((prev) => [...prev, createEmptyRootField()])
  }, [])

  const removeRootField = useCallback((targetId: string) => {
    setRootFields((prev) => prev.filter((f) => f.id !== targetId))
  }, [])

  const patchRootField = useCallback((targetId: string, patch: Partial<RootField>) => {
    setRootFields((prev) => prev.map((f) => (f.id === targetId ? { ...f, ...patch } : f)))
  }, [])

  const setRootValueKind = useCallback((targetId: string, kind: ValueKind) => {
    setRootFields((prev) =>
      prev.map((f) => {
        if (f.id !== targetId) return f
        if (kind === 'array') {
          return {
            ...f,
            valueKind: 'array',
            arrayRows: f.arrayRows.length > 0 ? f.arrayRows : [createEmptyArrayRow()],
          }
        }
        return { ...f, valueKind: 'text' }
      }),
    )
  }, [])

  const patchFieldKeyInArrayRow = useCallback(
    (rootId: string, rowId: string, fieldId: string, key: string) => {
      setRootFields((prev) =>
        prev.map((f) => {
          if (f.id !== rootId) return f
          return {
            ...f,
            arrayRows: f.arrayRows.map((row) => {
              if (row.id !== rowId) return row
              return {
                ...row,
                fieldKeys: row.fieldKeys.map((fk) => (fk.id === fieldId ? { ...fk, key } : fk)),
              }
            }),
          }
        }),
      )
    },
    [],
  )

  const addFieldKeyToArrayRow = useCallback((rootId: string, rowId: string) => {
    setRootFields((prev) =>
      prev.map((f) => {
        if (f.id !== rootId) return f
        return {
          ...f,
          arrayRows: f.arrayRows.map((row) =>
            row.id === rowId ? { ...row, fieldKeys: [...row.fieldKeys, createEmptyFieldKey()] } : row,
          ),
        }
      }),
    )
  }, [])

  const removeFieldKeyFromArrayRow = useCallback(
    (rootId: string, rowId: string, fieldId: string) => {
      setRootFields((prev) =>
        prev.map((f) => {
          if (f.id !== rootId) return f
          return {
            ...f,
            arrayRows: f.arrayRows.map((row) => {
              if (row.id !== rowId) return row
              const next = row.fieldKeys.filter((fk) => fk.id !== fieldId)
              return { ...row, fieldKeys: next.length > 0 ? next : [createEmptyFieldKey()] }
            }),
          }
        }),
      )
    },
    [],
  )

  const addArrayRow = useCallback((rootId: string) => {
    setRootFields((prev) =>
      prev.map((f) =>
        f.id === rootId ? { ...f, arrayRows: [...f.arrayRows, createEmptyArrayRow()] } : f,
      ),
    )
  }, [])

  const removeArrayRow = useCallback((rootId: string, rowId: string) => {
    setRootFields((prev) =>
      prev.map((f) => {
        if (f.id !== rootId) return f
        const next = f.arrayRows.filter((r) => r.id !== rowId)
        return { ...f, arrayRows: next.length > 0 ? next : [createEmptyArrayRow()] }
      }),
    )
  }, [])

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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/risk-objects')} sx={{ mb: 2 }}>
          Назад
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/risk-objects')} sx={{ mb: 2 }}>
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
          Просмотр рискового объекта
        </Typography>
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => {
              setSaveDialogOpen(true)
              setSaveCommentError(false)
            }}
            disabled={!canEdit || saving}
          >
            Сохранить
          </Button>
          <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
            Экспорт
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ClearAllOutlinedIcon />}
            onClick={() => setClearDialogOpen(true)}
            disabled={!canEdit}
          >
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
          <DialogContentText>Текущие несохранённые изменения будут удалены.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Отмена</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              setClearDialogOpen(false)
              handleReset()
            }}
            autoFocus
          >
            Сбросить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Комментарий к изменениям</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            Укажите обязательный комментарий, описывающий внесённые изменения.
          </DialogContentText>
          <TextField
            label="Комментарий"
            value={saveComment}
            onChange={(e) => {
              setSaveComment(e.target.value)
              if (saveCommentError && e.target.value.trim()) setSaveCommentError(false)
            }}
            error={saveCommentError}
            helperText={saveCommentError ? 'Комментарий обязателен' : undefined}
            multiline
            minRows={3}
            fullWidth
            autoFocus
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSaveDialogOpen(false)
              setSaveComment('')
              setSaveCommentError(false)
            }}
          >
            Отмена
          </Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            Сохранить
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
        <Stack spacing={3} sx={{ flex: 1, minWidth: 0, maxWidth: 800 }}>
          <TextField label="Код" value={code} fullWidth disabled />
          <TextField
            label="Наименование"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            disabled={!canEdit}
            autoComplete="off"
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
          <TextField label="Обновлён" value={updatedAt ? new Date(updatedAt).toLocaleString('ru-RU') : ''} fullWidth disabled />

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              Конструктор JSON
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {isReadOnlyView
                ? 'Эта карточка открыта только для просмотра.'
                : 'В режиме просмотра поля отключены. Включите «Начать редактирование», чтобы менять структуру.'}
            </Typography>
            <Button variant="outlined" onClick={addRootField} sx={{ mb: 2 }} disabled={!canEdit}>
              Добавить ключ
            </Button>

            {rootFields.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Структура пустая.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {rootFields.map((field, index) => (
                  <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                        <TextField
                          label="Ключ"
                          value={field.keyName}
                          onChange={(e) => patchRootField(field.id, { keyName: e.target.value })}
                          fullWidth
                          sx={{ flex: '1 1 200px', minWidth: 0 }}
                          placeholder={`ключ_${index + 1}`}
                          autoComplete="off"
                          disabled={!canEdit}
                        />
                        <IconButton aria-label="Удалить поле" color="error" onClick={() => removeRootField(field.id)} sx={{ mt: 0.5 }} disabled={!canEdit}>
                          <DeleteOutlinedIcon />
                        </IconButton>
                      </Box>

                      <FormControl fullWidth size="small">
                        <FormLabel id={`vk-${field.id}`} sx={{ mb: 0.75, display: 'block' }}>
                          Тип значения
                        </FormLabel>
                        <Select
                          aria-labelledby={`vk-${field.id}`}
                          value={field.valueKind}
                          onChange={(e) => setRootValueKind(field.id, e.target.value as ValueKind)}
                          disabled={!canEdit}
                        >
                          <MenuItem value="text">Простой текст</MenuItem>
                          <MenuItem value="array">Массив</MenuItem>
                        </Select>
                      </FormControl>

                      {field.valueKind === 'text' ? (
                        <Typography variant="body2" color="text.secondary">
                          Значение не вводится — в JSON для этого ключа будет <Box component="span" sx={{ fontFamily: 'monospace' }}>null</Box>.
                        </Typography>
                      ) : (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Элементы массива: у каждого объекта только ключи полей
                          </Typography>
                          <Stack spacing={2}>
                            {field.arrayRows.map((row, rowIndex) => (
                              <Paper key={row.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Объект {rowIndex + 1}
                                  </Typography>
                                  <IconButton size="small" aria-label="Удалить объект из массива" onClick={() => removeArrayRow(field.id, row.id)} disabled={!canEdit}>
                                    <DeleteOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                                <Stack spacing={1.5}>
                                  {row.fieldKeys.map((fk) => (
                                    <Box key={fk.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
                                      <TextField
                                        label="Ключ поля"
                                        value={fk.key}
                                        onChange={(e) => patchFieldKeyInArrayRow(field.id, row.id, fk.id, e.target.value)}
                                        size="small"
                                        fullWidth
                                        sx={{ flex: '1 1 200px', minWidth: 0 }}
                                        autoComplete="off"
                                        disabled={!canEdit}
                                      />
                                      <IconButton size="small" aria-label="Удалить ключ" onClick={() => removeFieldKeyFromArrayRow(field.id, row.id, fk.id)} sx={{ mt: 0.25 }} disabled={!canEdit}>
                                        <DeleteOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  ))}
                                </Stack>
                                <Button size="small" onClick={() => addFieldKeyToArrayRow(field.id, row.id)} sx={{ mt: 1 }} disabled={!canEdit}>
                                  Добавить ключ поля
                                </Button>
                              </Paper>
                            ))}
                          </Stack>
                          <Button size="small" variant="outlined" onClick={() => addArrayRow(field.id)} sx={{ mt: 1.5 }} disabled={!canEdit}>
                            Добавить элемент массива
                          </Button>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
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
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
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

