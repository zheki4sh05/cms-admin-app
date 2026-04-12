import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRiskObjectModels, putIntegrationDraftCurrent } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { IntegrationDraftPayload, IntegrationKind, RiskObjectModel } from '../types/integrationDraft'

function hasDraftContent(payload: IntegrationDraftPayload) {
  return (
    payload.name.trim().length > 0 ||
    payload.endpointUrl.trim().length > 0 ||
    payload.riskObjectModelId.trim().length > 0 ||
    payload.integrationKind !== ''
  )
}

export function IntegrationCreatePage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [name, setName] = useState('')
  const [integrationKind, setIntegrationKind] = useState<IntegrationKind | ''>('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [riskObjectModelId, setRiskObjectModelId] = useState('')

  const [riskModels, setRiskModels] = useState<RiskObjectModel[]>([])
  const [riskModelsLoading, setRiskModelsLoading] = useState(true)
  const [riskModelsError, setRiskModelsError] = useState<string | null>(null)

  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [draftError, setDraftError] = useState<string | null>(null)
  const draftStatusClearRef = useRef<number | undefined>(undefined)

  const loadRiskModels = useCallback(async () => {
    if (!token) return
    setRiskModelsLoading(true)
    setRiskModelsError(null)
    try {
      const items = await getRiskObjectModels(token)
      setRiskModels(items)
    } catch (e: unknown) {
      setRiskModelsError(e instanceof Error ? e.message : 'Ошибка загрузки списка')
      setRiskModels([])
    } finally {
      setRiskModelsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadRiskModels()
  }, [loadRiskModels])

  const saveDraft = useCallback(async () => {
    if (!token) return
    const payload: IntegrationDraftPayload = {
      name,
      integrationKind,
      endpointUrl,
      riskObjectModelId,
    }
    if (!hasDraftContent(payload)) return
    setDraftStatus('saving')
    setDraftError(null)
    try {
      await putIntegrationDraftCurrent(token, payload)
      setDraftStatus('saved')
      window.clearTimeout(draftStatusClearRef.current)
      draftStatusClearRef.current = window.setTimeout(() => {
        setDraftStatus((s) => (s === 'saved' ? 'idle' : s))
      }, 4000)
    } catch (e: unknown) {
      setDraftStatus('error')
      setDraftError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }, [token, name, integrationKind, endpointUrl, riskObjectModelId])

  useEffect(() => {
    if (!token) return
    const payload: IntegrationDraftPayload = {
      name,
      integrationKind,
      endpointUrl,
      riskObjectModelId,
    }
    if (!hasDraftContent(payload)) {
      setDraftStatus('idle')
      setDraftError(null)
      return
    }
    const t = window.setTimeout(() => {
      void saveDraft()
    }, 600)
    return () => window.clearTimeout(t)
  }, [token, name, integrationKind, endpointUrl, riskObjectModelId, saveDraft])

  useEffect(() => {
    return () => window.clearTimeout(draftStatusClearRef.current)
  }, [])

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/app/integration')}
        sx={{ mb: 2 }}
      >
        Назад
      </Button>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Создание новой интеграции
      </Typography>

      <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
        <TextField
          label="Название интеграции"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoComplete="off"
        />

        <FormControl fullWidth>
          <FormLabel sx={{ mb: 1 }}>Вид интеграции</FormLabel>
          <ToggleButtonGroup
            exclusive
            value={integrationKind === '' ? null : integrationKind}
            onChange={(_, value: IntegrationKind | null) => {
              setIntegrationKind(value ?? '')
            }}
            aria-label="Вид интеграции"
            fullWidth
            sx={{ flexWrap: 'wrap' }}
          >
            <ToggleButton value="pull" sx={{ flex: 1, textTransform: 'none' }}>
              Pull
            </ToggleButton>
            <ToggleButton value="push" sx={{ flex: 1, textTransform: 'none' }}>
              Push
            </ToggleButton>
            <ToggleButton value="broker" sx={{ flex: 1, textTransform: 'none' }}>
              Broker
            </ToggleButton>
          </ToggleButtonGroup>
        </FormControl>

        <TextField
          label="URL"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          fullWidth
          type="url"
          placeholder="https://"
          autoComplete="off"
        />

        <Divider sx={{ borderBottomWidth: 2 }} />

        <FormControl
          fullWidth
          disabled={riskModelsLoading || riskModels.length === 0}
          error={Boolean(riskModelsError)}
        >
          <InputLabel id="risk-model-label">Выбрать модель рискового объекта</InputLabel>
          <Select
            labelId="risk-model-label"
            label="Выбрать модель рискового объекта"
            value={riskObjectModelId}
            onChange={(e) => setRiskObjectModelId(e.target.value as string)}
            displayEmpty
            renderValue={(selected) => {
              if (!selected) {
                return (
                  <Typography component="span" color="text.secondary">
                    {riskModels.length === 0 && !riskModelsLoading
                      ? 'Нет доступных моделей'
                      : '— не выбрано —'}
                  </Typography>
                )
              }
              return riskModels.find((m) => m.id === selected)?.name ?? selected
            }}
          >
            {riskModels.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
          {riskModelsLoading ? (
            <FormHelperText>Загрузка списка…</FormHelperText>
          ) : riskModelsError ? (
            <FormHelperText error>{riskModelsError}</FormHelperText>
          ) : riskModels.length === 0 ? (
            <FormHelperText>
              Список моделей пуст — выбор недоступен, пока сервер не вернёт данные.
            </FormHelperText>
          ) : null}
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 28 }}>
          {draftStatus === 'saving' ? (
            <>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Сохранение черновика…
              </Typography>
            </>
          ) : null}
          {draftStatus === 'saved' ? (
            <Typography variant="body2" color="success.main">
              Черновик сохранён на сервере
            </Typography>
          ) : null}
          {draftStatus === 'error' ? (
            <Typography variant="body2" color="error">
              {draftError ?? 'Не удалось сохранить черновик'}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}
