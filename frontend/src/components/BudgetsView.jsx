import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Edit2, Plus, TrendingUp, Info, CheckCircle } from 'lucide-react';
import apiClient from '../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (amount, currency = 'BDT') => {
  const symbols = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' };
  const sym = symbols[currency] || '৳';
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// Canonical category list — must match backend exactly
const CATEGORIES = [
  { name: 'Food/Dining',    icon: '🍔' },
  { name: 'Housing/Rent',   icon: '🏠' },
  { name: 'Transport',      icon: '🚗' },
  { name: 'Entertainment',  icon: '🎮' },
  { name: 'Utilities',      icon: '⚡' },
  { name: 'Healthcare',     icon: '💊' },
  { name: 'Shopping',       icon: '🛍' },
  { name: 'Other',          icon: '📦' },
];

const MONTHS = [
  { val: 1, label: 'January' },  { val: 2, label: 'February' }, { val: 3, label: 'March' },
  { val: 4, label: 'April' },    { val: 5, label: 'May' },      { val: 6, label: 'June' },
  { val: 7, label: 'July' },     { val: 8, label: 'August' },   { val: 9, label: 'September' },
  { val: 10, label: 'October' }, { val: 11, label: 'November' },{ val: 12, label: 'December' },
];

const YEARS = [2024, 2025, 2026, 2027];

