import type { LoginUser } from '../dashboard/types'

export const TOKEN_KEY = 'sofinda_access_token'
export const USER_KEY = 'sofinda_user'

export function loadStoredUser(): LoginUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LoginUser
  } catch {
    return null
  }
}

export function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}
