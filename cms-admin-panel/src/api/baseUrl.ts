/** База для всех запросов к API без завершающего `/`. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  return (raw == null || raw === '' ? '/api' : raw).replace(/\/$/, '')
}

/**
 * Собрать URL эндпоинта.
 * Пример: `auth/login` при базе `/api` → `/api/auth/login`;
 * при базе `http://localhost:4000/api` → полный URL.
 */
export function apiUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  const base = getApiBaseUrl()

  if (base.startsWith('http://') || base.startsWith('https://')) {
    const prefix = base.endsWith('/') ? base : `${base}/`
    return new URL(normalized, prefix).href
  }

  const root = base.replace(/^\//, '')
  return (
    '/' +
    [...root.split('/').filter(Boolean), ...normalized.split('/').filter(Boolean)].join('/')
  )
}