// ── Progress Bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ pct }) => {
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const width  = Math.min(pct, 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
      <div
        className={`${color} h-2.5 rounded-full transition-all duration-500`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

// ── Month/Year Picker (shared) ────────────────────────────────────────────────
const MonthYearPicker = ({ month, year, onMonth, onYear }) => (
  <div className="flex gap-2">
    <select
      value={month}
      onChange={e => onMonth(Number(e.target.value))}
      className="p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
    >
      {MONTHS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
    </select>
    <select
      value={year}
      onChange={e => onYear(Number(e.target.value))}
      className="p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
    >
      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// Tab 1: My Custom Budgets
// ════════════════════════════════════════════════════════════════════════════
const MyBudgetsTab = ({ currency }) => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [alerts,  setAlerts]  = useState([]);

  // Modal state
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [selectedCat, setSelectedCat]   = useState(null);
  const [limitInput,  setLimitInput]    = useState('');
  const [saving,      setSaving]        = useState(false);
  const [modalError,  setModalError]    = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/budgets/status', { params: { month, year } });
      const data = Array.isArray(res.data) ? res.data : [];
      const budgetMap = {};
      const newAlerts = [];
      data.forEach(item => {
        budgetMap[item.category] = {
          limit:   item.monthly_limit,
          spent:   item.spent,
          status:  item.status,
          pct:     item.percentage,
        };
        if (item.monthly_limit > 0 && item.spent >= item.monthly_limit) {
          newAlerts.push(item.category);
        }
      });
      setBudgets(budgetMap);
      setAlerts(newAlerts);
    } catch (err) {
      console.error('[BudgetsView] fetchStatus error:', err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const openModal = (catName, currentLimit = '') => {
    setSelectedCat(catName);
    setLimitInput(currentLimit > 0 ? String(currentLimit) : '');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSetLimit = async e => {
    e.preventDefault();
    const val = Number(limitInput);
    if (!val || val <= 0) { setModalError('Please enter a valid amount greater than 0.'); return; }
    setSaving(true);
    try {
      await apiClient.post('/api/budgets/', {
        category: selectedCat,
        monthly_limit: val,
        month,
        year,
      });
      setIsModalOpen(false);
      fetchStatus();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to save budget. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Total budget vs total spent across categories with limits set
  const totalLimit = Object.values(budgets).reduce((s, b) => s + (b.limit || 0), 0);
  const totalSpent = Object.values(budgets).reduce((s, b) => s + (b.spent || 0), 0);
  const anyLimitSet = totalLimit > 0;

  return (
    <div className="space-y-5">
      {/* Month/Year selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Set your own spending limits per category. Alerts fire when you hit 80% or 100%.
          </p>
        </div>
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
      </div>

      {/* Summary row */}
      {anyLimitSet && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Budgeted', value: fmt(totalLimit, currency), color: 'text-blue-600' },
            { label: 'Total Spent',    value: fmt(totalSpent, currency), color: totalSpent > totalLimit ? 'text-red-600' : 'text-slate-800' },
            { label: 'Remaining',      value: fmt(Math.max(totalLimit - totalSpent, 0), currency), color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">{s.label}</p>
              <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(cat => (
            <div key={cat} className="flex justify-between items-center bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} />
                <span className="text-sm">
                  <strong>Budget Alert:</strong> {cat} has exceeded its custom limit!
                </span>
              </div>
              <button onClick={() => setAlerts(prev => prev.filter(a => a !== cat))} className="hover:bg-red-100 rounded p-0.5">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map(c => (
            <div key={c.name} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map(cat => {
            const data = budgets[cat.name] || { limit: 0, spent: 0, pct: 0 };
            const hasLimit = data.limit > 0;
            const pct = hasLimit ? Math.min(Math.round((data.spent / data.limit) * 100), 100) : 0;
            const pctColor = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600';

            return (
              <div key={cat.name} className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-semibold text-slate-700 text-sm">{cat.name}</span>
                  </div>
                  <button
                    onClick={() => openModal(cat.name, data.limit)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
                      hasLimit
                        ? 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    {hasLimit ? <><Edit2 size={12} /> Edit</> : <><Plus size={12} /> Set Limit</>}
                  </button>
                </div>

                {hasLimit ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-xl font-bold text-slate-800">{fmt(data.spent, currency)}</span>
                        <span className="text-slate-400 text-xs ml-1">/ {fmt(data.limit, currency)}</span>
                      </div>
                      <span className={`font-bold text-sm ${pctColor}`}>{pct}%</span>
                    </div>
                    <ProgressBar pct={pct} />
                    <p className="text-xs text-slate-400">
                      {pct >= 100
                        ? `⚠️ Over by ${fmt(data.spent - data.limit, currency)}`
                        : `${fmt(Math.max(data.limit - data.spent, 0), currency)} remaining`}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-full bg-slate-50 rounded-lg p-2 text-center">
                      <span className="text-slate-400 text-xs italic">No budget limit set</span>
                      {data.spent > 0 && (
                        <p className="text-slate-600 text-xs mt-0.5">Spent this month: {fmt(data.spent, currency)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Set/Edit Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {budgets[selectedCat]?.limit > 0 ? 'Update' : 'Set'} Budget
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCat} · {MONTHS.find(m => m.val === month)?.label} {year}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {modalError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSetLimit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Monthly Limit ({currency})
                </label>
                <input
                  required autoFocus type="number" step="1" min="1"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={limitInput}
                  onChange={e => { setLimitInput(e.target.value); setModalError(''); }}
                  placeholder="e.g. 5000"
                />
                <p className="text-xs text-slate-400 mt-1">
                  This is YOUR custom limit. The AI will alert you when you approach or exceed it.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Tab 2: 50/30/20 Financial Health Benchmark (advisor)
// ════════════════════════════════════════════════════════════════════════════
const BenchmarkTab = ({ currency }) => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBenchmark = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/analytics/budget-benchmark', { params: { month, year } });
      setData(res.data);
    } catch (err) {
      console.error('[BenchmarkTab] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchBenchmark(); }, [fetchBenchmark]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse h-20" />)}
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-slate-400">Failed to load benchmark data.</div>;

  const summaryConfig = {
    'On Track':        { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-500' },
    'Needs Attention': { color: 'bg-amber-50 text-amber-700 border-amber-200',      icon: AlertTriangle, iconColor: 'text-amber-500' },
    'High Risk':       { color: 'bg-red-50 text-red-700 border-red-200',            icon: AlertTriangle, iconColor: 'text-red-500' },
  };
  const cfg = summaryConfig[data.summary] || summaryConfig['Needs Attention'];
  const SummaryIcon = cfg.icon;

  const pillars = [
    {
      label: 'Needs (50%)',
      desc: 'Housing, Transport, Utilities, Healthcare',
      spent: data.needs_spent,
      target: data.needs_target,
      pct: data.needs_pct,
    },
    {
      label: 'Wants (30%)',
      desc: 'Food/Dining, Entertainment, Shopping',
      spent: data.wants_spent,
      target: data.wants_target,
      pct: data.wants_pct,
    },
    {
      label: 'Savings (20%)',
      desc: 'Income minus total expenses',
      spent: data.actual_savings < 0 ? 0 : data.actual_savings,
      target: data.savings_target,
      pct: data.savings_pct,
      isSavings: true,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header with month picker + advisory notice */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 max-w-md">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Advisory only.</strong> The 50/30/20 rule is a benchmark, not a constraint.
            Set your own limits in the "My Budgets" tab — those drive real alerts.
          </span>
        </div>
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
      </div>

      {/* Summary badge */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.color}`}>
        <SummaryIcon size={20} className={cfg.iconColor} />
        <div>
          <p className="font-semibold text-sm">{data.summary}</p>
          <p className="text-xs opacity-80">
            Income reference: {fmt(data.income_ref, currency)} ·
            Projected spend: {fmt(data.projected_monthly_spend, currency)}
          </p>
        </div>
      </div>

      {/* 50/30/20 pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {pillars.map(p => {
          const pct = Math.max(0, Math.round(p.isSavings ? Math.min(p.pct, 100) : p.pct));
          const color = p.isSavings
            ? (pct >= 20 ? 'bg-emerald-500' : pct >= 10 ? 'bg-amber-500' : 'bg-red-500')
            : (pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500');
          const textColor = p.isSavings
            ? (pct >= 20 ? 'text-emerald-600' : 'text-amber-600')
            : (pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600');

          return (
            <div key={p.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="font-bold text-slate-700 text-sm mb-0.5">{p.label}</p>
              <p className="text-xs text-slate-400 mb-3">{p.desc}</p>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-lg font-bold text-slate-800">{fmt(p.spent, currency)}</span>
                <span className={`text-xs font-semibold ${textColor}`}>{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Target: {fmt(p.target, currency)}</p>
            </div>
          );
        })}
      </div>

      {/* Per-category breakdown table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm">Category-by-Category Comparison</h3>
          <p className="text-xs text-slate-400 mt-0.5">How your actual spending compares to the 50/30/20 suggested limit per category</p>
        </div>
        <div className="divide-y divide-slate-50">
          {data.category_breakdown.map(item => {
            const catMeta = CATEGORIES.find(c => c.name === item.category) || {};
            const statusColor = item.status === 'over' ? 'text-red-600' : item.status === 'warning' ? 'text-amber-600' : 'text-emerald-600';
            const pct = Math.round(item.percentage_of_benchmark);
            return (
              <div key={item.category} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg w-6 flex-shrink-0">{catMeta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-700 truncate">{item.category}</span>
                    <span className={`text-xs font-bold ml-2 ${statusColor}`}>{pct}%</span>
                  </div>
                  <ProgressBar pct={pct} />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                    <span>Spent: {fmt(item.spent, currency)}</span>
                    <span>Benchmark: {fmt(item.benchmark_limit, currency)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation note */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">About the 50/30/20 Rule:</strong> Popularised by US Senator Elizabeth Warren,
        this framework suggests allocating 50% of income to <em>needs</em> (housing, transport, utilities, healthcare),
        30% to <em>wants</em> (food, entertainment, shopping), and saving 20%.
        It's a starting point — your ideal split depends on your city, lifestyle, and income.
        Use "My Budgets" to set limits that reflect your actual priorities.
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Main export
// ════════════════════════════════════════════════════════════════════════════
export default function BudgetsView({ currency = 'BDT' }) {
  const [tab, setTab] = useState('custom');  // 'custom' | 'benchmark'

  const tabs = [
    { id: 'custom',    label: '💰 My Budgets',          desc: 'Your custom spending limits' },
    { id: 'benchmark', label: '📊 50/30/20 Advisor',    desc: 'Financial health benchmark' },
  ];

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span>{t.label}</span>
            <span className={`block text-xs font-normal mt-0.5 ${tab === t.id ? 'text-blue-100' : 'text-slate-400'}`}>
              {t.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'custom'    && <MyBudgetsTab    currency={currency} />}
      {tab === 'benchmark' && <BenchmarkTab    currency={currency} />}
    </div>
  );
}
