import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export function IntegrationCreatePage() {
  const navigate = useNavigate()

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/app/integration')}
        sx={{ mb: 2 }}
      >
        Назад
      </Button>
      <Typography variant="h5" component="h1">
        Создание новой интеграции
      </Typography>
    </Box>
  )
}
