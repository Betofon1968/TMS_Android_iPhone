// Talks to the TMS server. The driver app has its own web address, so it signs in with a
// token (kept on the phone) instead of cookies, which phones block between different sites.
const BASE = String(import.meta.env.VITE_TMS_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'tms-driver-token';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || (status === 0 ? 'No connection to the office server.' : `Server error ${status}`));
    this.status = status;
    this.body = body;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the driver signs in again next time.
  }
}

function headers(extra = {}) {
  const token = getToken();
  return { 'x-tms': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'omit',
      headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, null);
  }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
};

// Photos need the sign in token too, so they are downloaded and shown from memory.
export async function fetchFileBlobUrl(fileId) {
  const res = await fetch(`${BASE}/api/files/${encodeURIComponent(fileId)}`, { headers: headers(), credentials: 'omit' });
  if (!res.ok) throw new ApiError(res.status, null);
  return URL.createObjectURL(await res.blob());
}
