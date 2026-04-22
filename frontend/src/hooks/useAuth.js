import { useState, useCallback } from 'react'
import { authApi } from '../api'

function loadFromStorage() {
  try {
    const token = localStorage.getItem('token')
    const child = JSON.parse(localStorage.getItem('child') || 'null')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token')
        localStorage.removeItem('child')
        return { token: null, child: null }
      }
    }
    return { token, child }
  } catch {
    return { token: null, child: null }
  }
}

export function useAuth() {
  const [{ token, child }, setAuth] = useState(loadFromStorage)

  const login = useCallback(async (childId, pin) => {
    const data = await authApi.login(childId, pin)
    localStorage.setItem('token', data.token)
    localStorage.setItem('child', JSON.stringify(data.child))
    setAuth({ token: data.token, child: data.child })
    return data.child
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('child')
    setAuth({ token: null, child: null })
  }, [])

  const updateChild = useCallback((updated) => {
    localStorage.setItem('child', JSON.stringify(updated))
    setAuth((prev) => ({ ...prev, child: updated }))
  }, [])

  return {
    isAuthenticated: !!token && !!child,
    child,
    token,
    login,
    logout,
    updateChild,
  }
}
