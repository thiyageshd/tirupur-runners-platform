import { create } from 'zustand'
import { authApi, settingsApi } from '../api'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('auth_user') || 'null')
  } catch {
    return null
  }
}

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem('access_token') || null,
  loading: false,
  error: null,
  settings: { show_login: 'true', show_register: 'true', show_join_club: 'true' },

  fetchSettings: async () => {
    try {
      const { data } = await settingsApi.get()
      set({ settings: data })
    } catch {
      // keep defaults
    }
  },

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token })
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.me()
      localStorage.setItem('auth_user', JSON.stringify(data))
      set({ user: data })
    } catch (err) {
      // Only clear auth on explicit 401 (invalid/expired token).
      // Network errors and 5xx keep the cached session alive.
      if (err.response?.status === 401) {
        localStorage.removeItem('auth_user')
        set({ user: null, token: null })
        localStorage.removeItem('access_token')
      }
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.login({ email, password })
      localStorage.setItem('access_token', data.access_token)
      set({ token: data.access_token, loading: false })
      await get().fetchMe()
    } catch (err) {
      set({ error: err.response?.data?.detail || 'Login failed', loading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    set({ user: null, token: null })
  },

  isAdmin: () => get().user?.is_admin || false,
}))
