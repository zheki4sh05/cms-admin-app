import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getMe,
  getMyPermissions,
  postLogin,
  postRefreshToken,
  setRefreshAccessTokenHandler,
} from '../api/client'
import { canViewPage, type AccessPermission, type PageViewPermission } from '../types/permissions'
import type { AppUser } from '../types/user'

const STORAGE_KEY = 'trustflow_access_token'
const REFRESH_STORAGE_KEY = 'trustflow_refresh_token'
const COMPANY_ID_STORAGE_KEY = 'trustflow_company_id'
const USER_STORAGE_KEY = 'trustflow_me'

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? '', lastName: '' }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function getStoredCompanyIdFromKey(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const v = localStorage.getItem(COMPANY_ID_STORAGE_KEY)?.trim()
  return v || undefined
}

function readStoredUser(): AppUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AppUser>
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.name === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.role === 'string'
    ) {
      const companyId =
        (typeof parsed.companyId === 'string' && parsed.companyId.trim()) ||
        getStoredCompanyIdFromKey() ||
        ''
      if (!companyId.trim()) return null
      const parsedName = splitFullName(parsed.name)
      const firstName =
        (typeof parsed.firstName === 'string' && parsed.firstName.trim()) || parsedName.firstName
      const lastName =
        (typeof parsed.lastName === 'string' && parsed.lastName.trim()) || parsedName.lastName
      if (!firstName.trim()) return null
      return { ...parsed, companyId, firstName, lastName } as AppUser
    }
  } catch {
    // Ignore malformed stored user and continue with fresh auth state.
  }
  return null
}

function persistUser(user: AppUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** Строка или число (часто id приходит как number в JSON). */
function pickScalarString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

function pickId(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  return (
    pickScalarString(r.id) ??
    pickScalarString(r.Id) ??
    pickScalarString(r.userId) ??
    pickScalarString(r.UserId) ??
    pickScalarString(r.user_id) ??
    pickScalarString(r.sub) ??
    stored?.id
  )
}

function pickDisplayName(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  const combined =
    [pickString(r.firstName) ?? pickString(r.FirstName), pickString(r.lastName) ?? pickString(r.LastName)]
      .filter(Boolean)
      .join(' ')
      .trim()
  return (
    pickString(r.name) ??
    pickString(r.Name) ??
    pickString(r.fullName) ??
    pickString(r.FullName) ??
    pickString(r.displayName) ??
    pickString(r.DisplayName) ??
    pickString(r.userName) ??
    pickString(r.UserName) ??
    (combined || undefined) ??
    stored?.name
  )
}

function pickFirstNameValue(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  const direct =
    pickString(r.firstName) ??
    pickString(r.FirstName) ??
    pickString(r.first_name) ??
    pickString(r.First_Name) ??
    stored?.firstName
  if (direct) return direct
  const fallbackName = pickDisplayName(r, stored) ?? ''
  return splitFullName(fallbackName).firstName || undefined
}

function pickLastNameValue(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  const direct =
    pickString(r.lastName) ??
    pickString(r.LastName) ??
    pickString(r.last_name) ??
    pickString(r.Last_Name) ??
    stored?.lastName
  if (direct !== undefined) return direct
  const fallbackName = pickDisplayName(r, stored) ?? ''
  return splitFullName(fallbackName).lastName
}

function pickEmail(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  return pickString(r.email) ?? pickString(r.Email) ?? stored?.email
}

function pickRoleValue(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  const direct =
    pickString(r.role) ??
    pickString(r.Role) ??
    pickString(r.userRole) ??
    pickString(r.UserRole) ??
    stored?.role
  if (direct) return direct
  const arr = (r.roles ?? r.Roles) as unknown
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0]
    return pickScalarString(first) ?? pickString(first)
  }
  return undefined
}

function pickCompanyIdValue(r: Record<string, unknown>, stored: AppUser | null): string | undefined {
  return (
    pickString(r.companyId) ??
    pickString(r.CompanyId) ??
    pickString(r.company_id) ??
    pickString(r.companyID) ??
    pickScalarString(r.organizationId) ??
    pickScalarString(r.OrganizationId) ??
    pickScalarString(r.orgId) ??
    pickScalarString(r.OrgId) ??
    pickScalarString(r.tenantId) ??
    pickScalarString(r.TenantId) ??
    stored?.companyId?.trim() ??
    getStoredCompanyIdFromKey()
  )
}

