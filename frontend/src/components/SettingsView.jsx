import React, { useState, useEffect } from 'react';
import {
  User, DollarSign, Target, Globe, Lock, Mail,
  CheckCircle, AlertCircle, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { authAPI } from '../api/client';

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, subtitle, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
      <div className="p-2 bg-blue-50 rounded-xl">
        <Icon size={18} className="text-blue-600" />
      </div>
      <div>
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ── Field ─────────────────────────────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type }) => {
  if (!msg) return null;
  const ok = type === 'success';
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white animate-fade-in ${
      ok ? 'bg-green-500' : 'bg-red-500'
    }`}>
      {ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function SettingsView({ user, onUpdate }) {
  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    full_name:           user?.full_name            || '',
    monthly_income:      user?.monthly_income        || '',
    target_savings_goal: user?.target_savings_goal   || '',
    currency:            user?.currency              || 'BDT',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Password form ─────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ email: user?.email || '', new_password: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sync when user prop changes (e.g. after update)
  useEffect(() => {
    if (user) {
      setProfile({
        full_name:           user.full_name            || '',
        monthly_income:      user.monthly_income        || '',
        target_savings_goal: user.target_savings_goal   || '',
        currency:            user.currency              || 'BDT',
      });
      setPwd(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user]);

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const res = await authAPI.updateMe({
        full_name:           profile.full_name,
        monthly_income:      parseFloat(profile.monthly_income)      || 0,
        target_savings_goal: parseFloat(profile.target_savings_goal) || 0,
        currency:            profile.currency,
      });
      onUpdate?.(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      showToast('Profile saved successfully!');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save profile.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (pwd.new_password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setPwdLoading(true);
    try {
      await authAPI.forgotPassword({ email: pwd.email, new_password: pwd.new_password });
      setPwd(prev => ({ ...prev, new_password: '', confirm: '' }));
      showToast('Password updated successfully!');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update password.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow';
  const currencies = ['BDT', 'USD', 'EUR', 'GBP', 'PKR'];

  return (
    <>
      <Toast msg={toast?.msg} type={toast?.type} />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your profile, financial preferences, and account security.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Left: Avatar chip ─────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-3xl font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <p className="font-bold text-gray-800">{user?.full_name || 'User'}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email}</p>

            <div className="mt-4 pt-4 border-t border-gray-100 text-left space-y-2">
              {[
                { label: 'Currency',  value: profile.currency },
                { label: 'Income',    value: profile.monthly_income ? `${profile.monthly_income}` : '—' },
                { label: 'Savings Goal', value: profile.target_savings_goal ? `${profile.target_savings_goal}` : '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="font-medium text-gray-700">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-green-600">
              <ShieldCheck size={13} />
              <span>JWT secured account</span>
            </div>
          </div>
        </div>

        {/* ── Right: forms ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Profile & Financial Preferences */}
          <Section
            icon={User}
            title="Profile & Financial Preferences"
            subtitle="Changes apply to dashboard calculations and AI recommendations."
          >
            <form onSubmit={handleProfileSave} className="space-y-4">
              <Field label="Full Name">
                <input
                  type="text"
                  className={inputCls}
                  value={profile.full_name}
                  onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Rahim Khan"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Monthly Income"
                  hint="Used by the AI to compute savings rate and budget targets."
                >
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number" min="0" step="1"
                      className={`${inputCls} pl-9`}
                      value={profile.monthly_income}
                      onChange={e => setProfile(p => ({ ...p, monthly_income: e.target.value }))}
                      placeholder="e.g. 50000"
                    />
                  </div>
                </Field>

                <Field
                  label="Savings Goal"
                  hint="Track progress toward a monthly savings target."
                >
                  <div className="relative">
                    <Target size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number" min="0" step="1"
                      className={`${inputCls} pl-9`}
                      value={profile.target_savings_goal}
                      onChange={e => setProfile(p => ({ ...p, target_savings_goal: e.target.value }))}
                      placeholder="e.g. 10000"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Preferred Currency" hint="Affects amount formatting across the entire app.">
                <div className="relative">
                  <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    className={`${inputCls} pl-9 bg-white`}
                    value={profile.currency}
                    onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}
                  >
                    {currencies.map(c => (
                      <option key={c} value={c}>
                        {c === 'BDT' ? '৳ BDT — Bangladeshi Taka' :
                         c === 'USD' ? '$ USD — US Dollar' :
                         c === 'EUR' ? '€ EUR — Euro' :
                         c === 'GBP' ? '£ GBP — British Pound' :
                         '₨ PKR — Pakistani Rupee'}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-all"
                >
                  {profileLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                    : 'Save Profile'}
                </button>
              </div>
            </form>
          </Section>

          {/* Account Security */}
          <Section
            icon={Lock}
            title="Account Security"
            subtitle="Change your login password. You'll need your registered email address."
          >
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <Field label="Email Address">
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    readOnly
                    className={`${inputCls} pl-9 bg-gray-50 cursor-not-allowed text-gray-500`}
                    value={pwd.email}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="New Password" hint="Minimum 6 characters.">
                  <input
                    type="password"
                    className={inputCls}
                    value={pwd.new_password}
                    onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </Field>

                <Field label="Confirm New Password">
                  <input
                    type="password"
                    className={`${inputCls} ${
                      pwd.confirm && pwd.confirm !== pwd.new_password
                        ? 'border-red-300 focus:ring-red-400'
                        : ''
                    }`}
                    value={pwd.confirm}
                    onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="••••••••"
                  />
                  {pwd.confirm && pwd.confirm !== pwd.new_password && (
                    <p className="text-red-500 text-xs mt-1">Passwords don't match</p>
                  )}
                </Field>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={pwdLoading || (pwd.confirm && pwd.confirm !== pwd.new_password)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-all"
                >
                  {pwdLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Updating…</>
                    : 'Update Password'}
                </button>
              </div>
            </form>
          </Section>

          {/* App info */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Money Manager AI</p>
              <p className="text-xs text-gray-400 mt-0.5">
                FYDP · FastAPI + React + ML · v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0'}
                {typeof __BUILD_DATE__ !== 'undefined' ? ` (${__BUILD_DATE__})` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
