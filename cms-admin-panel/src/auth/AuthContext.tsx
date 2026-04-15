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
  const [user, setUser] = useState<AppUser | null>(null)
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
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(REFRESH_STORAGE_KEY)
    localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
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
    const [data, nextPermissions] = await Promise.all([getMe(token), getMyPermissions(token)])
    if (data.companyId?.trim()) {
      localStorage.setItem(COMPANY_ID_STORAGE_KEY, data.companyId)
    } else {
      localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    }
    setUser(data as AppUser)
    setPermissions(nextPermissions)
  }, [token])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setPermissions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([getMe(token), getMyPermissions(token)])
      .then(([data, nextPermissions]) => {
        if (!cancelled) {
          const nextUser = data as AppUser
          if (nextUser.companyId?.trim()) {
            localStorage.setItem(COMPANY_ID_STORAGE_KEY, nextUser.companyId)
          } else {
            localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
          }
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
    const { accessToken, refreshToken: nextRefreshToken, user: nextUser } = await postLogin(
      email,
      password,
    )
    localStorage.setItem(STORAGE_KEY, accessToken)
    localStorage.setItem(REFRESH_STORAGE_KEY, nextRefreshToken)
    if ((nextUser as AppUser).companyId?.trim()) {
      localStorage.setItem(COMPANY_ID_STORAGE_KEY, (nextUser as AppUser).companyId)
    } else {
      localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    }
    setToken(accessToken)
    setRefreshToken(nextRefreshToken)
    setUser(nextUser as AppUser)
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