/** Для сообщения об ошибке: какие поля не удалось извлечь из ответа логина / me. */
function formatMissingProfileHint(raw: unknown): string {
  const r = asRecord(unwrapProfilePayload(raw))
  if (!r) {
    return 'тело user пустое или не объект. Нужен JSON-объект пользователя.'
  }
  const stored = readStoredUser()
  const missing: string[] = []
  if (!pickId(r, stored)) missing.push('id (или Id, userId, sub, …)')
  if (!pickDisplayName(r, stored)) missing.push('name (или Name, fullName, displayName, firstName+lastName, …)')
  if (!pickEmail(r, stored)) missing.push('email (или Email)')
  if (!pickRoleValue(r, stored)) missing.push('role (или Role, roles[0], …)')
  if (!pickFirstNameValue(r, stored)) missing.push('firstName (или FirstName)')
  if (pickLastNameValue(r, stored) === undefined) missing.push('lastName (или LastName)')
  if (!pickCompanyIdValue(r, stored)?.trim()) {
    missing.push('companyId (или CompanyId, organizationId, tenantId, …) либо уже сохранённый trustflow_company_id')
  }
  if (missing.length === 0) {
    return 'не удалось сопоставить поля с ожидаемым форматом (см. консоль разработчика → ответ login).'
  }
  return `не хватает: ${missing.join('; ')}`
}

/** Распространённые варианты вложения тела профиля в ответе API. */
function unwrapProfilePayload(apiData: unknown): unknown {
  const r = asRecord(apiData)
  if (!r) return apiData
  const nested =
    r.data ??
    r.user ??
    r.profile ??
    r.employee ??
    r.me ??
    r.item
  return nested !== undefined ? nested : apiData
}

/** Привести произвольный объект пользователя с API к AppUser (login / me). */
function normalizeAppUser(raw: unknown, stored: AppUser | null): AppUser | null {
  const r = asRecord(unwrapProfilePayload(raw))
  if (!r) return stored
  const id = pickId(r, stored)
  const name = pickDisplayName(r, stored)
  const email = pickEmail(r, stored)
  const role = pickRoleValue(r, stored)
  const firstName = pickFirstNameValue(r, stored)
  const lastName = pickLastNameValue(r, stored)
  const companyId = pickCompanyIdValue(r, stored) ?? ''
  if (
    !id?.trim() ||
    !name?.trim() ||
    !email?.trim() ||
    !role?.trim() ||
    !firstName?.trim() ||
    lastName === undefined ||
    !companyId.trim()
  ) {
    return stored
  }
  return { id, name, email, role, firstName, lastName, companyId }
}

/** Свести ответ GET /me с данными из localStorage (после login бэкенд может отдавать не все поля). */
function mergeSessionUser(apiData: unknown, stored: AppUser | null): AppUser | null {
  return normalizeAppUser(apiData, stored)
}

async function loadPermissionsSafe(
  token: string,
  user: AppUser,
): Promise<AccessPermission[]> {
  try {
    return await getMyPermissions(token, user.id, user.companyId)
  } catch {
    return []
  }
}

function clearStoredAppData() {
  if (typeof window === 'undefined') return

  const appKeyPrefix = 'trustflow_'
  const localStorageKeys = Object.keys(localStorage)
  for (const key of localStorageKeys) {
    if (key.startsWith(appKeyPrefix)) {
      localStorage.removeItem(key)
    }
  }

  // Keep logout deterministic even if app starts using sessionStorage later.
  const sessionStorageKeys = Object.keys(sessionStorage)
  for (const key of sessionStorageKeys) {
    if (key.startsWith(appKeyPrefix)) {
      sessionStorage.removeItem(key)
    }
  }
}

