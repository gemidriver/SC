// In development, CRA proxies /api/* to localhost:5000 via package.json "proxy"
// In production, Vercel rewrites /api/* to the Render backend
export function apiFetch(path, options = {}) {
  return fetch(path, { credentials: 'include', ...options });
}
