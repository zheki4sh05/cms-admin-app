import { CssBaseline, ThemeProvider } from '@mui/material'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AdminLayout } from './layout/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { IntegrationCreatePage } from './pages/IntegrationCreatePage'
import { IntegrationDetailsPage } from './pages/IntegrationDetailsPage'
import { IntegrationPage } from './pages/IntegrationPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RiskObjectCreatePage } from './pages/RiskObjectCreatePage'
import { RiskObjectDetailsPage } from './pages/RiskObjectDetailsPage'
import { RiskCategoriesPage } from './pages/RiskCategoriesPage'
import { RiskObjectsPage } from './pages/RiskObjectsPage'
import { RulesCreatePage } from './pages/RulesCreatePage'
import { RulesDetailsPage } from './pages/RulesDetailsPage'
import { RulesPage } from './pages/RulesPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'
import { RequireAuth } from './routes/RequireAuth'
import { appTheme } from './theme'

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/app" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="risk-objects/new" element={<RiskObjectCreatePage />} />
                <Route path="risk-objects/:id" element={<RiskObjectDetailsPage />} />
                <Route path="risk-objects" element={<RiskObjectsPage />} />
                <Route path="risk-categories" element={<RiskCategoriesPage />} />
                <Route path="rules/new" element={<RulesCreatePage />} />
                <Route path="rules/:id" element={<RulesDetailsPage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="integration/new" element={<IntegrationCreatePage />} />
                <Route path="integration/:id" element={<IntegrationDetailsPage />} />
                <Route path="integration" element={<IntegrationPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
