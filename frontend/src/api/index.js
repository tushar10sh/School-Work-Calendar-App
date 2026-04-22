import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear auth and reload to show login screen
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('child')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (child_id, pin) => api.post('/auth/login', { child_id, pin }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
}

export const childrenApi = {
  list: () => api.get('/children').then((r) => r.data),
  create: (data) => api.post('/children', data).then((r) => r.data),
  update: (id, data) => api.patch(`/children/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/children/${id}`),
}

export const plannerApi = {
  parse: (message, replace = true) =>
    api.post(`/planner/parse?replace=${replace}`, { message }).then((r) => r.data),
  getByDate: (date) => api.get(`/planner/${date}`).then((r) => r.data),
  getRange: (start, end) =>
    api.get('/planner/range', { params: { start, end } }).then((r) => r.data),
  toggleComplete: (id) => api.patch(`/planner/${id}/complete`).then((r) => r.data),
  deleteEntry: (id) => api.delete(`/planner/${id}`),
}

export const eventsApi = {
  list: (params = {}) => api.get('/events', { params }).then((r) => r.data),
  create: (data) => api.post('/events', data).then((r) => r.data),
  update: (id, data) => api.patch(`/events/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/events/${id}`),
}

export const todosApi = {
  list: (params = {}) => api.get('/todos', { params }).then((r) => r.data),
  create: (data) => api.post('/todos', data).then((r) => r.data),
  update: (id, data) => api.patch(`/todos/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/todos/${id}`),
}

export const testAlertsApi = {
  list: (params = {}) => api.get('/test-alerts', { params }).then((r) => r.data),
  create: (data) => api.post('/test-alerts', data).then((r) => r.data),
  update: (id, data) => api.patch(`/test-alerts/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/test-alerts/${id}`),
}

export const configApi = {
  get: () => api.get('/config').then((r) => r.data),
}

export const whatsappApi = {
  getStatus: () => api.get('/whatsapp/status').then((r) => r.data),
  getQR: () => api.get('/whatsapp/qr').then((r) => r.data),
  getGroups: () => api.get('/whatsapp/groups').then((r) => r.data),
  connectGroup: (group_id, group_name) =>
    api.post('/whatsapp/connect-group', { group_id, group_name }).then((r) => r.data),
  reconnect: () => api.post('/whatsapp/reconnect').then((r) => r.data),
  disconnect: () => api.post('/whatsapp/disconnect').then((r) => r.data),
}

export const syncApi = {
  trigger: () => api.post('/sync/trigger').then((r) => r.data),
  status: () => api.get('/sync/status').then((r) => r.data),
  purge: () => api.post('/sync/purge').then((r) => r.data),
  streamUrl: () => `/api/sync/stream?token=${localStorage.getItem('token') ?? ''}`,
}

export const correctionsApi = {
  list: () => api.get('/corrections').then((r) => r.data),
}

export const summaryApi = {
  get: (start, end) => api.get('/summary', { params: { start, end } }).then((r) => r.data),
}
