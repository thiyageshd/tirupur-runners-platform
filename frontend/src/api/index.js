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
      window.location.href = '/members/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  checkEmail: (email) => apiClient.get('/auth/check-email', { params: { email } }),
  checkPhone: (phone) => apiClient.get('/auth/check-phone', { params: { phone } }),
  validateRefs: (data) => apiClient.post('/auth/validate-references', data),
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  requestOtp: (email) => apiClient.post('/auth/otp/request', { email }),
  verifyOtp: (email, otp) => apiClient.post('/auth/otp/verify', { email, otp }),
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/me', data),
  getMyProfile: () => apiClient.get('/auth/me/profile'),
  updateMyProfile: (data) => apiClient.put('/auth/me/profile', data),
  uploadPhoto: (photo_data) => apiClient.put('/auth/me/photo', { photo_data }),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (email, otp, new_password) => apiClient.post('/auth/reset-password', { email, otp, new_password }),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
  uploadAadhar: (aadhar_data) => apiClient.put('/auth/me/aadhar', { aadhar_data }),
}

// ─── Memberships ───────────────────────────────────────────────────────────

export const membershipApi = {
  getMy: (year) => apiClient.get('/memberships/my', { params: year ? { year } : {} }),
  getActive: () => apiClient.get('/memberships/my/active'),
}

// ─── Payments ─────────────────────────────────────────────────────────────

export const paymentApi = {
  createOrder: (year) => apiClient.post('/payments/order', { year }),
  verifyPayment: (data) => apiClient.post('/payments/verify', data),
  getMyPayments: () => apiClient.get('/payments/my'),
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
  updateTshirt: (userId, t_shirt_size) => apiClient.put(`/admin/users/${userId}/tshirt`, { t_shirt_size }),
  uploadOfflinePayments: (formData) =>
    apiClient.post('/admin/offline-payments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getPendingUsers: () => apiClient.get('/admin/users/pending'),
  getRejectedUsers: () => apiClient.get('/admin/users/rejected'),
  getInactiveMembers: () => apiClient.get('/admin/users/inactive'),
  approveUser: (id) => apiClient.put(`/admin/users/${id}/approve`),
  rejectUser: (id) => apiClient.put(`/admin/users/${id}/reject`),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
  updateMembershipId: (membershipUuid, membership_id) =>
    apiClient.put(`/admin/memberships/${membershipUuid}/membership-id`, { membership_id }),
  replaceAadhar: (userId, aadhar_data) =>
    apiClient.put(`/admin/users/${userId}/aadhar`, { aadhar_data }),
  syncPayment: (userId) => apiClient.post(`/admin/users/${userId}/sync-payment`),
  updateUser: (userId, data) => apiClient.put(`/admin/users/${userId}`, data),
}

// ─── Settings ─────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data),
}
