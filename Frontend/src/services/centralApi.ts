// Central API Service with Axios - Production Ready
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  config => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  response => {
    return response
  },
  error => {
    console.error("API Error:", error.response?.data || error.message)

    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response
      switch (status) {
        case 401:
          console.error('Unauthorized - clearing session')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_session')
          // Could redirect to login here
          break
        case 403:
          console.error('Forbidden access')
          break
        case 404:
          console.error('Resource not found')
          break
        case 500:
          console.error('Server error')
          break
        default:
          console.error(`HTTP ${status} error`)
      }
    } else if (error.request) {
      // Network error
      console.error('Network error - check connection')
    } else {
      // Other error
      console.error('Request setup error:', error.message)
    }

    return Promise.reject(error)
  }
)

export default api

// Convenience functions for common endpoints
export const apiEndpoints = {
  // Health checks
  getHealth: () => api.get('/health'),
  getApiTest: () => api.get('/api/test'),

  // AI
  postAI: (prompt: string) => api.post('/ai', { prompt }),

  // User management
  login: (email: string, password: string) => api.post('/api/login', { email, password }),
  signup: (userData: any) => api.post('/api/users', userData),
  getUsers: () => api.get('/api/users'),
  getUserById: (id: string) => api.get(`/api/users/${id}`),
  updateUser: (id: string, data: any) => api.put(`/api/users/${id}`, data),
}
