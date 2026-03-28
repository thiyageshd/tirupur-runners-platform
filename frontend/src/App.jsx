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
import { useAuthStore } from './store/authStore'
import useInactivityLogout from './hooks/useInactivityLogout'

function ProtectedRoute({ children, adminOnly = false }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (adminOnly && user && !user.is_admin) return <Navigate to="/dashboard" replace />
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
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const { token, fetchMe } = useAuthStore()

  useEffect(() => {
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
