import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
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
import { useCallback, useMemo, useState } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteRiskCategoryById,
  getRiskCategories,
  postRiskCategoryCreate,
  putRiskCategoryById,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { type RiskCategoryOption } from './rulesShared'

export function RiskCategoriesPage() {
  const navigate = useNavigate()
  const { token, user, hasPermission } = useAuth()
  const canManageRulesAndRisks = hasPermission('manage_rules_and_risks')
  const [categories, setCategories] = useState<RiskCategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<RiskCategoryOption | null>(null)
  type OperationToast = { severity: 'success' | 'error'; text: string }
  const [toast, setToast] = useState<OperationToast | null>(null)
  const [toastOpen, setToastOpen] = useState(false)

  const showToast = useCallback((payload: OperationToast) => {
    setToast(payload)
    setToastOpen(true)
  }, [])

  const handleToastClose = useCallback(() => {
    setToastOpen(false)
  }, [])

  const handleToastExited = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    getRiskCategories(token, user?.companyId)
      .then((items) => {
        if (cancelled) return
        setCategories(items)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        showToast({
          severity: 'error',
          text: e instanceof Error ? e.message : 'Не удалось загрузить категории',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId, showToast])

  const duplicateName = useMemo(() => {
    const normalized = newCategoryName.trim().toLowerCase()
    if (!normalized) return false
    return categories.some((item) => item.name.trim().toLowerCase() === normalized)
  }, [categories, newCategoryName])

  async function handleAddCategory() {
    if (!canManageRulesAndRisks) return
    if (!token) return
    const name = newCategoryName.trim()
    if (!name) {
      showToast({ severity: 'error', text: 'Введите название категории' })
      return
    }
    if (duplicateName) {
      showToast({ severity: 'error', text: 'Категория с таким названием уже существует' })
      return
    }
    setSaving(true)
    try {
      const created = await postRiskCategoryCreate(token, { name }, user?.companyId)
      setCategories((prev) => [...prev, created])
      setNewCategoryName('')
      showToast({ severity: 'success', text: 'Категория добавлена' })
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось добавить категорию',
      })
    } finally {
      setSaving(false)
    }
  }

  function startEdit(category: RiskCategoryOption) {
    if (!canManageRulesAndRisks) return
    setEditingId(category.id)
    setEditingName(category.name)
  }

  async function saveEdit(categoryId: string) {
    if (!canManageRulesAndRisks) return
    if (!token) return
    const name = editingName.trim()
    if (!name) {
      showToast({ severity: 'error', text: 'Название категории не может быть пустым' })
      return
    }
    const duplicate = categories.some(
      (item) => item.id !== categoryId && item.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      showToast({ severity: 'error', text: 'Категория с таким названием уже существует' })
      return
    }
    setSaving(true)
    try {
      const updated = await putRiskCategoryById(token, categoryId, { name }, user?.companyId)
      setCategories((prev) => prev.map((item) => (item.id === categoryId ? updated : item)))
      setEditingId(null)
      setEditingName('')
      showToast({ severity: 'success', text: 'Категория обновлена' })
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось обновить категорию',
      })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!canManageRulesAndRisks) return
    if (!token) return
    if (!categoryToDelete) return
    setSaving(true)
    try {
      await deleteRiskCategoryById(token, categoryToDelete.id, user?.companyId)
      setCategories((prev) => prev.filter((item) => item.id !== categoryToDelete.id))
      setCategoryToDelete(null)
      if (editingId === categoryToDelete.id) {
        setEditingId(null)
        setEditingName('')
      }
      showToast({ severity: 'success', text: 'Категория удалена' })
    } catch (e: unknown) {
      showToast({
        severity: 'error',
        text: e instanceof Error ? e.message : 'Не удалось удалить категорию',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/rules')} sx={{ mb: 2 }}>
        Назад
      </Button>

      <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
        Категории риска
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Добавляйте, редактируйте и удаляйте категории для бизнес-правил.
      </Typography>
      {!canManageRulesAndRisks ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Доступен только просмотр страницы. Управление категориями риска отключено.
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            label="Новая категория"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            fullWidth
            disabled={!canManageRulesAndRisks}
          />
          <Button
            variant="contained"
            onClick={handleAddCategory}
            disabled={!newCategoryName.trim() || !canManageRulesAndRisks || saving}
          >
            Добавить
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Название категории</TableCell>
              <TableCell width={180} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="body2" color="text.secondary">
                    Загрузка категорий...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="body2" color="text.secondary">
                    Категории не найдены.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => {
                const isEditing = editingId === category.id
                return (
                  <TableRow key={category.id} hover>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          size="small"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          fullWidth
                          disabled={!canManageRulesAndRisks}
                        />
                      ) : (
                        category.name
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => saveEdit(category.id)}
                            aria-label="Сохранить"
                            disabled={!canManageRulesAndRisks || saving}
                          >
                            <SaveOutlinedIcon fontSize="small" />
                          </IconButton>
                          <Button
                            size="small"
                            onClick={() => {
                              setEditingId(null)
                              setEditingName('')
                            }}
                          >
                            Отмена
                          </Button>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => startEdit(category)}
                            aria-label="Редактировать"
                            disabled={!canManageRulesAndRisks || saving}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCategoryToDelete(category)}
                            aria-label="Удалить"
                            disabled={!canManageRulesAndRisks || saving}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
      >
        <DialogTitle>Удалить категорию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить категорию {`"${categoryToDelete?.name ?? ''}"`}?
            Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryToDelete(null)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={!canManageRulesAndRisks || saving}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

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
