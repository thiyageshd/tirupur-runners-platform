import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import EventsPage from './pages/EventsPage'
import { AboutPage, ContactPage } from './pages/StaticPages'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import { useAuthStore } from './store/authStore'
import useInactivityLogout from './hooks/useInactivityLogout'

function ProtectedRoute({ children, adminOnly = false }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/members/login" replace />
  if (adminOnly && user && !user.is_admin) return <Navigate to="/members/dashboard" replace />
  return children
}

function AppRoutes() {
  useInactivityLogout()
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Members section */}
      <Route path="/members" element={<Navigate to="/members/login" replace />} />
      <Route path="/members/login" element={<LoginPage />} />
      <Route path="/members/register" element={<RegisterPage />} />
      <Route path="/members/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/members/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />

      {/* Legacy redirects */}
      <Route path="/login" element={<Navigate to="/members/login" replace />} />
      <Route path="/register" element={<Navigate to="/members/register" replace />} />
      <Route path="/dashboard" element={<Navigate to="/members/dashboard" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/members/forgot-password" replace />} />

      <Route path="/admin" element={
        <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const { token, fetchMe, fetchSettings } = useAuthStore()

  useEffect(() => {
    fetchSettings()
    if (token) fetchMe()
  }, [])

  return (
    <BrowserRouter>
      <Navbar />
      <main>
        <AppRoutes />
      </main>
      <Footer />
    </BrowserRouter>
  )
}
