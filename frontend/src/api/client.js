import axios from 'axios';

// ── Backend URL resolution ────────────────────────────────────────────────────
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 
  'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
  },
  // Render Free Tier স্লিপ থেকে জাগতে ৫০-৬০ সেকেন্ড লাগতে পারে, তাই Timeout ৬০ সেকেন্ড করা হলো
  timeout: 60000, 
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

// ── Response interceptor: handle 401 & Cold-Start Retry globally ─────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ১. Render Cold-Start Handling: প্রথমবার সার্ভার স্লিপে থাকলে আরেকবার অটো-রিট্রাই করবে
    if (
      (error.code === 'ECONNABORTED' || error.message.includes('timeout') || !error.response) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      console.warn('Backend is waking up (cold start)... Retrying request.');
      return apiClient(originalRequest);
    }

    // ২. Expired Token Handling: টোকেন নষ্ট বা এক্সপায়ার হলে সেশন রিসেট করা
    if (error.response?.status === 401) {
      // লগইন বা রেজিস্ট্রেশন ফর্মে থাকা অবস্থায় পেজ রিডাইরেক্ট আটকানো (যাতে ভুল পাসওয়ার্ড দিলে এরর টেক্সট দেখা যায়)
      const isAuthUrl = 
        originalRequest.url.includes('/api/auth/login') ||
        originalRequest.url.includes('/api/auth/register') ||
        originalRequest.url.includes('/api/auth/forgot-password') ||
        originalRequest.url.includes('/api/auth/verify-email');

      if (!isAuthUrl) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  },
);

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  register:           (data)  => apiClient.post('/api/auth/register', data),
  login:              (data)  => apiClient.post('/api/auth/login', data),
  verifyEmail:        (token) => apiClient.get('/api/auth/verify-email', { params: { token } }),
  resendVerification: (email) => apiClient.post('/api/auth/resend-verification', null, { params: { email } }),
  getMe:              ()      => apiClient.get('/api/auth/me'),
  updateMe:           (data)  => apiClient.put('/api/auth/me', data),
  forgotPassword:     (data)  => apiClient.post('/api/auth/forgot-password', data),
};

// ── Transactions API ──────────────────────────────────────────────────────────
export const transactionsAPI = {
  create:             (data)         => apiClient.post('/api/transactions/', data),
  list:               (params)       => apiClient.get('/api/transactions/', { params }),
  get:                (id)           => apiClient.get(`/api/transactions/${id}`),
  update:             (id, data)     => apiClient.put(`/api/transactions/${id}`, data),
  delete:             (id)           => apiClient.delete(`/api/transactions/${id}`),
  monthlySummary:     (year, month)  => apiClient.get('/api/transactions/summary/monthly', { params: { year, month } }),
  categoryBreakdown: (year, month)  => apiClient.get('/api/transactions/summary/category-breakdown', { params: { year, month } }),
  weeklySummary:      (week_start)   => apiClient.get('/api/transactions/summary/weekly', { params: { week_start } }),
};

// ── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getRecommendations: ()     => apiClient.get('/api/analytics/recommendations'),
  predictRisk:        (data) => apiClient.post('/api/analytics/predict-risk', data),
  getDashboard:       ()     => apiClient.get('/api/analytics/dashboard-summary'),
};

export const goalsAPI = {
  list:    ()         => apiClient.get('/api/goals/'),
  create:  (data)     => apiClient.post('/api/goals/', data),
  deposit: (id, data) => apiClient.patch(`/api/goals/${id}/deposit`, data),
  delete:  (id)       => apiClient.delete(`/api/goals/${id}`),
};

export const budgetsAPI = {
  status: (month, year) => apiClient.get('/api/budgets/status', { params: { month, year } }),
  list:   ()            => apiClient.get('/api/budgets/'),
  set:    (data)        => apiClient.post('/api/budgets/', data),
  delete: (id)          => apiClient.delete(`/api/budgets/${id}`),
};

export const billsAPI = {
  list:       ()         => apiClient.get('/api/bills/'),
  create:     (data)     => apiClient.post('/api/bills/', data),
  update:     (id, data) => apiClient.put(`/api/bills/${id}`, data),
  togglePaid: (id)       => apiClient.patch(`/api/bills/${id}/toggle-paid`),
  pay:        (id)       => apiClient.post(`/api/bills/${id}/pay`),
  delete:     (id)       => apiClient.delete(`/api/bills/${id}`),
};

export default apiClient;