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
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Slide,
  type SlideProps,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCompanyDepartments, postRiskObjectCreate } from '../api/client'
import type { RiskObjectCreatePayload } from '../types/riskObjects'
import { useAuth } from '../auth/AuthContext'
import type { Department } from '../types/departments'

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type ValueKind = 'text' | 'array'

/** Ключ поля внутри объекта элемента массива (значение не задаётся). */
type ObjectFieldKey = {
  id: string
  key: string
}

/** Один объект внутри JSON-массива: только имена полей. */
type ArrayObjectRow = {
  id: string
  fieldKeys: ObjectFieldKey[]
}

/** Корневое поле: ключ и тип значения (без ввода самого значения). */
type RootField = {
  id: string
  keyName: string
  valueKind: ValueKind
  arrayRows: ArrayObjectRow[]
}

function createEmptyFieldKey(): ObjectFieldKey {
  return { id: newId(), key: '' }
}

function createEmptyArrayRow(): ArrayObjectRow {
  return { id: newId(), fieldKeys: [createEmptyFieldKey()] }
}

function createEmptyRootField(): RootField {
  return {
    id: newId(),
    keyName: '',
    valueKind: 'text',
    arrayRows: [createEmptyArrayRow()],
  }
}

/** Собирает объект: значения не вводятся — в превью подставляется null. */
function buildPayloadObject(fields: RootField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const key = f.keyName.trim()
    if (!key) continue
    if (f.valueKind === 'text') {
      out[key] = null
    } else {
      out[key] = f.arrayRows.map((row) => {
        const obj: Record<string, null> = {}
        for (const fk of row.fieldKeys) {
          const k = fk.key.trim()
          if (k) obj[k] = null
        }
        return obj
      })
    }
  }
  return out
}

function exportFilename(objectName: string): string {
  const raw = objectName.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)
  return raw ? `${raw}.json` : 'risk-object-schema.json'
}

/** Наименование объекта при импорте: имя файла без расширения .json */
function objectNameFromImportFilename(fileName: string): string {
  return fileName.replace(/\.json$/i, '').trim()
}

function arrayRowFromJsonItem(item: unknown): ArrayObjectRow {
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
    const keys = Object.keys(item as Record<string, unknown>)
    return {
      id: newId(),
      fieldKeys:
        keys.length > 0
          ? keys.map((key) => ({ id: newId(), key }))
          : [createEmptyFieldKey()],
    }
  }
  return { id: newId(), fieldKeys: [createEmptyFieldKey()] }
}

function importSchemaObject(
  obj: Record<string, unknown>,
): { ok: true; rootFields: RootField[] } | { ok: false; message: string } {
  const rootFields: RootField[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return {
        ok: false,
        message: `Ключ «${k}»: поддерживаются только null, строка, число, логическое значение или массив объектов.`,
      }
    }
    if (Array.isArray(v)) {
      let arrayRows = v.map(arrayRowFromJsonItem)
      if (arrayRows.length === 0) arrayRows = [createEmptyArrayRow()]
      rootFields.push({
        id: newId(),
        keyName: k,
        valueKind: 'array',
        arrayRows,
      })
      continue
    }
    rootFields.push({
      id: newId(),
      keyName: k,
      valueKind: 'text',
      arrayRows: [createEmptyArrayRow()],
    })
  }
  return { ok: true, rootFields }
}

function importDocumentFromJson(
  text: string,
): { ok: true; rootFields: RootField[] } | { ok: false; message: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, message: 'Файл не является корректным JSON.' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      message: 'Корень документа должен быть объектом { … }, не массивом.',
    }
  }
  const obj = parsed as Record<string, unknown>

  let schema: Record<string, unknown>
  if (
    'definition' in obj &&
    obj.definition !== null &&
    typeof obj.definition === 'object' &&
    !Array.isArray(obj.definition)
  ) {
    schema = obj.definition as Record<string, unknown>
  } else {
    schema = obj
  }

  const inner = importSchemaObject(schema)
  if (!inner.ok) return inner
  return { ok: true, rootFields: inner.rootFields }
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

