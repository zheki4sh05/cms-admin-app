import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Drawer,
  FormControlLabel,
  Paper,
  Snackbar,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { useEffect, useState } from 'react'
import {
  getUserAccessPermissions,
  getUsersList,
  putUserStatus,
  putUserAccessPermissions,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  canViewPage,
  MANAGEMENT_ACCESS_OPTIONS,
  PAGE_VIEW_OPTIONS,
  type AccessPermission,
  type ManagementPermission,
  type PageViewPermission,
} from '../types/permissions'

type UserStatus = 'active' | 'blocked'
type JobTitle = 'manager' | 'head' | 'top_management'
type BackendUserRole = 'MANAGER' | 'SUPERVISOR' | 'EXECUTIVE'

type Row = {
  id: string
  name: string
  email: string
  status: UserStatus
  jobTitle: JobTitle
  accessPermissions: AccessPermission[]
  createdAt: string
}

type RawRow = Partial<Row> & {
  role?: BackendUserRole | string
}

const SUPER_USER_EMAIL = 'admin@trustflow.local'

function statusLabel(status: UserStatus): string {
  return status === 'active' ? 'active' : 'blocked'
}

function jobTitleLabel(jobTitle: JobTitle): string {
  if (jobTitle === 'manager') return 'менеджер'
  if (jobTitle === 'head') return 'руководитель'
  return 'ТОП-менеджмент'
}

function requiredViewPermissionForManagement(
  permission: ManagementPermission,
): PageViewPermission {
  if (permission === 'edit_users') return 'view_users_page'
  if (permission === 'manage_risk_objects') return 'view_risk_objects_page'
  if (permission === 'manage_integrations') return 'view_integrations_page'
  return 'view_rules_and_risks_page'
}

function mapRoleToJobTitle(role: unknown): JobTitle | null {
  if (role === 'MANAGER') return 'manager'
  if (role === 'SUPERVISOR') return 'head'
  if (role === 'EXECUTIVE') return 'top_management'
  return null
}

function mapLegacyJobTitle(jobTitle: unknown): JobTitle | null {
  if (jobTitle === 'manager' || jobTitle === 'head' || jobTitle === 'top_management') {
    return jobTitle
  }
  return null
}

function normalizeUsers(items: unknown[]): Row[] {
  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const row = raw as RawRow
      const normalizedJobTitle = mapRoleToJobTitle(row.role) ?? mapLegacyJobTitle(row.jobTitle)
      if (
        !row.id ||
        !row.name ||
        !row.email ||
        !row.createdAt ||
        !normalizedJobTitle ||
        (row.status !== 'active' && row.status !== 'blocked')
      ) {
        return null
      }
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        status: row.status,
        jobTitle: normalizedJobTitle,
        accessPermissions: Array.isArray(row.accessPermissions) ? row.accessPermissions : [],
        createdAt: row.createdAt,
      } satisfies Row
    })
    .filter((item): item is Row => item !== null)
}

