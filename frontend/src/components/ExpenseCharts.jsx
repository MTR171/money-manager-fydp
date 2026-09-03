import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  LineChart, Line
} from 'recharts';
import { BarChart2, PieChart as PieChartIcon } from 'lucide-react';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
];

const CATEGORY_COLORS = {
  'Food/Dining': '#f59e0b',
  'Housing/Rent': '#3b82f6',
  'Transport': '#10b981',
  'Entertainment': '#8b5cf6',
  'Utilities': '#06b6d4',
  'Healthcare': '#ef4444',
  'Shopping': '#f97316',
  'Other': '#84cc16',
};

const CustomTooltip = ({ active, payload, label, currencySymbol }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
        {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
        {payload.map((entry, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {currencySymbol}{Number(entry.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload, currencySymbol }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
        <p className="font-semibold text-gray-800">{data.category}</p>
        <p className="text-sm text-gray-600">{currencySymbol}{Number(data.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p className="text-xs text-gray-400">{Number(data.percentage).toFixed(1)}% of total</p>
      </div>
    );
  }
  return null;
};

const ExpenseCharts = ({ categoryBreakdown = [], weeklyTrend = [], monthlyIncome = 0, currency = 'USD' }) => {
  const [activeChart, setActiveChart] = useState('pie');
  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' }[currency] || '$';
  
  const dailyBudget = monthlyIncome / 30;
  const weeklyBudget = dailyBudget * 7;
  
  const weeklyData = weeklyTrend.map(w => ({
    ...w,
    budget: weeklyBudget,
  }));

  const pieData = categoryBreakdown.filter(c => c.amount > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Expense Breakdown Pie Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <PieChartIcon size={20} className="text-blue-500" />
            Expense Breakdown
          </h3>
        </div>
        {pieData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="text-center">
              <PieChartIcon size={48} className="mx-auto mb-2 opacity-30" />
              <p>No expense data yet</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="amount"
                nameKey="category"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CATEGORY_COLORS[entry.category] || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip currencySymbol={currencySymbol} />} />
              <Legend
                formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Weekly Spending vs Budget */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <BarChart2 size={20} className="text-purple-500" />
            Weekly Spending Trend
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveChart('bar')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                activeChart === 'bar' ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setActiveChart('line')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                activeChart === 'line' ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Line
            </button>
          </div>
        </div>
        {weeklyData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="text-center">
              <BarChart2 size={48} className="mx-auto mb-2 opacity-30" />
              <p>No spending data yet</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {activeChart === 'bar' ? (
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
                <Bar dataKey="amount" fill="#8b5cf6" name="Spent" radius={[4, 4, 0, 0]} />
                {weeklyBudget > 0 && <ReferenceLine y={weeklyBudget} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Budget', position: 'right', fontSize: 10, fill: '#ef4444' }} />}
              </BarChart>
            ) : (
              <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
                <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} name="Spent" />
                {weeklyBudget > 0 && <Line type="monotone" dataKey="budget" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} name="Budget" dot={false} />}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ExpenseCharts;
