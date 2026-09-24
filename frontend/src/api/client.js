import axios from 'axios';
import { isManualOffline, setBackendReachable } from '../services/offlineSyncService';

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
            return `http://${hostname}:8000`;
        }

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

const isLocalHostOrLan =
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.'));

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
    },
    timeout: isLocalHostOrLan ? 6000 : 60000,
});

const getCacheKey = (config) => {
    const url = (config && config.url) || '';
    let paramsStr = '';
    if (config && config.params) {
        try {
            paramsStr = JSON.stringify(config.params);
        } catch {
            paramsStr = '';
        }
    }
    return `mm_http_cache:${url}:${paramsStr}`;
};

const readCachedResponse = (config) => {
    try {
        const raw = localStorage.getItem(getCacheKey(config));
        if (raw !== null) {
            return JSON.parse(raw);
        }
    } catch {
        // ignore cache parse errors
    }
    return undefined;
};

const writeCachedResponse = (config, data) => {
    try {
        localStorage.setItem(getCacheKey(config), JSON.stringify(data));
    } catch {
        // ignore quota errors
    }
};

export const updateCachedTransactions = (updater) => {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('mm_http_cache:/api/transactions/')) {
                const current = JSON.parse(localStorage.getItem(key) || '[]');
                if (Array.isArray(current)) {
                    localStorage.setItem(key, JSON.stringify(updater(current)));
                }
            }
        }
    } catch {
        // ignore storage errors
    }
};

export const updateCachedDashboard = (tx, direction = 1) => {
    try {
        const key = 'mm_http_cache:/api/analytics/dashboard:';
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const dash = JSON.parse(raw);
        if (!dash || !dash.current_month) return null;
        const amt = (Number(tx.amount) || 0) * direction;
        if (tx.type === 'income') {
            dash.current_month.total_income = Math.max(0, (Number(dash.current_month.total_income) || 0) + amt);
        } else {
            dash.current_month.total_expenses = Math.max(0, (Number(dash.current_month.total_expenses) || 0) + amt);
            if (Array.isArray(dash.category_breakdown)) {
                const idx = dash.category_breakdown.findIndex(c => c.category === tx.category);
                if (idx >= 0) {
                    dash.category_breakdown[idx].amount = Math.max(0, (Number(dash.category_breakdown[idx].amount) || 0) + amt);
                } else if (amt > 0) {
                    dash.category_breakdown.push({ category: tx.category, amount: amt, percentage: 0 });
                }
            }
        }
        dash.current_month.net_balance =
            (Number(dash.current_month.total_income) || 0) - (Number(dash.current_month.total_expenses) || 0);
        dash.current_month.transaction_count = Math.max(0, (Number(dash.current_month.transaction_count) || 0) + direction);
        localStorage.setItem(key, JSON.stringify(dash));
        return dash;
    } catch {
        return null;
    }
};


// ── Request interceptor: attach JWT Bearer token & handle manual offline mode ─
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (browserOffline || isManualOffline()) {
            const method = (config.method || 'get').toLowerCase();
            if (method === 'get') {
                const cached = readCachedResponse(config);
                if (cached !== undefined) {
                    config.adapter = async() => ({
                        data: cached,
                        status: 200,
                        statusText: 'OK (Offline Cache)',
                        headers: {},
                        config,
                        _fromOfflineCache: true,
                    });
                    return config;
                }
            }
            config.adapter = async() => {
                const offlineErr = new Error('Offline mode active');
                offlineErr.config = config;
                offlineErr.isOfflineError = true;
                throw offlineErr;
            };
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ── Response interceptor: Cache GETs, LAN Fallback & Offline Resilience ───────
apiClient.interceptors.response.use(
    (response) => {
        if (!response._fromOfflineCache) {
            setBackendReachable(true);
            const method = ((response.config && response.config.method) || 'get').toLowerCase();
            if (method === 'get' && response.status === 200) {
                writeCachedResponse(response.config, response.data);
            }
        }
        return response;
    },
    async(error) => {
        const originalRequest = error.config;
        if (!originalRequest) {
            return Promise.reject(error);
        }

        // Detect Vite dev-proxy 500/502/504 when backend server is stopped/unreachable
        const isProxyDownError =
            error.response &&
            (error.response.status === 502 ||
                error.response.status === 503 ||
                error.response.status === 504 ||
                (error.response.status === 500 &&
                    (!error.response.data || typeof error.response.data === 'string' || !error.response.data.detail)));

        const isNetworkUnreachable = !error.response || error.isOfflineError || isProxyDownError;

        // 1. Mobile LAN Firewall Fallback: only on non-localhost LAN IPs when direct port 8000 is blocked
        if (!error.response &&
            !error.isOfflineError &&
            !originalRequest._proxyFallback &&
            typeof window !== 'undefined' &&
            window.location &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            originalRequest.baseURL &&
            originalRequest.baseURL.includes(':8000') &&
            window.location.port !== '8000'
        ) {
            originalRequest._proxyFallback = true;
            originalRequest.baseURL = window.location.origin;
            return apiClient(originalRequest);
        }

        // 2. Render Cloud Cold-Start Retry (only for cloud URLs when browser is online)
        if (
            isNetworkUnreachable &&
            !error.isOfflineError &&
            !isLocalHostOrLan &&
            typeof navigator !== 'undefined' &&
            navigator.onLine !== false &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            console.warn('Backend is waking up (cold start)... Retrying request.');
            return apiClient(originalRequest);
        }

        // 3. If backend / network is unreachable: mark app as Offline & serve cached GET data
        if (isNetworkUnreachable) {
            setBackendReachable(false);
            error.isOfflineError = true;

            const method = (originalRequest.method || 'get').toLowerCase();
            if (method === 'get') {
                const cached = readCachedResponse(originalRequest);
                if (cached !== undefined) {
                    return {
                        data: cached,
                        status: 200,
                        statusText: 'OK (Offline Cache)',
                        headers: {},
                        config: originalRequest,
                        _fromOfflineCache: true,
                    };
                }
            }
        }

        // 4. Expired Token Handling (only when online and 401 from backend)
        if (error.response && error.response.status === 401) {
            const urlStr = originalRequest.url || '';
            const isAuthUrl =
                urlStr.includes('/api/auth/login') ||
                urlStr.includes('/api/auth/register') ||
                urlStr.includes('/api/auth/forgot-password') ||
                urlStr.includes('/api/auth/verify-email') ||
                urlStr.includes('/api/auth/quick-verify');

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