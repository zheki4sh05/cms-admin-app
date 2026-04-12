import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleRefresh() {
    setBusy(true)
    setError(null)
    try {
      await refreshUser()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Личный кабинет
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Данные профиля приходят с <code>/api/me</code>.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Card variant="outlined" sx={{ maxWidth: 480 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Имя
            </Typography>
            <Typography variant="body1">{user?.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              Email
            </Typography>
            <Typography variant="body1">{user?.email}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              Роль
            </Typography>
            <Typography variant="body1">{user?.role}</Typography>
            <Box sx={{ pt: 2 }}>
              <Button variant="outlined" onClick={handleRefresh} disabled={busy}>
                {busy ? 'Обновление…' : 'Обновить с сервера'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