export function RiskObjectCreatePage() {
  const navigate = useNavigate()
  const { token, user, hasPermission } = useAuth()
  const canManageRiskObjects = hasPermission('manage_risk_objects')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [objectName, setObjectName] = useState('')
  const [rootFields, setRootFields] = useState<RootField[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState('')

  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

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

  const previewJson = useMemo(() => {
    try {
      return JSON.stringify(buildPayloadObject(rootFields), null, 2)
    } catch {
      return '{}'
    }
  }, [rootFields])

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === departmentId) ?? null,
    [departments, departmentId],
  )

  useEffect(() => {
    if (!token || !user?.companyId) return
    let cancelled = false
    setDepartmentsLoading(true)
    setDepartmentsError(null)
    getCompanyDepartments(token, user.companyId)
      .then((items) => {
        if (cancelled) return
        setDepartments(items)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDepartments([])
        setDepartmentsError(
          e instanceof Error ? e.message : 'Не удалось загрузить отделы компании',
        )
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId])

  const handleExport = useCallback(() => {
    const doc = buildPayloadObject(rootFields)
    const text = JSON.stringify(doc, null, 2)
    downloadJsonFile(exportFilename(objectName), text)
  }, [objectName, rootFields])

  const handleSave = useCallback(async () => {
    if (!token) {
      showToast({ severity: 'error', text: 'Нет сессии — войдите снова.' })
      return
    }
    if (!canManageRiskObjects) {
      showToast({ severity: 'error', text: 'Недостаточно прав для редактирования' })
      return
    }
    setSaveLoading(true)
    try {
      const payload: RiskObjectCreatePayload = {
        name: objectName.trim(),
        definition: buildPayloadObject(rootFields),
        ...(departmentId ? { departmentId } : {}),
      }
      await postRiskObjectCreate(token, payload)
      showToast({ severity: 'success', text: 'Данные сохранены на сервере.' })
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось сохранить',
      })
    } finally {
      setSaveLoading(false)
    }
  }, [token, canManageRiskObjects, objectName, rootFields, departmentId, showToast])

  const confirmClear = useCallback(() => {
    setObjectName('')
    setRootFields([])
    setDepartmentId('')
    setClearDialogOpen(false)
    showToast({ severity: 'success', text: 'Конструктор очищен.' })
  }, [showToast])

  const onImportFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const r = importDocumentFromJson(text)
      if (!r.ok) {
        showToast({ severity: 'error', text: r.message })
        return
      }
      setObjectName(objectNameFromImportFilename(file.name))
      setRootFields(r.rootFields)
      showToast({
        severity: 'success',
        text: 'Конструктор заполнен из JSON.',
      })
    }
    reader.onerror = () => {
      showToast({ severity: 'error', text: 'Не удалось прочитать файл.' })
    }
    reader.readAsText(file, 'UTF-8')
  }, [showToast])

  const addRootField = useCallback(() => {
    setRootFields((prev) => [...prev, createEmptyRootField()])
  }, [])

  const removeRootField = useCallback((id: string) => {
    setRootFields((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const patchRootField = useCallback((id: string, patch: Partial<RootField>) => {
    setRootFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    )
  }, [])

  const setRootValueKind = useCallback((id: string, kind: ValueKind) => {
    setRootFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        if (kind === 'array') {
          return {
            ...f,
            valueKind: 'array',
            arrayRows:
              f.arrayRows.length > 0 ? f.arrayRows : [createEmptyArrayRow()],
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
                fieldKeys: row.fieldKeys.map((fk) =>
                  fk.id === fieldId ? { ...fk, key } : fk,
                ),
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
            row.id === rowId
              ? { ...row, fieldKeys: [...row.fieldKeys, createEmptyFieldKey()] }
              : row,
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
              return {
                ...row,
                fieldKeys: next.length > 0 ? next : [createEmptyFieldKey()],
              }
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
        f.id === rootId
          ? { ...f, arrayRows: [...f.arrayRows, createEmptyArrayRow()] }
          : f,
      ),
    )
  }, [])

  const removeArrayRow = useCallback((rootId: string, rowId: string) => {
    setRootFields((prev) =>
      prev.map((f) => {
        if (f.id !== rootId) return f
        const next = f.arrayRows.filter((r) => r.id !== rowId)
        return {
          ...f,
          arrayRows: next.length > 0 ? next : [createEmptyArrayRow()],
        }
      }),
    )
  }, [])

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/app/risk-objects')}
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
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h1">
          Создание рискового объекта
        </Typography>
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExport}
            disabled={!canManageRiskObjects}
          >
            Экспорт
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            onClick={() => void handleSave()}
            disabled={saveLoading || !token || !canManageRiskObjects}
          >
            Сохранить
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ClearAllOutlinedIcon />}
            onClick={() => setClearDialogOpen(true)}
            disabled={!canManageRiskObjects}
          >
            Очистить
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<UploadFileOutlinedIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canManageRiskObjects}
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
      {!canManageRiskObjects ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Создание и редактирование рисковых объектов отключено.
        </Alert>
      ) : null}

      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Очистить конструктор?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Будут удалены наименование и все добавленные ключи. Это действие нельзя
            отменить.
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
        <Stack spacing={3} sx={{ flex: 1, minWidth: 0, maxWidth: 800 }}>
          <TextField
            label="Наименование"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={!canManageRiskObjects}
            helperText="В превью и в экспорте наименование не входит в JSON — только в имя файла. При импорте поле заполняется из имени файла (без .json). На сервер наименование уходит отдельно от структуры."
          />

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              Привязка к отделу
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Можно привязать только один отдел. В таблице ниже доступна полная информация по
              отделам компании.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ mb: 1.5, alignItems: { sm: 'center' } }}
            >
              <FormControl size="small" fullWidth>
                <FormLabel id="risk-object-department-label" sx={{ mb: 0.75, display: 'block' }}>
                  Отдел
                </FormLabel>
                <Select
                  aria-labelledby="risk-object-department-label"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  displayEmpty
                  disabled={!canManageRiskObjects || departmentsLoading}
                >
                  <MenuItem value="">
                    <em>Без привязки к отделу</em>
                  </MenuItem>
                  {departments.map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name} ({department.employeeCount} сотрудников)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setDepartmentId('')}
                disabled={!canManageRiskObjects || !departmentId}
              >
                Очистить
              </Button>
            </Stack>
            {selectedDepartment ? (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Выбран отдел: {selectedDepartment.name}
              </Alert>
            ) : null}
            {departmentsError ? (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {departmentsError}
              </Alert>
            ) : null}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Отдел</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Описание</TableCell>
                    <TableCell>Руководитель</TableCell>
                    <TableCell>Сотрудников</TableCell>
                    <TableCell>Создан</TableCell>
                    <TableCell>Обновлен</TableCell>
                    <TableCell align="right">Действие</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departmentsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                          <CircularProgress size={24} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : departments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" color="text.secondary">
                          Отделы не найдены.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    departments.map((department) => (
                      <TableRow
                        key={department.id}
                        hover
                        selected={department.id === departmentId}
                        onClick={() => {
                          if (!canManageRiskObjects) return
                          setDepartmentId(department.id)
                        }}
                        sx={{ cursor: canManageRiskObjects ? 'pointer' : 'default' }}
                      >
                        <TableCell>{department.name}</TableCell>
                        <TableCell>{department.id}</TableCell>
                        <TableCell>{department.description || '-'}</TableCell>
                        <TableCell>{department.supervisorName || '-'}</TableCell>
                        <TableCell>{department.employeeCount}</TableCell>
                        <TableCell>
                          {department.createdAt
                            ? new Date(department.createdAt).toLocaleString('ru-RU')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {department.updatedAt
                            ? new Date(department.updatedAt).toLocaleString('ru-RU')
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            color={department.id === departmentId ? 'error' : 'primary'}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (!canManageRiskObjects) return
                              setDepartmentId((prev) =>
                                prev === department.id ? '' : department.id,
                              )
                            }}
                            disabled={!canManageRiskObjects}
                          >
                            {department.id === departmentId ? 'Убрать' : 'Выбрать'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              Конструктор JSON
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Задаются только ключи и тип значения. Для типа «простой текст» значение в
              превью — null. Для «массив» — элементы как объекты: указываются только имена
              полей (в JSON — ключи с null).
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addRootField}
              sx={{ mb: 2 }}
              disabled={!canManageRiskObjects}
            >
              Добавить ключ
            </Button>

            {rootFields.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Полей пока нет — нажмите «Добавить ключ» или загрузите JSON через «Импорт».
              </Typography>
            ) : (
              <Stack spacing={2}>
                {rootFields.map((field, index) => (
                  <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <TextField
                          label="Ключ"
                          value={field.keyName}
                          onChange={(e) =>
                            patchRootField(field.id, { keyName: e.target.value })
                          }
                          fullWidth
                          sx={{ flex: '1 1 200px', minWidth: 0 }}
                          placeholder={`ключ_${index + 1}`}
                          autoComplete="off"
                          required
                          disabled={!canManageRiskObjects}
                        />
                        <IconButton
                          aria-label="Удалить поле"
                          color="error"
                          onClick={() => removeRootField(field.id)}
                          sx={{ mt: 0.5 }}
                          disabled={!canManageRiskObjects}
                        >
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
                          onChange={(e) =>
                            setRootValueKind(field.id, e.target.value as ValueKind)
                          }
                          disabled={!canManageRiskObjects}
                        >
                          <MenuItem value="text">Простой текст</MenuItem>
                          <MenuItem value="array">Массив</MenuItem>
                        </Select>
                      </FormControl>

                      {field.valueKind === 'text' ? (
                        <Typography variant="body2" color="text.secondary">
                          Значение не вводится — в превью для этого ключа будет{' '}
                          <Box component="span" sx={{ fontFamily: 'monospace' }}>
                            null
                          </Box>
                          .
                        </Typography>
                      ) : (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Элементы массива: у каждого объекта — только ключи полей
                          </Typography>
                          <Stack spacing={2}>
                            {field.arrayRows.map((row, rowIndex) => (
                              <Paper
                                key={row.id}
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  bgcolor: 'action.hover',
                                  borderStyle: 'dashed',
                                }}
                              >
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    mb: 1,
                                    gap: 1,
                                  }}
                                >
                                  <Typography variant="caption" color="text.secondary">
                                    Объект {rowIndex + 1}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    aria-label="Удалить объект из массива"
                                    onClick={() => removeArrayRow(field.id, row.id)}
                                    disabled={!canManageRiskObjects}
                                  >
                                    <DeleteOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                                <Stack spacing={1.5}>
                                  {row.fieldKeys.map((fk) => (
                                    <Box
                                      key={fk.id}
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 1,
                                        alignItems: 'flex-start',
                                      }}
                                    >
                                      <TextField
                                        label="Ключ поля"
                                        value={fk.key}
                                        onChange={(e) =>
                                          patchFieldKeyInArrayRow(
                                            field.id,
                                            row.id,
                                            fk.id,
                                            e.target.value,
                                          )
                                        }
                                        size="small"
                                        fullWidth
                                        sx={{ flex: '1 1 200px', minWidth: 0 }}
                                        autoComplete="off"
                                        disabled={!canManageRiskObjects}
                                      />
                                      <IconButton
                                        size="small"
                                        aria-label="Удалить ключ"
                                        onClick={() =>
                                          removeFieldKeyFromArrayRow(
                                            field.id,
                                            row.id,
                                            fk.id,
                                          )
                                        }
                                        sx={{ mt: 0.25 }}
                                        disabled={!canManageRiskObjects}
                                      >
                                        <DeleteOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  ))}
                                </Stack>
                                <Button
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => addFieldKeyToArrayRow(field.id, row.id)}
                                  sx={{ mt: 1 }}
                                  disabled={!canManageRiskObjects}
                                >
                                  Добавить ключ поля
                                </Button>
                              </Paper>
                            ))}
                          </Stack>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => addArrayRow(field.id)}
                            sx={{ mt: 1.5 }}
                            disabled={!canManageRiskObjects}
                          >
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
            Итоговая структура (JSON)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Пустые ключи не попадают в превью. Наименование объекта в этот JSON не
            включается.
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
