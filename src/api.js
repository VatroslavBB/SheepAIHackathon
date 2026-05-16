// In dev: VITE_BACKEND_URL is empty → Vite proxy forwards /api/* to localhost:8000
// In prod: set VITE_BACKEND_URL=https://your-app.railway.app in Vercel env vars
export const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

export function backendWsUrl(path) {
  const base = import.meta.env.VITE_BACKEND_URL
  if (base) return base.replace(/^https?/, 'ws') + path
  return `ws://${window.location.hostname}:8000${path}`
}
