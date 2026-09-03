import React, { useState, useEffect, useCallback } from 'react';
import {
  LogIn, UserPlus, LogOut, Plus, Settings, LayoutDashboard,
  List, RefreshCw, Search, Filter, ChevronDown, X, Save,
  TrendingUp, DollarSign, Menu, Bell
} from 'lucide-react';
import { authAPI, transactionsAPI, analyticsAPI } from './api/client';
import DashboardCards from './components/DashboardCards';
import ExpenseCharts from './components/ExpenseCharts';
import TransactionModal from './components/TransactionModal';
import AIRecommendations from './components/AIRecommendations';
import InstallBanner from './components/InstallBanner';
import OfflineBar from './components/OfflineBar';

// --- Auth Pages ---
const AuthPage = ({ onLogin }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let res;
      if (mode === 'login') {
        res = await authAPI.login({ email: form.email, password: form.password });
      } else {
        res = await authAPI.register({ email: form.email, password: form.password, full_name: form.full_name });
      }
      const { access_token, user } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.detail || `${mode === 'login' ? 'Login' : 'Registration'} failed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-sm mb-4">
            <DollarSign size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Money Manager</h1>
          <p className="text-blue-200 mt-1">AI-Powered Finance Tracker</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Tab Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setForm({ email: '', password: '', full_name: '' }); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? '🔑 Sign In' : '✨ Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text" name="full_name" value={form.full_name} onChange={handleChange}
                  placeholder="John Doe" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="••••••••" required minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all text-sm ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-[0.98]'
              }`}
            >
              {loading ? 'Please wait...' : mode === 'login' ? '→ Sign In' : '→ Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Demo: register a new account to get started
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Profile Modal ---
const ProfileModal = ({ isOpen, onClose, user, onUpdate }) => {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    monthly_income: user?.monthly_income || '',
    target_savings_goal: user?.target_savings_goal || '',
    currency: user?.currency || 'USD',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name || '', monthly_income: user.monthly_income || '', target_savings_goal: user.target_savings_goal || '', currency: user.currency || 'USD' });
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.updateMe({
        full_name: form.full_name,
        monthly_income: parseFloat(form.monthly_income) || 0,
        target_savings_goal: parseFloat(form.target_savings_goal) || 0,
        currency: form.currency,
      });
      onUpdate(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Profile & Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Income</label>
            <input type="number" value={form.monthly_income} onChange={e => setForm(p => ({ ...p, monthly_income: e.target.value }))} placeholder="e.g. 3000" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Savings Goal</label>
            <input type="number" value={form.target_savings_goal} onChange={e => setForm(p => ({ ...p, target_savings_goal: e.target.value }))} placeholder="e.g. 600" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {['USD', 'EUR', 'GBP', 'BDT', 'PKR'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
            saved ? 'bg-green-500' : loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
            {saved ? '✓ Saved!' : loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Transaction History ---
const TransactionHistory = ({ transactions, loading, onDelete, currency }) => {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' }[currency] || '$';

  const filtered = transactions.filter(t => {
    const matchSearch = !search || t.note?.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || t.category === filterCat;
    const matchType = !filterType || t.type === filterType;
    return matchSearch && matchCat && matchType;
  });

  const CATEGORIES = ['Food/Dining', 'Housing/Rent', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Other'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Transaction History</h3>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          {(search || filterCat || filterType) && (
            <button onClick={() => { setSearch(''); setFilterCat(''); setFilterType(''); }} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading transactions...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <List size={40} className="mx-auto mb-2 opacity-30" />
            <p>No transactions found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Category', 'Type', 'Amount', 'Note', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{t.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{t.type}</span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{currencySymbol}{Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{t.note || '-'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onDelete(t.id)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors group">
                      <X size={14} className="text-gray-400 group-hover:text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Showing {filtered.length} of {transactions.length} transactions</p>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoadingDashboard(true);
    try {
      const res = await analyticsAPI.getDashboard();
      setDashboardData(res.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTransactions(true);
    try {
      const res = await transactionsAPI.list({ limit: 200 });
      setTransactions(res.data);
    } catch (err) {
      console.error('Transactions fetch error:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, [user]);

  const fetchRecommendations = useCallback(async () => {
    if (!user) return;
    setLoadingRecs(true);
    try {
      const res = await analyticsAPI.getRecommendations();
      setRecommendations(res.data);
    } catch (err) {
      console.error('Recommendations fetch error:', err);
    } finally {
      setLoadingRecs(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboard();
      fetchTransactions();
      fetchRecommendations();
    }
  }, [user, fetchDashboard, fetchTransactions, fetchRecommendations]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    setDashboardData(null);
    setTransactions([]);
    setRecommendations(null);
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await transactionsAPI.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      fetchDashboard();
      fetchRecommendations();
      showNotification('Transaction deleted');
    } catch (err) {
      showNotification('Failed to delete transaction', 'error');
    }
  };

  const handleTransactionSuccess = () => {
    fetchDashboard();
    fetchTransactions();
    fetchRecommendations();
    showNotification('Transaction added successfully!');
  };

  if (!user) return <AuthPage onLogin={handleLogin} />;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: List },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:flex lg:flex-col`}>
        {/* Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-100">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm leading-tight">Money Manager</h1>
            <p className="text-xs text-gray-400">AI Finance Tracker</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{user.full_name?.[0]?.toUpperCase() || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user.full_name || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu size={20} className="text-gray-600" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-800 capitalize">{activeView}</h2>
              <p className="text-xs text-gray-400 hidden sm:block">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchDashboard(); fetchTransactions(); fetchRecommendations(); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh"
            >
              <RefreshCw size={18} className={`text-gray-500 ${loadingDashboard ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Transaction</span>
            </button>
          </div>
        </header>

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${
            notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-auto">
          {activeView === 'dashboard' && (
            <>
              <DashboardCards
                dashboardData={dashboardData}
                currency={user.currency || 'USD'}
              />
              <ExpenseCharts
                categoryBreakdown={dashboardData?.category_breakdown || []}
                weeklyTrend={dashboardData?.weekly_trend || []}
                monthlyIncome={user.monthly_income || dashboardData?.current_month?.total_income || 0}
                currency={user.currency || 'USD'}
              />
              <AIRecommendations
                recommendations={recommendations}
                onRefresh={fetchRecommendations}
                loading={loadingRecs}
              />
            </>
          )}

          {activeView === 'transactions' && (
            <TransactionHistory
              transactions={transactions}
              loading={loadingTransactions}
              onDelete={handleDeleteTransaction}
              currency={user.currency || 'USD'}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSuccess={handleTransactionSuccess}
        currency={user.currency || 'USD'}
      />
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onUpdate={(updated) => { setUser(updated); showNotification('Profile updated!'); }}
      />

      {/* PWA — offline status bar (sticks to top of viewport) */}
      <OfflineBar />

      {/* PWA — install prompt banner (slides up from bottom) */}
      <InstallBanner />
    </div>
  );
}
