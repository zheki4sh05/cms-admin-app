import { Box, Typography } from '@mui/material'
import { NavLink } from 'react-router-dom'

export function AppLogo() {
  return (
    <Box
      component={NavLink}
      to="/app/dashboard"
      aria-label="TrustFlow-admin — на главную панели"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.25,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: -0.5,
          flexShrink: 0,
        }}
      >
        TF
      </Box>
      <Typography
        variant="h6"
        component="span"
        sx={{
          fontWeight: 700,
          letterSpacing: -0.4,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}
      >
        TrustFlow
        <Box
          component="span"
          sx={{
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          -admin
        </Box>
      </Typography>
    </Box>
  )
}
