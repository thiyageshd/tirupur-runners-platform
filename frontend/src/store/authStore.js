import { create } from 'zustand'
import { authApi } from '../api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token') || null,
  loading: false,
  error: null,

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token })
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.me()
      set({ user: data })
    } catch {
      set({ user: null, token: null })
      localStorage.removeItem('access_token')
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
    set({ user: null, token: null })
  },

  isAdmin: () => get().user?.is_admin || false,
}))