type AuthContextValue = {
  user: AppUser | null
  permissions: AccessPermission[]
  token: string | null
  loading: boolean
  hasPermission: (permission: AccessPermission) => boolean
  hasPageAccess: (permission: PageViewPermission) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  )
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(REFRESH_STORAGE_KEY) : null,
  )
  const [user, setUser] = useState<AppUser | null>(() => readStoredUser())
  const [permissions, setPermissions] = useState<AccessPermission[]>([])
  const [loading, setLoading] = useState(Boolean(token))
  const tokenRef = useRef(token)
  const refreshTokenRef = useRef(refreshToken)
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    refreshTokenRef.current = refreshToken
  }, [refreshToken])

  const logout = useCallback(() => {
    clearStoredAppData()
    setToken(null)
    setRefreshToken(null)
    setUser(null)
    setPermissions([])
  }, [])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    const currentRefreshToken = refreshTokenRef.current
    if (!currentRefreshToken) {
      logout()
      return null
    }

    const refreshPromise = postRefreshToken(currentRefreshToken)
      .then(({ accessToken, refreshToken: nextRefreshToken }) => {
        localStorage.setItem(STORAGE_KEY, accessToken)
        localStorage.setItem(REFRESH_STORAGE_KEY, nextRefreshToken)
        setToken(accessToken)
        setRefreshToken(nextRefreshToken)
        return accessToken
      })
      .catch(() => {
        logout()
        return null
      })
      .finally(() => {
        refreshInFlightRef.current = null
      })

    refreshInFlightRef.current = refreshPromise
    return refreshPromise
  }, [logout])

  useEffect(() => {
    setRefreshAccessTokenHandler(async (failedAccessToken) => {
      const currentAccessToken = tokenRef.current
      if (!currentAccessToken) {
        return null
      }
      if (failedAccessToken !== currentAccessToken) {
        return currentAccessToken
      }
      return refreshAccessToken()
    })
    return () => {
      setRefreshAccessTokenHandler(null)
    }
  }, [refreshAccessToken])

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      setPermissions([])
      return
    }
    const raw = await getMe(token)
    const nextUser = mergeSessionUser(raw, readStoredUser())
    if (!nextUser) {
      logout()
      return
    }
    if (nextUser.companyId?.trim()) {
      localStorage.setItem(COMPANY_ID_STORAGE_KEY, nextUser.companyId)
    } else {
      localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    }
    const nextPermissions = await loadPermissionsSafe(token, nextUser)
    persistUser(nextUser)
    setUser(nextUser)
    setPermissions(nextPermissions)
  }, [token, logout])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setPermissions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getMe(token)
      .then(async (data) => {
        const nextUser = mergeSessionUser(data, readStoredUser())
        if (!nextUser) {
          throw new Error('Некорректный ответ профиля')
        }
        if (nextUser.companyId?.trim()) {
          localStorage.setItem(COMPANY_ID_STORAGE_KEY, nextUser.companyId)
        } else {
          localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
        }
        const nextPermissions = await loadPermissionsSafe(token, nextUser)
        if (!cancelled) {
          persistUser(nextUser)
          setUser(nextUser)
          setPermissions(nextPermissions)
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout()
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, logout])

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken: nextRefreshToken, user: rawUser } = await postLogin(
      email,
      password,
    )
    const nextUser = normalizeAppUser(rawUser, readStoredUser())
    if (!nextUser) {
      throw new Error(
        `Некорректный ответ сервера: профиль пользователя — ${formatMissingProfileHint(rawUser)}`,
      )
    }
    localStorage.setItem(STORAGE_KEY, accessToken)
    localStorage.setItem(REFRESH_STORAGE_KEY, nextRefreshToken)
    if (nextUser.companyId.trim()) {
      localStorage.setItem(COMPANY_ID_STORAGE_KEY, nextUser.companyId)
    } else {
      localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    }
    setToken(accessToken)
    setRefreshToken(nextRefreshToken)
    persistUser(nextUser)
    setUser(nextUser)
    setPermissions([])
  }, [])

  const hasPermission = useCallback(
    (permission: AccessPermission) => permissions.includes(permission),
    [permissions],
  )
  const hasPageAccess = useCallback(
    (permission: PageViewPermission) => canViewPage(permissions, permission),
    [permissions],
  )

  const value = useMemo(
    () => ({
      user,
      permissions,
      token,
      loading,
      hasPermission,
      hasPageAccess,
      login,
      logout,
      refreshUser,
    }),
    [
      user,
      permissions,
      token,
      loading,
      hasPermission,
      hasPageAccess,
      login,
      logout,
      refreshUser,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
