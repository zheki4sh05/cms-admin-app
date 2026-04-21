import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { putUserById } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { roleLabel } from '../utils/roleLabel'

export function ProfilePage() {
  const { user, token, refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    setFirstName(user?.firstName ?? '')
    setLastName(user?.lastName ?? '')
    setEmail(user?.email ?? '')
  }, [user?.email, user?.firstName, user?.lastName])

  const saveDisabled = useMemo(() => {
    if (!user || !token || busy) return true
    return !firstName.trim() || !email.trim()
  }, [busy, email, firstName, token, user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !token) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await putUserById(token, user.id, {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      await refreshUser()
      setSuccess('Профиль обновлён')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить профиль')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Личный кабинет
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      ) : null}

      <Card variant="outlined" sx={{ maxWidth: 480 }}>
        <CardContent component="form" onSubmit={handleSubmit}>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Редактирование профиля
            </Typography>
            <TextField
              label="Имя"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={busy || !user}
              required
              fullWidth
            />
            <TextField
              label="Фамилия"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={busy || !user}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy || !user}
              required
              fullWidth
            />
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              Роль
            </Typography>
            <Typography variant="body1">{roleLabel(user?.role)}</Typography>
            <Box sx={{ pt: 2 }}>
              <Button type="submit" variant="contained" disabled={saveDisabled}>
                {busy ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