export function UsersPage() {
  const { token, user, hasPermission } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [draftAccessPermissions, setDraftAccessPermissions] = useState<AccessPermission[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessSaving, setAccessSaving] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; text: string } | null>(
    null,
  )

  const selectedUser = selectedUserId ? rows.find((item) => item.id === selectedUserId) : null
  const selectedUserPermissions = selectedUser ? draftAccessPermissions : []
  const canManageUsers = hasPermission('edit_users')
  const currentUserEmail = user?.email?.trim().toLowerCase() ?? ''
  const isCurrentUserSuper = currentUserEmail === SUPER_USER_EMAIL

  function isSuperUser(row: Row): boolean {
    return row.email.trim().toLowerCase() === SUPER_USER_EMAIL
  }

  function userRank(jobTitle: JobTitle): number {
    if (jobTitle === 'manager') return 1
    if (jobTitle === 'head') return 2
    return 3
  }

  const currentUserJobTitle = (() => {
    const ownRow = rows.find((row) => row.email.trim().toLowerCase() === currentUserEmail)
    if (ownRow) return ownRow.jobTitle
    if (user?.role === 'admin') return 'top_management' as JobTitle
    return 'manager' as JobTitle
  })()

  function canManageTargetUser(row: Row): boolean {
    if (!canManageUsers) return false
    if (isSuperUser(row)) return false
    if (row.email.trim().toLowerCase() === currentUserEmail) return false
    if (isCurrentUserSuper) return true
    return userRank(row.jobTitle) < userRank(currentUserJobTitle)
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getUsersList(token, user?.companyId)
      .then((items) => {
        if (!cancelled) setRows(normalizeUsers(items))
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.companyId])

  useEffect(() => {
    if (!selectedUser) {
      setDraftAccessPermissions([])
      return
    }
    setDraftAccessPermissions(selectedUser.accessPermissions)
  }, [selectedUser])

  useEffect(() => {
    if (!selectedUserId || !token) return
    let cancelled = false
    setAccessLoading(true)
    setAccessError(null)
    getUserAccessPermissions(token, selectedUserId, user?.companyId)
      .then((permissions) => {
        if (!cancelled) setDraftAccessPermissions(permissions)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const message =
          e instanceof Error ? e.message : 'Не удалось загрузить права доступа пользователя'
        setAccessError(message)
        setToast({ severity: 'error', text: message })
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedUserId, token])

  async function handleStatusToggle(userId: string, checked: boolean) {
    if (!token) return
    const row = rows.find((item) => item.id === userId)
    if (!row || !canManageTargetUser(row)) return
    const nextStatus: UserStatus = checked ? 'active' : 'blocked'
    setStatusUpdatingId(userId)
    try {
      const savedStatus = await putUserStatus(token, userId, nextStatus)
      setRows((prevRows) =>
        prevRows.map((item) => (item.id === userId ? { ...item, status: savedStatus } : item)),
      )
      setToast({ severity: 'success', text: 'Статус пользователя обновлен' })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Не удалось изменить статус пользователя'
      setToast({ severity: 'error', text: message })
    } finally {
      setStatusUpdatingId(null)
    }
  }

  function handlePermissionToggle(permission: ManagementPermission, checked: boolean) {
    if (accessLoading || accessSaving) return
    setDraftAccessPermissions((prevPermissions) => {
      if (checked) {
        if (prevPermissions.includes(permission)) return prevPermissions
        return [...prevPermissions, permission]
      }
      return prevPermissions.filter((item) => item !== permission)
    })
  }

  function handleViewAllPagesToggle(checked: boolean) {
    if (accessLoading || accessSaving) return
    setDraftAccessPermissions((prevPermissions) => {
      const withoutPagePermissions = prevPermissions.filter(
        (item) => item !== 'view_all_pages' && !PAGE_VIEW_OPTIONS.some((opt) => opt.value === item),
      )
      if (!checked) {
        return withoutPagePermissions
      }
      return [
        ...withoutPagePermissions,
        'view_all_pages',
        ...PAGE_VIEW_OPTIONS.map((item) => item.value),
      ]
    })
  }

  function handlePagePermissionToggle(permission: PageViewPermission, checked: boolean) {
    if (accessLoading || accessSaving) return
    setDraftAccessPermissions((prevPermissions) => {
      const set = new Set(prevPermissions)
      if (checked) {
        set.add(permission)
        const allPagesSelected = PAGE_VIEW_OPTIONS.every((option) => set.has(option.value))
        if (allPagesSelected) set.add('view_all_pages')
        return Array.from(set)
      }
      set.delete(permission)
      set.delete('view_all_pages')
      for (const option of MANAGEMENT_ACCESS_OPTIONS) {
        if (requiredViewPermissionForManagement(option.value) === permission) {
          set.delete(option.value)
        }
      }
      return Array.from(set)
    })
  }

  function handleCancelAccessChanges() {
    setSelectedUserId(null)
    setAccessError(null)
  }

  async function handleSaveAccessChanges() {
    if (!selectedUserId || !token || !selectedUser || !canManageTargetUser(selectedUser)) return
    setAccessSaving(true)
    setAccessError(null)
    try {
      const savedPermissions = await putUserAccessPermissions(
        token,
        selectedUserId,
        draftAccessPermissions,
        user?.companyId,
      )
      setRows((prevRows) =>
        prevRows.map((row) =>
          row.id === selectedUserId
            ? { ...row, accessPermissions: savedPermissions }
            : row,
        ),
      )
      setToast({ severity: 'success', text: 'Права доступа успешно сохранены' })
      setSelectedUserId(null)
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Не удалось сохранить права доступа пользователя'
      setAccessError(message)
      setToast({ severity: 'error', text: message })
    } finally {
      setAccessSaving(false)
    }
  }

  function canConfigureManagementPermission(permission: ManagementPermission): boolean {
    if (!selectedUser) return false
    return canViewPage(selectedUserPermissions, requiredViewPermissionForManagement(permission))
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Пользователи
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Должность</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Доступ</TableCell>
              <TableCell>Создан</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2">{r.name}</Typography>
                        {isSuperUser(r) ? (
                          <Chip size="small" label="Супер пользователь" color="warning" />
                        ) : null}
                      </Box>
                      {r.email.trim().toLowerCase() === currentUserEmail ? (
                        <Typography variant="caption" color="text.secondary">
                          текущий пользователь
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{jobTitleLabel(r.jobTitle)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'lowercase' }}>
                        {statusLabel(r.status)}
                      </Typography>
                      <Switch
                        size="small"
                        checked={r.status === 'active'}
                        onChange={(e) => void handleStatusToggle(r.id, e.target.checked)}
                        disabled={!canManageTargetUser(r) || statusUpdatingId === r.id}
                        inputProps={{ 'aria-label': `Статус пользователя ${r.name}` }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Открыть боковую панель настройки доступа">
                        <span>
                          <Button
                            size="small"
                            startIcon={<SettingsOutlinedIcon fontSize="small" />}
                            onClick={() => setSelectedUserId(r.id)}
                            disabled={!canManageTargetUser(r)}
                          >
                            Настроить доступ
                          </Button>
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{r.createdAt}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Drawer
        anchor="right"
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUserId(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            p: 3,
          },
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Настроить доступ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {selectedUser ? selectedUser.name : ''}
        </Typography>
        {accessError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {accessError}
          </Alert>
        ) : null}
        {accessLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Загрузка прав доступа...
            </Typography>
          </Box>
        ) : null}
        {selectedUser && !canManageTargetUser(selectedUser) ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Недостаточно прав: нельзя изменять супер-пользователя, текущего пользователя или
            сотрудника равного/более высокого уровня.
          </Alert>
        ) : null}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Просмотр страниц
        </Typography>
        <Tooltip title="Включает доступ к просмотру всех страниц">
          <FormControlLabel
            sx={{ mb: 1, pl: 3 }}
            control={
              <Checkbox
                checked={selectedUserPermissions.includes('view_all_pages')}
                onChange={(e) => handleViewAllPagesToggle(e.target.checked)}
                disabled={
                  !canManageUsers ||
                  accessLoading ||
                  accessSaving ||
                  !selectedUser ||
                  !canManageTargetUser(selectedUser)
                }
              />
            }
            label="Все страницы"
          />
        </Tooltip>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 3 }}>
          {PAGE_VIEW_OPTIONS.map((option) => (
            <Tooltip key={option.value} title="Управляет видимостью соответствующей вкладки в меню">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedUserPermissions.includes(option.value)}
                    onChange={(e) => handlePagePermissionToggle(option.value, e.target.checked)}
                    disabled={
                      !canManageUsers ||
                      accessLoading ||
                      accessSaving ||
                      !selectedUser ||
                      !canManageTargetUser(selectedUser)
                    }
                  />
                }
                label={option.label}
              />
            </Tooltip>
          ))}
        </Box>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Управление
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 3 }}>
          {MANAGEMENT_ACCESS_OPTIONS.filter((option) =>
            canConfigureManagementPermission(option.value),
          ).map((option) => (
            <Tooltip
              key={option.value}
              title="Можно включить только если разрешен просмотр страницы"
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedUserPermissions.includes(option.value)}
                    onChange={(e) => handlePermissionToggle(option.value, e.target.checked)}
                    disabled={
                      !canManageUsers ||
                      accessLoading ||
                      accessSaving ||
                      !selectedUser ||
                      !canManageTargetUser(selectedUser)
                    }
                  />
                }
                label={option.label}
              />
            </Tooltip>
          ))}
        </Box>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
          <Tooltip title="Закрыть панель и отменить несохраненные изменения">
            <span>
              <Button
                variant="outlined"
                onClick={handleCancelAccessChanges}
                disabled={accessSaving}
              >
                Отменить
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Сохранить права доступа пользователя">
            <span>
              <Button
                variant="contained"
                onClick={() => void handleSaveAccessChanges()}
                disabled={
                  !canManageUsers ||
                  accessLoading ||
                  accessSaving ||
                  !selectedUser ||
                  !canManageTargetUser(selectedUser)
                }
              >
                {accessSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Drawer>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert onClose={() => setToast(null)} severity={toast.severity} variant="filled">
            {toast.text}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  )
}
