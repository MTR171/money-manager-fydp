import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import apiClient from '../api/client';

const fmt = (amount, currency = 'BDT') => {
  const symbols = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' };
  const sym = symbols[currency] || '৳';
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const CATEGORY_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const MONTHS = [
  { val: 1, label: 'January' }, { val: 2, label: 'February' }, { val: 3, label: 'March' },
  { val: 4, label: 'April' }, { val: 5, label: 'May' }, { val: 6, label: 'June' },
  { val: 7, label: 'July' }, { val: 8, label: 'August' }, { val: 9, label: 'September' },
  { val: 10, label: 'October' }, { val: 11, label: 'November' }, { val: 12, label: 'December' }
];
const YEARS = [2024, 2025, 2026];

export default function ReportsView({ currency = 'BDT' }) {
  // Cashflow state
  const [trendMonths, setTrendMonths] = useState(6);
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  // Category state
  const [catMonth, setCatMonth] = useState(new Date().getMonth() + 1);
  const [catYear, setCatYear] = useState(new Date().getFullYear());
  const [catData, setCatData] = useState([]);
  const [catLoading, setCatLoading] = useState(true);

  const fetchTrend = async () => {
    try {
      setTrendLoading(true);
      const res = await apiClient.get('/api/analytics/cashflow-trend', { params: { months: trendMonths } });
      // assume res.data is array: [{ month: 'Jan', income: 100, expense: 50 }, ...]
      setTrendData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setCatLoading(true);
      const res = await apiClient.get('/api/transactions/summary/category-breakdown', { params: { month: catMonth, year: catYear } });
      // assume res.data is array: [{ category: 'Food', total: 500, percentage: 50 }, ...]
      setCatData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    fetchTrend();
  }, [trendMonths]);

  useEffect(() => {
    fetchCategories();
  }, [catMonth, catYear]);

  const totalSpending = catData.reduce((acc, curr) => acc + Number(curr.total || curr.amount || 0), 0);

  // Normalizing the response format just in case it differs slightly
  const normalizedCatData = catData.map(item => ({
    name: item.category || item.name,
    value: Number(item.total || item.amount || 0)
  })).filter(item => item.value > 0);

  const totalNormalized = normalizedCatData.reduce((sum, i) => sum + i.value, 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg">
          <p className="font-semibold text-slate-800 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {fmt(entry.value, currency)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Reports & Analytics</h1>

      {/* Section A: Cashflow Trend */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Cashflow Trend</h2>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {[3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => setTrendMonths(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  trendMonths === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m}M
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 w-full">
          {trendLoading ? (
            <div className="w-full h-full bg-slate-50 animate-pulse rounded-xl"></div>
          ) : trendData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `৳${val}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Section B: Category Spending */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Category Spending</h2>
          <div className="flex gap-2">
            <select 
              value={catMonth} 
              onChange={(e) => setCatMonth(Number(e.target.value))}
              className="p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              {MONTHS.map(m => (
                <option key={m.val} value={m.val}>{m.label}</option>
              ))}
            </select>
            <select 
              value={catYear} 
              onChange={(e) => setCatYear(Number(e.target.value))}
              className="p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {catLoading ? (
          <div className="h-64 w-full bg-slate-50 animate-pulse rounded-xl"></div>
        ) : normalizedCatData.length === 0 ? (
          <div className="h-64 w-full flex items-center justify-center text-slate-400">No expenses this month</div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <div className="relative w-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={normalizedCatData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {normalizedCatData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-500 uppercase font-medium">Total Spent</span>
                <span className="text-xl font-bold text-slate-800">{fmt(totalNormalized, currency)}</span>
              </div>
            </div>

            <div className="flex-1 w-full max-w-md">
              <div className="space-y-3">
                {normalizedCatData.map((entry, index) => {
                  const percent = totalNormalized > 0 ? Math.round((entry.value / totalNormalized) * 100) : 0;
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}></div>
                        <span className="text-sm font-medium text-slate-700">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-900 font-semibold">{fmt(entry.value, currency)}</span>
                        <span className="text-xs text-slate-500 w-8 text-right">{percent}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
