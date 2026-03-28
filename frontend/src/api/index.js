import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401 — but NOT for auth endpoints (wrong password is also a 401)
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthEndpoint = err.config?.url?.startsWith('/auth/')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  requestOtp: (email) => apiClient.post('/auth/otp/request', { email }),
  verifyOtp: (email, otp) => apiClient.post('/auth/otp/verify', { email, otp }),
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/me', data),
}

// ─── Memberships ───────────────────────────────────────────────────────────

export const membershipApi = {
  getMy: () => apiClient.get('/memberships/my'),
  getActive: () => apiClient.get('/memberships/my/active'),
}

// ─── Payments ─────────────────────────────────────────────────────────────

export const paymentApi = {
  createOrder: (year) => apiClient.post('/payments/order', { year }),
  verifyPayment: (data) => apiClient.post('/payments/verify', data),
}

// ─── Admin ────────────────────────────────────────────────────────────────

export const adminApi = {
  getMembers: (status) =>
    apiClient.get('/admin/members', { params: status ? { status } : {} }),
  exportCsv: (status) =>
    apiClient.get('/admin/members/export', {
      params: status ? { status } : {},
      responseType: 'blob',
    }),
  getStats: () => apiClient.get('/admin/stats'),
  toggleAdmin: (userId) => apiClient.put(`/admin/users/${userId}/toggle-admin`),
  uploadOfflinePayments: (formData) =>
    apiClient.post('/admin/offline-payments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ─── Settings ─────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data),
}
