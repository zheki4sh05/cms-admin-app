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
import type { SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  loadRiskCategories,
  saveRiskCategories,
  type RiskCategoryOption,
} from './rulesShared'

function createCategoryId() {
  return globalThis.crypto?.randomUUID?.() ?? `cat-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function RiskCategoriesPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canManageRulesAndRisks = hasPermission('manage_rules_and_risks')
  const [categories, setCategories] = useState<RiskCategoryOption[]>(() => loadRiskCategories())
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

  const handleToastClose = useCallback(
    (_: SyntheticEvent | Event, _reason?: 'timeout' | 'clickaway' | 'escapeKeyDown') => {
      setToastOpen(false)
    },
    [],
  )

  const handleToastExited = useCallback(() => setToast(null), [])

  const duplicateName = useMemo(() => {
    const normalized = newCategoryName.trim().toLowerCase()
    if (!normalized) return false
    return categories.some((item) => item.name.trim().toLowerCase() === normalized)
  }, [categories, newCategoryName])

  function persist(next: RiskCategoryOption[], message: string) {
    setCategories(next)
    saveRiskCategories(next)
    showToast({ severity: 'success', text: message })
  }

  function handleAddCategory() {
    if (!canManageRulesAndRisks) return
    const name = newCategoryName.trim()
    if (!name) {
      showToast({ severity: 'error', text: 'Введите название категории' })
      return
    }
    if (duplicateName) {
      showToast({ severity: 'error', text: 'Категория с таким названием уже существует' })
      return
    }
    persist(
      [...categories, { id: createCategoryId(), name, system: false }],
      'Категория добавлена',
    )
    setNewCategoryName('')
  }

  function startEdit(category: RiskCategoryOption) {
    if (!canManageRulesAndRisks) return
    setEditingId(category.id)
    setEditingName(category.name)
  }

  function saveEdit(categoryId: string) {
    if (!canManageRulesAndRisks) return
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
    const next = categories.map((item) => (item.id === categoryId ? { ...item, name } : item))
    persist(next, 'Категория обновлена')
    setEditingId(null)
    setEditingName('')
  }

  function confirmDelete() {
    if (!canManageRulesAndRisks) return
    if (!categoryToDelete) return
    const next = categories.filter((item) => item.id !== categoryToDelete.id)
    persist(next, 'Категория удалена')
    setCategoryToDelete(null)
    if (editingId === categoryToDelete.id) {
      setEditingId(null)
      setEditingName('')
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
            disabled={!newCategoryName.trim() || !canManageRulesAndRisks}
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
            {categories.length === 0 ? (
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
                            disabled={!canManageRulesAndRisks}
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
                            disabled={!canManageRulesAndRisks}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCategoryToDelete(category)}
                            aria-label="Удалить"
                            disabled={!canManageRulesAndRisks}
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
            disabled={!canManageRulesAndRisks}
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
