import React, { useState, useEffect } from 'react';
import {
  User, Target, Globe, Lock, Mail, Bell, Database, Download,
  Trash2, AlertTriangle, CheckCircle, AlertCircle, RefreshCw,
  ShieldCheck, Cloud, X
} from 'lucide-react';
import { authAPI, transactionsAPI, budgetsAPI, goalsAPI, billsAPI } from '../api/client';
import { getQueue, clearQueue } from '../services/offlineSyncService';
import { useNotifications } from '../context/NotificationContext';

const CURRENCY_SYMBOLS = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
  GBP: '£',
  PKR: '₨',
};

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, subtitle, children, iconBg = 'bg-blue-50 dark:bg-blue-950/60', iconColor = 'text-blue-600 dark:text-blue-400' }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-slate-700">
      <div className={`p-2 rounded-xl ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ── Field ─────────────────────────────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">{hint}</p>}
  </div>
);

// ── Toggle Row ────────────────────────────────────────────────────────────────
const ToggleRow = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-slate-700/60 last:border-b-0 last:pb-0 first:pt-0">
    <div>
      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{title}</p>
      <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
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
export default function SettingsView({ user, onUpdate, onForceSync, onDataReset }) {
  const notifCtx = useNotifications();

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    full_name:           (user && user.full_name)            || '',
    monthly_income:      (user && user.monthly_income)       || '',
    target_savings_goal: (user && user.target_savings_goal)  || '',
    currency:            (user && user.currency)             || 'BDT',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Password form ─────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ email: (user && user.email) || '', new_password: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Alert Preferences ─────────────────────────────────────────────────────
  const [localAlertPrefs, setLocalAlertPrefs] = useState(() => {
    if (notifCtx && notifCtx.alertPrefs) return notifCtx.alertPrefs;
    try {
      const saved = JSON.parse(localStorage.getItem('mm_alert_prefs') || '{}');
      return {
        budgetAlerts:   saved.budgetAlerts   !== false,
        billReminders:  saved.billReminders  !== false,
        velocityAlerts: saved.velocityAlerts !== false,
      };
    } catch {
      return { budgetAlerts: true, billReminders: true, velocityAlerts: true };
    }
  });

  // ── Offline Sync & Data Management States ─────────────────────────────────
  const [queueCount, setQueueCount] = useState(() => getQueue().length);
  const [syncingNow, setSyncingNow] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resettingData, setResettingData] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  useEffect(() => {
    if (notifCtx && notifCtx.alertPrefs) {
      setLocalAlertPrefs(notifCtx.alertPrefs);
    }
  }, [notifCtx]);

  const handleTogglePref = (key, val) => {
    const next = { ...localAlertPrefs, [key]: val };
    setLocalAlertPrefs(next);
    localStorage.setItem('mm_alert_prefs', JSON.stringify(next));
    if (notifCtx && notifCtx.updateAlertPrefs) {
      notifCtx.updateAlertPrefs({ [key]: val });
    }
    showToast('Alert preferences updated!');
  };

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
      if (onUpdate) onUpdate(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      showToast('Profile saved successfully!');
    } catch (err) {
      const detail = err && err.response && err.response.data && err.response.data.detail;
      showToast(detail || 'Failed to save profile.', 'error');
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
      const detail = err && err.response && err.response.data && err.response.data.detail;
      showToast(detail || 'Failed to update password.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  // ── Force Cloud Sync ──────────────────────────────────────────────────────
  const handleForceCloudSync = async () => {
    setSyncingNow(true);
    try {
      if (onForceSync) {
        await onForceSync();
      }
      setQueueCount(getQueue().length);
      showToast('Cloud synchronization completed!');
    } catch {
      showToast('Unable to sync right now.', 'error');
    } finally {
      setSyncingNow(false);
    }
  };

  // ── Export Full Backup (JSON) ─────────────────────────────────────────────
  const handleExportFullBackup = async () => {
    setExportingBackup(true);
    try {
      const [txRes, budRes, goalRes, billRes] = await Promise.allSettled([
        transactionsAPI.list({ limit: 1000 }),
        budgetsAPI.list(),
        goalsAPI.list(),
        billsAPI.list(),
      ]);

      const backupPayload = {
        app: 'Money Manager AI',
        version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.6',
        exported_at: new Date().toISOString(),
        user_profile: {
          full_name: profile.full_name,
          email: (user && user.email) || '',
          currency: profile.currency,
          monthly_income: Number(profile.monthly_income || 0),
          target_savings_goal: Number(profile.target_savings_goal || 0),
        },
        data: {
          transactions: txRes.status === 'fulfilled' && txRes.value ? txRes.value.data : [],
          budgets:      budRes.status === 'fulfilled' && budRes.value ? budRes.value.data : [],
          goals:        goalRes.status === 'fulfilled' && goalRes.value ? goalRes.value.data : [],
          bills:        billRes.status === 'fulfilled' && billRes.value ? billRes.value.data : [],
          offline_queue: getQueue(),
        },
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `money_manager_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Full JSON backup downloaded!');
    } catch {
      showToast('Failed to export backup.', 'error');
    } finally {
      setExportingBackup(false);
    }
  };

  // ── Reset Account Data ────────────────────────────────────────────────────
  const handleConfirmResetData = async () => {
    setResettingData(true);
    try {
      const [txRes, budRes, goalRes, billRes] = await Promise.allSettled([
        transactionsAPI.list({ limit: 1000 }),
        budgetsAPI.list(),
        goalsAPI.list(),
        billsAPI.list(),
      ]);

      const txs = (txRes.status === 'fulfilled' && txRes.value && txRes.value.data) || [];
      const buds = (budRes.status === 'fulfilled' && budRes.value && budRes.value.data) || [];
      const goals = (goalRes.status === 'fulfilled' && goalRes.value && goalRes.value.data) || [];
      const bills = (billRes.status === 'fulfilled' && billRes.value && billRes.value.data) || [];

      await Promise.allSettled([
        ...txs.map(t => transactionsAPI.delete(t.id)),
        ...buds.map(b => budgetsAPI.delete(b.id)),
        ...goals.map(g => goalsAPI.delete(g.id)),
        ...bills.map(bl => billsAPI.delete(bl.id)),
      ]);

      clearQueue();
      setQueueCount(0);
      setShowResetModal(false);
      setResetConfirmText('');
      if (onDataReset) onDataReset();
      showToast('All account data has been reset!');
    } catch {
      showToast('Error while resetting account data.', 'error');
    } finally {
      setResettingData(false);
    }
  };

  const activeCurrencySymbol = CURRENCY_SYMBOLS[profile.currency] || '৳';
  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow dark:bg-slate-900 dark:text-slate-100';
  const currencies = ['BDT', 'USD', 'EUR', 'GBP', 'PKR'];

  return (
    <>
      <Toast msg={toast && toast.msg} type={toast && toast.type} />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-gray-400 dark:text-slate-400 mt-0.5">
          Manage your profile, financial preferences, smart alert rules, and data backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Left Column: Avatar Card & Offline Sync Status Widget ───────── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-3xl font-bold">
                {((user && user.full_name && user.full_name[0]) || 'U').toUpperCase()}
              </span>
            </div>
            <p className="font-bold text-gray-800 dark:text-slate-100">{(user && user.full_name) || 'User'}</p>
            <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5 truncate">{user && user.email}</p>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 text-left space-y-2">
              {[
                { label: 'Currency',     value: `${activeCurrencySymbol} (${profile.currency})` },
                { label: 'Income',       value: profile.monthly_income ? `${activeCurrencySymbol}${Number(profile.monthly_income).toLocaleString()}` : '—' },
                { label: 'Savings Goal', value: profile.target_savings_goal ? `${activeCurrencySymbol}${Number(profile.target_savings_goal).toLocaleString()}` : '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-gray-400 dark:text-slate-400">{row.label}</span>
                  <span className="font-medium text-gray-700 dark:text-slate-200">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-center gap-1.5 text-xs text-green-600 dark:text-emerald-400">
              <ShieldCheck size={13} />
              <span>JWT secured account</span>
            </div>
          </div>

          {/* ── Offline Sync Status Widget ─────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl">
                  <Cloud size={17} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-slate-100 text-sm">Offline Sync Status</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-400">Local cache &amp; cloud queue</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                navigator.onLine
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${navigator.onLine ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {navigator.onLine ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700 mb-3 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Offline Queue:</span>
              <span className="text-xs font-bold text-gray-800 dark:text-slate-100">
                {queueCount} pending action{queueCount === 1 ? '' : 's'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleForceCloudSync}
              disabled={syncingNow || !navigator.onLine}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 hover:text-blue-600 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncingNow ? 'animate-spin text-blue-600' : ''} />
              {syncingNow ? 'Syncing with Cloud…' : 'Force Cloud Sync'}
            </button>
          </div>
        </div>

        {/* ── Right Column: Settings Sections ────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Profile & Financial Preferences */}
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
                  label={`Monthly Income (${activeCurrencySymbol})`}
                  hint="Used by the AI to compute savings rate and budget targets."
                >
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 text-sm font-bold select-none">
                      {activeCurrencySymbol}
                    </span>
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
                  label={`Savings Goal (${activeCurrencySymbol})`}
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

              <Field label="Preferred Currency" hint="Dynamically updates currency icons and formatting across the entire app.">
                <div className="relative">
                  <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    className={`${inputCls} pl-9 bg-white dark:bg-slate-900`}
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

          {/* 2. Notification & Alert Preferences */}
          <Section
            icon={Bell}
            title="Alert Preferences"
            subtitle="Customize which smart financial triggers appear in your Notification Center and toast pop-ups."
            iconBg="bg-purple-50 dark:bg-purple-950/60"
            iconColor="text-purple-600 dark:text-purple-400"
          >
            <div className="space-y-1">
              <ToggleRow
                title="Budget 80% / 100% Threshold Alerts"
                description="Trigger warnings when a category reaches 80% of its monthly budget and critical alerts at 100%."
                checked={localAlertPrefs.budgetAlerts}
                onChange={(val) => handleTogglePref('budgetAlerts', val)}
              />
              <ToggleRow
                title="Upcoming Bill Reminders (3-Day Alert)"
                description="Receive reminders for unpaid bills due within the next 3 days and overdue bill warnings."
                checked={localAlertPrefs.billReminders}
                onChange={(val) => handleTogglePref('billReminders', val)}
              />
              <ToggleRow
                title="AI High Spending Velocity Warnings"
                description="Notify when AI spending velocity predicts a month-end budget deficit against your income."
                checked={localAlertPrefs.velocityAlerts}
                onChange={(val) => handleTogglePref('velocityAlerts', val)}
              />
            </div>
          </Section>

          {/* 3. Data Management & Privacy */}
          <Section
            icon={Database}
            title="Data Management & Privacy"
            subtitle="Export a portable JSON backup of your financial records or reset your account."
            iconBg="bg-emerald-50 dark:bg-emerald-950/60"
            iconColor="text-emerald-600 dark:text-emerald-400"
          >
            <div className="space-y-4">
              {/* Export Backup Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Export Full Backup (JSON)</p>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    Downloads a complete JSON dump of your transactions, budgets, saving goals, and bills.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  disabled={exportingBackup}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  <Download size={14} />
                  {exportingBackup ? 'Preparing Backup…' : 'Export Full Backup (JSON)'}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-50/60 dark:bg-red-950/25 border border-red-200 dark:border-red-800/70">
                <div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">Danger Zone — Reset Account Data</p>
                  </div>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                    Permanently wipe all transactions, budgets, goals, and bills to start fresh.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setResetConfirmText(''); setShowResetModal(true); }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  <Trash2 size={14} /> Reset Account Data
                </button>
              </div>
            </div>
          </Section>

          {/* 4. Account Security */}
          <Section
            icon={Lock}
            title="Account Security"
            subtitle="Change your login password. You'll need your registered email address."
            iconBg="bg-orange-50 dark:bg-orange-950/60"
            iconColor="text-orange-600 dark:text-orange-400"
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
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl border border-blue-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-100">Money Manager AI</p>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                FYDP · FastAPI + React + ML · v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.4'} • Stable
                {typeof __BUILD_DATE__ !== 'undefined' ? ` (${__BUILD_DATE__})` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </div>

      {/* ── Strict Confirmation Modal for Reset Account Data ─────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowResetModal(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-red-200 dark:border-red-800/70 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 dark:bg-red-950/70 rounded-xl">
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-base font-bold text-gray-800 dark:text-slate-100">Reset Account Data?</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
              This action will permanently delete all your <strong>transactions, budgets, saving goals, and recurring bills</strong>. Your account login and profile settings will be preserved.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Type <span className="font-mono text-red-600 dark:text-red-400">RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder="Type RESET"
                className={inputCls}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET' || resettingData}
                onClick={handleConfirmResetData}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {resettingData ? 'Wiping Data…' : 'Wipe All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
