import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, AlertTriangle, CheckCircle, Wallet } from 'lucide-react';

const RiskBadge = ({ riskLevel, confidence }) => {
  const config = {
    Low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle, dot: 'bg-green-500' },
    Medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', icon: AlertTriangle, dot: 'bg-yellow-500' },
    High: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle, dot: 'bg-red-500' },
  }[riskLevel] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: AlertTriangle, dot: 'bg-gray-400' };
  
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
      <Icon size={14} />
      <span className="text-sm font-semibold">{riskLevel} Risk</span>
      {confidence && <span className="text-xs opacity-70">({(confidence * 100).toFixed(0)}%)</span>}
    </div>
  );
};

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, trend, prefix = '' }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon size={22} className="text-white" />
      </div>
      {trend !== undefined && (
        <span className={`text-sm font-medium flex items-center gap-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
    <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
    <p className="text-2xl font-bold text-gray-800">{prefix}{typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}</p>
    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
  </div>
);

const DashboardCards = ({ dashboardData, currency = 'USD' }) => {
  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-12 w-12 bg-gray-200 rounded-xl mb-4" />
            <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' }[currency] || '$';
  const { total_income = 0, total_expense = 0, net_balance = 0, savings_rate = 0 } = dashboardData.current_month || {};
  const risk = dashboardData.risk_prediction || {};

  const cards = [
    {
      title: 'Net Balance',
      value: net_balance,
      subtitle: 'Current month',
      icon: Wallet,
      colorClass: net_balance >= 0 ? 'bg-blue-500' : 'bg-red-500',
      prefix: currencySymbol,
    },
    {
      title: 'Monthly Income',
      value: total_income,
      subtitle: 'This month',
      icon: TrendingUp,
      colorClass: 'bg-green-500',
      prefix: currencySymbol,
    },
    {
      title: 'Total Expenses',
      value: total_expense,
      subtitle: 'This month',
      icon: TrendingDown,
      colorClass: 'bg-red-500',
      prefix: currencySymbol,
    },
    {
      title: 'Savings Rate',
      value: `${savings_rate.toFixed(1)}%`,
      subtitle: 'Of income saved',
      icon: PiggyBank,
      colorClass: savings_rate >= 20 ? 'bg-emerald-500' : savings_rate >= 10 ? 'bg-yellow-500' : 'bg-red-500',
      prefix: '',
    },
    {
      title: 'AI Risk Level',
      value: risk.risk_level || 'N/A',
      subtitle: `Confidence: ${((risk.confidence_score || 0) * 100).toFixed(0)}%`,
      icon: AlertTriangle,
      colorClass: risk.risk_level === 'Low' ? 'bg-green-500' : risk.risk_level === 'High' ? 'bg-red-500' : 'bg-yellow-500',
      prefix: '',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>
      {risk.risk_level && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500">AI Assessment:</span>
          <RiskBadge riskLevel={risk.risk_level} confidence={risk.confidence_score} />
          {risk.key_drivers && risk.key_drivers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {risk.key_drivers.map((d, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">{d}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardCards;
