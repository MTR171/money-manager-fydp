import axios from 'axios';

// ── Backend URL resolution ────────────────────────────────────────────────────
//
// Priority chain:
//   1. VITE_API_URL in .env  (auto-written by tunnel_runner.py with the
//      Ngrok public URL before Vite starts — so this is always correct)
//   2. Same-origin (empty string) — works when backend is proxied via Vite
//      dev-server (localhost-only development without Ngrok)
//   3. http://localhost:8000 — last-resort hard fallback
//
// When running via tunnel_runner.py:
//   VITE_API_URL = https://xxxx-xx-xx-xxx-xx.ngrok-free.app
//   The mobile browser hits this URL directly — no proxy involved.
//
// When running locally (npm run dev without tunnel_runner):
//   VITE_API_URL is unset → falls through to '' → Vite proxy handles /api/*
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||   // set by tunnel_runner.py
  'http://localhost:8000';           // local fallback

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Bypass Ngrok's browser-interstitial page on free tunnels.
    // This header is whitelisted by the CORS config in main.py.
    'ngrok-skip-browser-warning': '1',
  },
  timeout: 15000, // 15 s — Ngrok free tunnels can be slow on first request
});

// ── Request interceptor: attach JWT Bearer token ──────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: handle 401 globally ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => apiClient.post('/api/auth/register', data),
  login:    (data) => apiClient.post('/api/auth/login', data),
  getMe:    ()     => apiClient.get('/api/auth/me'),
  updateMe: (data) => apiClient.put('/api/auth/me', data),
};

// ── Transactions API ──────────────────────────────────────────────────────────
export const transactionsAPI = {
  create:            (data)         => apiClient.post('/api/transactions/', data),
  list:              (params)       => apiClient.get('/api/transactions/', { params }),
  get:               (id)           => apiClient.get(`/api/transactions/${id}`),
  update:            (id, data)     => apiClient.put(`/api/transactions/${id}`, data),
  delete:            (id)           => apiClient.delete(`/api/transactions/${id}`),
  monthlySummary:    (year, month)  => apiClient.get('/api/transactions/summary/monthly', { params: { year, month } }),
  categoryBreakdown: (year, month)  => apiClient.get('/api/transactions/summary/category-breakdown', { params: { year, month } }),
  weeklySummary:     (week_start)   => apiClient.get('/api/transactions/summary/weekly', { params: { week_start } }),
};

// ── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getRecommendations: ()     => apiClient.get('/api/analytics/recommendations'),
  predictRisk:        (data) => apiClient.post('/api/analytics/predict-risk', data),
  getDashboard:       ()     => apiClient.get('/api/analytics/dashboard-summary'),
};

export default apiClient;
