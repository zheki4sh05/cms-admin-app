import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainAppUrl = (import.meta.env.VITE_MAIN_APP_URL ?? '').trim() || '/'
  const isTestMode = import.meta.env.MODE === 'test'
  const from =
    (location.state as { from?: string } | null)?.from ?? '/app/dashboard'

  const [email, setEmail] = useState('admin@trustflow.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const demoCredentials = [
    { role: 'Супер-пользователь (admin)', email: 'admin@trustflow.local', password: 'admin123' },
    { role: 'Менеджер', email: 'manager@trustflow.local', password: 'manager123' },
    { role: 'Руководитель', email: 'head@trustflow.local', password: 'head123' },
    { role: 'ТОП-менеджмент', email: 'top@trustflow.local', password: 'top123' },
  ] as const

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (user) {
    return <Navigate to="/app/dashboard" replace />
  }

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Link
        href={mainAppUrl}
        underline="hover"
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          fontWeight: 500,
        }}
      >
        Перейти в основное приложение
      </Link>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider' }}>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Typography variant="h5" component="h1">
              Trustflow-Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Войдите в панель управления
            </Typography>
          </Stack>

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField
                label="Email"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Пароль"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                helperText={
                  isTestMode ? undefined : 'Используйте данные из блока «Демо-аккаунты» ниже'
                }
              />
              {!isTestMode ? (
                <Alert severity="info" sx={{ alignItems: 'flex-start' }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                    Демо-аккаунты
                  </Typography>
                  <Stack spacing={0.5}>
                    {demoCredentials.map((item) => (
                      <Typography key={item.email} variant="body2">
                        {item.role}: <strong>{item.email}</strong> / <strong>{item.password}</strong>
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
              ) : null}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
              >
                {submitting ? 'Вход…' : 'Войти'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}
