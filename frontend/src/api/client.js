import axios from 'axios';

// ── Dynamic Backend URL Resolution (Multi-Device LAN, Mobile & Cloud) ─────────
const resolveApiBaseUrl = () => {
    const envUrl = (
        import.meta.env.VITE_API_URL || '').trim();
    const isLoopbackEnv = !envUrl ||
        envUrl.includes('localhost') ||
        envUrl.includes('127.0.0.1') ||
        envUrl.includes('0.0.0.0');

    // 1. If an explicit non-local cloud/tunnel backend URL is configured, use it
    if (envUrl && !isLoopbackEnv) {
        return envUrl.replace(/\/+$/, '');
    }

    // 2. Dynamically resolve based on current browser hostname
    if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol || 'http:';
        const hostname = window.location.hostname;

        const isLocalOrLan =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
            hostname.endsWith('.local');

        if (isLocalOrLan) {
            // Mobile phone on local Wi-Fi (e.g. http://192.168.x.x:5173 or :3000)
            // targets the host laptop's backend on port 8000 directly
            return `http://${hostname}:8000`;
        }

        // Production / preview cloud domain fallback
        if (
            import.meta.env.VITE_PROD_API_URL) {
            return import.meta.env.VITE_PROD_API_URL.replace(/\/+$/, '');
        }
        if (protocol === 'https:') {
            return window.location.origin;
        }
        return `${protocol}//${hostname}:8000`;
    }

    return '';
};

export const API_BASE_URL = resolveApiBaseUrl();

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
    },
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

// ── Response interceptor: LAN Proxy Fallback, Cold-Start Retry & 401 Handling ─
apiClient.interceptors.response.use(
    (response) => response,
    async(error) => {
        const originalRequest = error.config;
        if (!originalRequest) {
            return Promise.reject(error);
        }

        // 1. Mobile LAN Firewall Fallback: if direct port 8000 is blocked by Windows Firewall,
        //    transparently route through the current origin's /api proxy (e.g. Vite port 5173/3000)
        if (!error.response &&
            !originalRequest._proxyFallback &&
            typeof window !== 'undefined' &&
            window.location &&
            originalRequest.baseURL &&
            originalRequest.baseURL.includes(':8000') &&
            window.location.port !== '8000'
        ) {
            originalRequest._proxyFallback = true;
            originalRequest.baseURL = window.location.origin;
            apiClient.defaults.baseURL = window.location.origin;
            return apiClient(originalRequest);
        }

        // 2. Render Cold-Start Handling: প্রথমবার সার্ভার স্লিপে থাকলে আরেকবার অটো-রিট্রাই করবে
        if (
            (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout')) || !error.response) &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            console.warn('Backend is waking up (cold start)... Retrying request.');
            return apiClient(originalRequest);
        }

        // ২. Expired Token Handling: টোকেন নষ্ট বা এক্সপায়ার হলে সেশন রিসেট করা
        if (error.response && error.response.status === 401) {
            // লগইন বা রেজিস্ট্রেশন ফর্মে থাকা অবস্থায় পেজ রিডাইরেক্ট আটকানো (যাতে ভুল পাসওয়ার্ড দিলে এরর টেক্সট দেখা যায়)
            const isAuthUrl =
                originalRequest.url.includes('/api/auth/login') ||
                originalRequest.url.includes('/api/auth/register') ||
                originalRequest.url.includes('/api/auth/forgot-password') ||
                originalRequest.url.includes('/api/auth/verify-email') ||
                originalRequest.url.includes('/api/auth/quick-verify');

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
    register: (data) => apiClient.post('/api/auth/register', data),
    login: (data) => apiClient.post('/api/auth/login', data),
    verifyEmail: (token) => apiClient.get('/api/auth/verify-email', { params: { token } }),
    quickVerify: (email) => apiClient.get('/api/auth/quick-verify', { params: { email } }),
    resendVerification: (email) => apiClient.post('/api/auth/resend-verification', null, { params: { email } }),
    getMe: () => apiClient.get('/api/auth/me'),
    updateMe: (data) => apiClient.put('/api/auth/me', data),
    forgotPassword: (data) => apiClient.post('/api/auth/forgot-password', data),
};

// ── Transactions API ──────────────────────────────────────────────────────────
export const transactionsAPI = {
    create: (data) => apiClient.post('/api/transactions/', data),
    batchCreate: (items) => apiClient.post('/api/transactions/batch', items),
    list: (params) => apiClient.get('/api/transactions/', { params }),
    get: (id) => apiClient.get(`/api/transactions/${id}`),
    update: (id, data) => apiClient.put(`/api/transactions/${id}`, data),
    delete: (id) => apiClient.delete(`/api/transactions/${id}`),
    monthlySummary: (year, month) => apiClient.get('/api/transactions/summary/monthly', { params: { year, month } }),
    categoryBreakdown: (year, month) => apiClient.get('/api/transactions/summary/category-breakdown', { params: { year, month } }),
    weeklySummary: (week_start) => apiClient.get('/api/transactions/summary/weekly', { params: { week_start } }),
};

// ── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
    getRecommendations: () => apiClient.get('/api/analytics/recommendations'),
    predictRisk: (data) => apiClient.post('/api/analytics/predict-risk', data),
    getDashboard: () => apiClient.get('/api/analytics/dashboard-summary'),
};

export const goalsAPI = {
    list: () => apiClient.get('/api/goals/'),
    create: (data) => apiClient.post('/api/goals/', data),
    update: (id, data) => apiClient.put(`/api/goals/${id}`, data),
    deposit: (id, data) => apiClient.patch(`/api/goals/${id}/deposit`, data),
    delete: (id) => apiClient.delete(`/api/goals/${id}`),
};

export const budgetsAPI = {
    status: (month, year) => apiClient.get('/api/budgets/status', { params: { month, year } }),
    list: () => apiClient.get('/api/budgets/'),
    set: (data) => apiClient.post('/api/budgets/', data),
    delete: (id) => apiClient.delete(`/api/budgets/${id}`),
};

export const billsAPI = {
    list: () => apiClient.get('/api/bills/'),
    create: (data) => apiClient.post('/api/bills/', data),
    update: (id, data) => apiClient.put(`/api/bills/${id}`, data),
    togglePaid: (id) => apiClient.patch(`/api/bills/${id}/toggle-paid`),
    pay: (id) => apiClient.post(`/api/bills/${id}/pay`),
    delete: (id) => apiClient.delete(`/api/bills/${id}`),
};

export default apiClient;