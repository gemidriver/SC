// In development, CRA proxies /api/* to localhost:5000 via package.json "proxy"
// In production, requests go to REACT_APP_API_URL
const BASE = process.env.REACT_APP_API_URL || '';

export function apiFetch(path, options = {}) {
  return fetch(`${BASE}${path}`, { credentials: 'include', ...options });
}
