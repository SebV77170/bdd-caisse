const DEFAULT_API_PORT = '3001';

export function getApiBase() {
  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE.replace(/\/$/, '');
  }

  const { protocol, hostname, port } = window.location;
  if (port === DEFAULT_API_PORT) {
    return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
  }

  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}

export const API_BASE = getApiBase();

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
