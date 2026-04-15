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
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [categories, setCategories] = useState<RiskCategoryOption[]>(() => loadRiskCategories())
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<RiskCategoryOption | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const duplicateName = useMemo(() => {
    const normalized = newCategoryName.trim().toLowerCase()
    if (!normalized) return false
    return categories.some((item) => item.name.trim().toLowerCase() === normalized)
  }, [categories, newCategoryName])

  function persist(next: RiskCategoryOption[], message: string) {
    setCategories(next)
    saveRiskCategories(next)
    setInfo(message)
  }

  function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name || duplicateName) return
    persist(
      [...categories, { id: createCategoryId(), name, system: false }],
      'Категория добавлена',
    )
    setNewCategoryName('')
  }

  function startEdit(category: RiskCategoryOption) {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  function saveEdit(categoryId: string) {
    const name = editingName.trim()
    if (!name) return
    const duplicate = categories.some(
      (item) => item.id !== categoryId && item.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) return
    const next = categories.map((item) => (item.id === categoryId ? { ...item, name } : item))
    persist(next, 'Категория обновлена')
    setEditingId(null)
    setEditingName('')
  }

  function confirmDelete() {
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

      {info ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>
          {info}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            label="Новая категория"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            fullWidth
            error={duplicateName}
            helperText={duplicateName ? 'Категория с таким названием уже существует' : undefined}
          />
          <Button variant="contained" onClick={handleAddCategory} disabled={!newCategoryName.trim() || duplicateName}>
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
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCategoryToDelete(category)}
                            aria-label="Удалить"
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

      <Dialog open={Boolean(categoryToDelete)} onClose={() => setCategoryToDelete(null)}>
        <DialogTitle>Удалить категорию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить категорию {`"${categoryToDelete?.name ?? ''}"`}?
            Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryToDelete(null)}>Отмена</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
