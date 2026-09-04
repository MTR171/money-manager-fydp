import React, { useState, useEffect, useCallback } from 'react';
import {
  LogIn, UserPlus, LogOut, Plus, Settings, LayoutDashboard,
  List, RefreshCw, Search, X, Save,
  TrendingUp, DollarSign, Menu, Bell,
  Target, PiggyBank, Receipt, BarChart3, Wallet
} from 'lucide-react';
import { authAPI, transactionsAPI, analyticsAPI } from './api/client';
import DashboardCards from './components/DashboardCards';
import ExpenseCharts from './components/ExpenseCharts';
import TransactionModal from './components/TransactionModal';
import AIRecommendations from './components/AIRecommendations';
import InstallBanner from './components/InstallBanner';
import OfflineBar from './components/OfflineBar';
import GoalsView from './components/GoalsView';
import BudgetsView from './components/BudgetsView';
import BillsView from './components/BillsView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import Sidebar, { NAV_ITEMS } from './components/Sidebar';
import VerifyEmailView from './components/VerifyEmailView';

// ── Password Validation Utilities ──────────────────────────────────────────────
export const PASSWORD_CRITERIA = [
  { id: 'length',  label: 'At least 8 characters',                    test: (pw) => (pw || '').length >= 8 },
  { id: 'upper',   label: 'At least 1 uppercase letter (A-Z)',        test: (pw) => /[A-Z]/.test(pw || '') },
  { id: 'lower',   label: 'At least 1 lowercase letter (a-z)',        test: (pw) => /[a-z]/.test(pw || '') },
  { id: 'number',  label: 'At least 1 number (0-9)',                 test: (pw) => /[0-9]/.test(pw || '') },
  { id: 'special', label: 'At least 1 special character (@$!%*?&#)', test: (pw) => /[@$!%*?&#]/.test(pw || '') },
];

export const checkPasswordValid = (pw) => {
  return PASSWORD_CRITERIA.every(criterion => criterion.test(pw || ''));
};

const PasswordCriteriaList = ({ password }) => {
  const metCount = PASSWORD_CRITERIA.filter(c => c.test(password || '')).length;
  const isAllValid = metCount === PASSWORD_CRITERIA.length;

  return (
    <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
      <div className="flex items-center justify-between font-semibold text-slate-700 mb-1">
        <span>Password Requirements:</span>
        <span className={`text-[11px] ${isAllValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
          {metCount} / 5 met
        </span>
      </div>
      {PASSWORD_CRITERIA.map((criterion) => {
        const met = criterion.test(password || '');
        return (
          <div key={criterion.id} className="flex items-center gap-2">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                met ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {met ? '✓' : '•'}
            </span>
            <span className={`transition-colors ${met ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
              {criterion.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Forgot Password Modal ─────────────────────────────────────────────────────
const ForgotPasswordModal = ({ onClose }) => {
  const [step, setStep]       = useState('form');   // 'form' | 'success'
  const [form, setForm]       = useState({ email: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const isPasswordValid = checkPasswordValid(form.new_password);
  const passwordsMatch = form.confirm === form.new_password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Password must meet all 5 security criteria.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword({ email: form.email, new_password: form.new_password });
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-base">Reset Password</p>
            <p className="text-blue-200 text-xs mt-0.5">
              {step === 'form' ? 'Enter your email and choose a strong password' : 'All done!'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="px-6 py-6">
          {step === 'success' ? (
            /* ── Success state ─────────────────────────────────────────── */
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-gray-900 font-bold text-lg mb-1">Password Updated!</h3>
              <p className="text-gray-500 text-sm mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            /* ── Form state ────────────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Registered Email
                </label>
                <input
                  type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="you@example.com" required autoComplete="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <input
                  type="password" name="new_password" value={form.new_password} onChange={handleChange}
                  placeholder="Enter a strong password" required autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <PasswordCriteriaList password={form.new_password} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password" name="confirm" value={form.confirm} onChange={handleChange}
                  placeholder="Re-enter new password" required autoComplete="new-password"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    form.confirm && form.confirm !== form.new_password
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200'
                  }`}
                />
                {form.confirm && form.confirm !== form.new_password && (
                  <p className="text-red-500 text-xs mt-1">Passwords don't match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid || (form.confirm && !passwordsMatch)}
                className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all ${
                  loading || !isPasswordValid || (form.confirm && !passwordsMatch)
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-[0.98]'
                }`}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Auth Page ─────────────────────────────────────────────────────────────────
const AuthPage = ({ onLogin }) => {
  const [mode, setMode]                           = useState('login');
  const [form, setForm]                           = useState({ email: '', password: '', full_name: '' });
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState('');
  const [showForgot, setShowForgot]               = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(null);
  const [unverifiedEmail, setUnverifiedEmail]     = useState(null);
  const [resending, setResending]                 = useState(false);
  const [resendStatus, setResendStatus]           = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setUnverifiedEmail(null);
    setResendStatus('');
  };

  const isPasswordValid = checkPasswordValid(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail(null);
    setResendStatus('');

    if (mode === 'register' && !isPasswordValid) {
      setError('Password must meet all 5 requirements before creating an account.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authAPI.login({ email: form.email, password: form.password });
        const { access_token, user } = res.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('user', JSON.stringify(user));
        onLogin(user);
      } else {
        const res = await authAPI.register({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
        });
        setRegisteredSuccess({
          email: form.email,
          message: res.data?.message || 'Registration successful! Please check your email to verify your account.',
          verification_link: res.data?.verification_link,
        });
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 403 || (detail && detail.toLowerCase().includes('verify your email'))) {
        setUnverifiedEmail(form.email);
        setError(detail || 'Please verify your email address to log in.');
      } else {
        setError(detail || `${mode === 'login' ? 'Login' : 'Registration'} failed. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendFromAuth = async () => {
    const targetEmail = unverifiedEmail || registeredSuccess?.email || form.email;
    if (!targetEmail) return;
    setResending(true);
    setResendStatus('');
    try {
      const res = await authAPI.resendVerification(targetEmail);
      setResendStatus(res.data?.message || 'Verification link sent! Please check your inbox.');
    } catch (err) {
      setResendStatus(err.response?.data?.detail || 'Failed to resend verification email.');
    } finally {
      setResending(false);
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
          {/* If registered successfully, show Verify Notice */}
          {registeredSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner text-3xl">
                ✉️
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Check Your Email</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We've sent an activation link to <br />
                <span className="font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs mt-1 inline-block">
                  {registeredSuccess.email}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Click the verification link in your email to activate your account and start managing your finances.
              </p>

              {resendStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs">
                  {resendStatus}
                </div>
              )}

              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredSuccess(null);
                    setMode('login');
                    setError('');
                  }}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all text-sm shadow-md"
                >
                  Proceed to Sign In
                </button>

                <button
                  type="button"
                  onClick={handleResendFromAuth}
                  disabled={resending}
                  className="w-full py-2.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {resending ? 'Sending verification link…' : "Didn't receive email? Resend"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                {['login', 'register'].map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError('');
                      setUnverifiedEmail(null);
                      setResendStatus('');
                      setForm(prev => ({ ...prev, password: '' }));
                    }}
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
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm space-y-2">
                    <p>{error}</p>
                    {unverifiedEmail && (
                      <div className="pt-1 border-t border-red-200/60">
                        <button
                          type="button"
                          onClick={handleResendFromAuth}
                          disabled={resending}
                          className="text-xs font-bold text-red-800 underline hover:text-red-900"
                        >
                          {resending ? 'Sending...' : 'Click here to resend verification email'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {resendStatus && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs">
                    {resendStatus}
                  </div>
                )}

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input
                      type="text" name="full_name" value={form.full_name} onChange={handleChange}
                      placeholder="John Doe" required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    placeholder="you@example.com" required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  {/* Password label row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password" name="password" value={form.password} onChange={handleChange}
                    placeholder="••••••••" required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />

                  {/* Real-time criteria checklist for registration */}
                  {mode === 'register' && (
                    <PasswordCriteriaList password={form.password} />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || (mode === 'register' && !isPasswordValid)}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all text-sm ${
                    loading || (mode === 'register' && !isPasswordValid)
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-[0.98]'
                  }`}
                >
                  {loading
                    ? 'Please wait...'
                    : mode === 'login'
                    ? '→ Sign In'
                    : '→ Create Account'}
                </button>
              </form>

              {mode === 'login' && (
                <p className="text-center text-xs text-gray-400 mt-4">
                  Demo: register a new account or sign in to get started
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
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
  const [isVerifying, setIsVerifying] = useState(() => {
    return (
      window.location.pathname === '/verify-email' ||
      window.location.search.includes('token=')
    );
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

  if (isVerifying) {
    return (
      <VerifyEmailView
        onProceedToLogin={() => {
          window.history.replaceState({}, document.title, '/');
          setIsVerifying(false);
        }}
      />
    );
  }

  if (!user) return <AuthPage onLogin={handleLogin} />;

  const navItems = NAV_ITEMS;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Component */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu size={20} className="text-gray-600" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {navItems.find(n => n.id === activeView)?.label || 'Dashboard'}
              </h2>
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

          {activeView === 'budgets' && (
            <BudgetsView currency={user.currency || 'BDT'} />
          )}

          {activeView === 'goals' && (
            <GoalsView
              currency={user.currency || 'BDT'}
              onGoalDeposit={() => {
                fetchDashboard();
                fetchTransactions();
                fetchRecommendations();
                showNotification('Goal funded! Deducted from Net Balance.');
              }}
              onSync={() => {
                fetchDashboard();
                fetchTransactions();
                fetchRecommendations();
              }}
            />
          )}

          {activeView === 'bills' && (
            <BillsView
              currency={user.currency || 'BDT'}
              onBillPaid={() => {
                fetchDashboard();
                fetchTransactions();
                fetchRecommendations();
                showNotification('Bill status updated! Net Balance & expenses synchronized.');
              }}
              onSync={() => {
                fetchDashboard();
                fetchTransactions();
                fetchRecommendations();
              }}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView currency={user.currency || 'BDT'} />
          )}

          {activeView === 'settings' && (
            <SettingsView
              user={user}
              onUpdate={(updated) => { setUser(updated); }}
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
