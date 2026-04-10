import type { ExposedUser } from '../shared/user-api'

const KEY = 'itsshops_user'

export function setLocalUser(user: ExposedUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
    window.dispatchEvent(new CustomEvent('user:change', { detail: user }))
  } catch {}
}

export function getLocalUser(): ExposedUser | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ExposedUser) : null
  } catch {
    return null
  }
}

export function deleteLocalUser(): void {
  try {
    localStorage.removeItem(KEY)
    window.dispatchEvent(new CustomEvent('user:change', { detail: null }))
  } catch {}
}
