import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getMe, postLogin } from '../api/client'
import type { AppUser } from '../types/user'

const STORAGE_KEY = 'trustflow_access_token'
const COMPANY_ID_STORAGE_KEY = 'trustflow_company_id'

type AuthContextValue = {
  user: AppUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  )
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(Boolean(token))

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      return
    }
    const data = (await getMe(token)) as AppUser
    if (data.companyId?.trim()) {
      localStorage.setItem(COMPANY_ID_STORAGE_KEY, data.companyId)
    } else {
      localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    }
    setUser(data)
  }, [token])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getMe(token)
      .then((data) => {
        if (!cancelled) {
          const nextUser = data as AppUser
          if (nextUser.companyId?.trim()) {
            localStorage.setItem(COMPANY_ID_STORAGE_KEY, nextUser.companyId)
          } else {
            localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
          }
          setUser(nextUser)
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
    const { accessToken, user: nextUser } = await postLogin(email, password)
    localStorage.setItem(STORAGE_KEY, accessToken)
    if ((nextUser as AppUser).companyId?.trim()) {
      localStorage.setItem(COMPANY_ID_STORAGE_KEY, (nextUser as AppUser).companyId)
    } else {
      localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
    }
    setToken(accessToken)
    setUser(nextUser as AppUser)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshUser,
    }),
    [user, token, loading, login, logout, refreshUser],
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
