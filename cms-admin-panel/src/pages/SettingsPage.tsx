import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { getSettings, putSettings } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function SettingsPage() {
  const { token } = useAuth()
  const [notificationsEmail, setNotificationsEmail] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [apiRegion, setApiRegion] = useState('eu-central')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getSettings(token)
      .then((s) => {
        if (!cancelled) {
          setNotificationsEmail(s.notificationsEmail)
          setMaintenanceMode(s.maintenanceMode)
          setApiRegion(s.apiRegion)
        }
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
  }, [token])

  async function handleSave() {
    if (!token) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await putSettings(token, {
        notificationsEmail,
        maintenanceMode,
        apiRegion,
      })
      setSuccess('Настройки сохранены (ответ мок-сервера)')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Настройки
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Чтение и сохранение через <code>GET/PUT /api/settings</code>.
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

      <Stack spacing={2} maxWidth={480}>
        <FormControlLabel
          control={
            <Switch
              checked={notificationsEmail}
              onChange={(e) => setNotificationsEmail(e.target.checked)}
              disabled={loading}
            />
          }
          label="Email-уведомления"
        />
        <FormControlLabel
          control={
            <Switch
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              disabled={loading}
            />
          }
          label="Режим обслуживания"
        />
        <FormControl fullWidth disabled={loading}>
          <FormLabel id="region-label" sx={{ mb: 0.75, display: 'block' }}>
            Регион API
          </FormLabel>
          <Select
            aria-labelledby="region-label"
            value={apiRegion}
            onChange={(e) => setApiRegion(e.target.value)}
          >
            <MenuItem value="eu-central">EU Central</MenuItem>
            <MenuItem value="us-east">US East</MenuItem>
          </Select>
        </FormControl>
        <Box>
          <Button variant="contained" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}
