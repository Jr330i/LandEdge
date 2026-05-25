/** Empty in dev → relative `/api/v1/...` (Vite proxy). Set `VITE_API_URL` in production. */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') ?? ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}
