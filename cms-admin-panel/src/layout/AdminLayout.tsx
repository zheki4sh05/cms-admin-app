import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import { useEffect, useState, type ElementType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AppLogo } from '../components/AppLogo'
import { useAuth } from '../auth/AuthContext'
import { getCompanyByEmployeeId } from '../api/client'
import { canViewPage, type AccessPermission, type PageViewPermission } from '../types/permissions'

const drawerWidth = 260

type NavItem = {
  to: string
  label: string
  Icon: ElementType
  requiredViewPermission: PageViewPermission
}

const navItemsMain: readonly NavItem[] = [
  {
    to: '/app/dashboard',
    label: 'Рабочий стол',
    Icon: DashboardOutlinedIcon,
    requiredViewPermission: 'view_dashboard_page',
  },
  {
    to: '/app/users',
    label: 'Пользователи',
    Icon: PeopleOutlinedIcon,
    requiredViewPermission: 'view_users_page',
  },
  {
    to: '/app/risk-objects',
    label: 'Рисковые объекты',
    Icon: ShieldOutlinedIcon,
    requiredViewPermission: 'view_risk_objects_page',
  },
  {
    to: '/app/integration',
    label: 'Интеграция',
    Icon: HubOutlinedIcon,
    requiredViewPermission: 'view_integrations_page',
  },
  {
    to: '/app/rules',
    label: 'Правила и риски',
    Icon: GavelOutlinedIcon,
    requiredViewPermission: 'view_rules_and_risks_page',
  },
]

const navItemsBottom: readonly NavItem[] = [
  {
    to: '/app/settings',
    label: 'Настройки',
    Icon: SettingsOutlinedIcon,
    requiredViewPermission: 'view_settings_page',
  },
  {
    to: '/app/profile',
    label: 'Личный кабинет',
    Icon: PersonOutlinedIcon,
    requiredViewPermission: 'view_profile_page',
  },
]

function navList(items: readonly NavItem[], onNavigate?: () => void) {
  return (
    <List dense disablePadding>
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          {({ isActive }) => (
            <ListItemButton selected={isActive} sx={{ mx: 1, borderRadius: 1 }}>
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          )}
        </NavLink>
      ))}
    </List>
  )
}

function drawerContent({
  permissions,
  loading,
  onNavigate,
  onLogout,
}: {
  permissions: AccessPermission[]
  loading: boolean
  onNavigate?: () => void
  onLogout: () => void
}) {
  const visibleMainItems = loading
    ? navItemsMain
    : navItemsMain.filter((item) => canViewPage(permissions, item.requiredViewPermission))
  const visibleBottomItems = loading
    ? navItemsBottom
    : navItemsBottom.filter((item) => canViewPage(permissions, item.requiredViewPermission))

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowX: 'hidden',
        pt: { xs: 1, md: 0.5 },
        pb: 0,
        px: 0,
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <Typography
          variant="subtitle1"
          sx={{
            px: 2,
            pb: 0.5,
            pt: 0,
            fontWeight: 700,
            fontSize: '0.95rem',
            letterSpacing: 0.02,
            color: 'text.secondary',
          }}
        >
          Меню
        </Typography>
        {visibleMainItems.length > 0 ? (
          navList(visibleMainItems, onNavigate)
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            Нет доступных разделов
          </Typography>
        )}
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 16 }} aria-hidden />
      <Box
        sx={(theme) => ({
          mx: 1,
          mb: 0.5,
          px: 0.25,
          py: 0.5,
          borderRadius: 2,
          flexShrink: 0,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        })}
      >
        {visibleBottomItems.length > 0 ? navList(visibleBottomItems, onNavigate) : null}
      </Box>
      <Button
        variant="text"
        size="medium"
        startIcon={<LogoutOutlinedIcon fontSize="small" />}
        onClick={() => {
          onNavigate?.()
          onLogout()
        }}
        sx={(theme) => ({
          alignSelf: 'stretch',
          mx: 1,
          mt: 1.5,
          mb: 2,
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
          justifyContent: 'flex-start',
          px: 1.25,
          py: 1.25,
          textTransform: 'none',
          fontWeight: 600,
          flexShrink: 0,
          color: theme.palette.error.dark,
          bgcolor: alpha(theme.palette.error.main, 0.08),
          borderRadius: 2,
          '&:hover': {
            bgcolor: alpha(theme.palette.error.main, 0.15),
            color: theme.palette.error.dark,
          },
        })}
      >
        Выйти
      </Button>
    </Box>
  )
}

export function AdminLayout() {
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const { token, user, permissions, loading, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleLogout() {
    setAnchorEl(null)
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!token || !user?.id?.trim()) {
      setCompanyName(null)
      return
    }
    let cancelled = false
    getCompanyByEmployeeId(token, user.id.trim())
      .then((company) => {
        if (!cancelled) {
          setCompanyName(company.name)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyName(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.id])

  const drawerTransition = theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: sidebarExpanded
      ? theme.transitions.duration.enteringScreen
      : theme.transitions.duration.leavingScreen,
  })

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="nav"
        sx={{
          width: { xs: 0, md: sidebarExpanded ? drawerWidth : 0 },
          flexShrink: { md: 0 },
          overflow: 'hidden',
          transition: drawerTransition,
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar sx={{ flexShrink: 0 }} />
          {drawerContent({
            permissions,
            loading,
            onNavigate: () => setMobileOpen(false),
            onLogout: handleLogout,
          })}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: 1,
              borderColor: 'divider',
              top: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden',
              transition: theme.transitions.create('transform', {
                easing: theme.transitions.easing.sharp,
                duration: sidebarExpanded
                  ? theme.transitions.duration.enteringScreen
                  : theme.transitions.duration.leavingScreen,
              }),
              transform: sidebarExpanded ? 'none' : 'translateX(-100%)',
              pointerEvents: sidebarExpanded ? 'auto' : 'none',
            },
          }}
        >
          {drawerContent({ permissions, loading, onLogout: handleLogout })}
        </Drawer>
      </Box>

      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: (z) => z.drawer + 1,
          width: {
            xs: '100%',
            md: sidebarExpanded ? `calc(100% - ${drawerWidth}px)` : '100%',
          },
          ml: { xs: 0, md: sidebarExpanded ? `${drawerWidth}px` : 0 },
          transition: drawerTransition,
        }}
      >
        <Toolbar>
          {!isMdUp ? (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="открыть меню"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
            >
              <Typography component="span" sx={{ fontSize: 22 }}>
                ☰
              </Typography>
            </IconButton>
          ) : (
            <IconButton
              color="inherit"
              edge="start"
              aria-label={sidebarExpanded ? 'Скрыть меню' : 'Показать меню'}
              onClick={() => setSidebarExpanded((v) => !v)}
              sx={{ mr: 0.5 }}
            >
              {sidebarExpanded ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          )}
          <AppLogo />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="caption" color="text.secondary">
                {companyName ?? 'Компания не указана'}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                {initials}
              </Avatar>
            </IconButton>
          </Box>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                setAnchorEl(null)
                navigate('/app/profile')
              }}
            >
              Личный кабинет
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: {
            md: sidebarExpanded ? `calc(100% - ${drawerWidth}px)` : '100%',
          },
          mt: '64px',
          transition: drawerTransition,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
