// client/src/api.js

const API_URL = (typeof window !== 'undefined' && window.GameConfig?.API_URL)
  ? window.GameConfig.API_URL
  : 'https://chimarena.cloud/api';

// --- stockage token accès (localStorage) ---
const TOKEN_KEY = 'chimarena_token';
export const getToken  = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// --- helpers fetch ---
function withAuthHeaders(init = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers, credentials: 'include' }; // include -> cookie refresh
}

async function doFetch(url, init) {
  const res = await fetch(url, init);
  let data = null;
  try { data = await res.json(); } catch { /* page statique, etc. */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// Tente un refresh auto si 401/403 liés au token puis rejoue 1 fois
export async function apiFetch(path, init = {}, retried = false) {
  try {
    return await doFetch(`${API_URL}${path}`, withAuthHeaders(init));
  } catch (err) {
    const msg = (err?.body?.message || '').toLowerCase();
    const needRefresh = (err.status === 401 || err.status === 403) &&
      (msg.includes('token') || msg.includes('auth'));
    if (!retried && needRefresh) {
      await refresh(); // lève si échec
      return doFetch(`${API_URL}${path}`, withAuthHeaders(init)); // rejoue 1 fois
    }
    throw err;
  }
}

// --- endpoints auth ---
export async function register({ username, email, password }) {
  const data = await doFetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, email, password })
  });
  if (data?.token) saveToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await doFetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  if (data?.token) saveToken(data.token);
  return data;
}

export async function getMe() {
  return apiFetch('/auth/me', { method: 'GET' });
}

export async function refresh() {
  const data = await doFetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include'
  });
  if (data?.token) {
    saveToken(data.token);
    return data.token;
  }
  throw new Error('Refresh échoué');
}

export async function logout() {
  try {
    await doFetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } finally {
    clearToken();
  }
}
