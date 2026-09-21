import React, { useState } from 'react';
import { Brain, AlertTriangle, Info, CheckCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const TYPE_CONFIG = {
  danger:  { bg: 'bg-red-50',    border: 'border-red-200',    icon: AlertTriangle, iconColor: 'text-red-400',    titleColor: 'text-red-700',    msgColor: 'text-red-600'    },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-500', titleColor: 'text-yellow-700', msgColor: 'text-yellow-600' },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Info,          iconColor: 'text-blue-400',   titleColor: 'text-blue-700',   msgColor: 'text-blue-600'   },
};

const AlertCard = ({ alert }) => {
  const cfg = TYPE_CONFIG[alert.type] || {
    bg: 'bg-gray-50', border: 'border-gray-200', icon: Info,
    iconColor: 'text-gray-400', titleColor: 'text-gray-700', msgColor: 'text-gray-500',
  };
  const Icon = cfg.icon;
  return (
    <div className={`py-2 px-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-2">
        <Icon size={13} className={`${cfg.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="min-w-0">
          <p className={`text-xs font-semibold leading-tight ${cfg.titleColor}`}>{alert.title}</p>
          <p className={`text-xs mt-0.5 leading-snug ${cfg.msgColor}`}>{alert.message}</p>
        </div>
      </div>
    </div>
  );
};

const TipCard = ({ tip }) => (
  <div className="flex items-start gap-2 py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
    <CheckCircle size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
    <p className="text-xs text-emerald-800 leading-snug">{tip}</p>
  </div>
);

const MetricPill = ({ label, value, negative }) => (
  <div className="bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100 flex flex-col gap-0.5">
    <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
    <span className={`text-xs font-semibold ${negative ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
  </div>
);

const AIRecommendations = ({ recommendations, onRefresh, loading = false }) => {
  const [expanded, setExpanded] = useState(true);
  const { alerts = [], recommendations: tips = [], budget_metrics = {} } = recommendations || {};
  const hasData = alerts.length > 0 || tips.length > 0;
  const hasMetrics = Object.keys(budget_metrics).length > 0;

  const metricFields = [
    { key: 'income_ref',              label: 'Income Ref'       },
    { key: 'total_expense',           label: 'Total Spent'      },
    { key: 'actual_savings',          label: 'Net Savings'      },
    { key: 'projected_monthly_spend', label: 'Projected Spend'  },
  ].filter(({ key }) => budget_metrics[key] !== undefined);

  const fmtNum = (v) =>
    typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">

      {/* ── Compact Header ───────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-50 rounded-lg">
            <Brain size={15} className="text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 leading-none">AI Financial Insights</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-none">Rule-based analysis &amp; ML</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            className={`p-1.5 hover:bg-gray-100 rounded-md transition-colors ${loading ? 'animate-spin' : ''}`}
            title="Refresh insights"
          >
            <RefreshCw size={13} className="text-gray-400" />
          </button>
          {expanded
            ? <ChevronUp size={14} className="text-gray-300" />
            : <ChevronDown size={14} className="text-gray-300" />}
        </div>
      </div>

      {/* ── Expanded Body ────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-6 space-y-3 border-t border-gray-50">

          {/* Spending Overview */}
          {hasMetrics && (
            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Spending Overview
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {budget_metrics.custom_budgets_set > 0
                    ? `${budget_metrics.custom_budgets_set} budget${budget_metrics.custom_budgets_set > 1 ? 's' : ''} active`
                    : 'No budgets set'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {metricFields.map(({ key, label }) => (
                  <MetricPill
                    key={key}
                    label={label}
                    value={fmtNum(budget_metrics[key])}
                    negative={key === 'actual_savings' && budget_metrics[key] < 0}
                  />
                ))}
              </div>
              {budget_metrics.custom_budgets_set === 0 && (
                <p className="text-[10px] text-blue-500 mt-1.5 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                  💡 Set limits in <strong>Budgets → My Budgets</strong> to personalise these alerts.
                </p>
              )}
            </div>
          )}

          {/* Dual-column Alerts + Tips */}
          {(alerts.length > 0 || tips.length > 0) && (
            <div className={`grid grid-cols-1 gap-4 ${alerts.length > 0 && tips.length > 0 ? 'lg:grid-cols-2' : ''}`}>

              {/* Active Alerts */}
              {alerts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                    Active Alerts
                    <span className="ml-1.5 font-bold text-red-400">({alerts.length})</span>
                  </p>
                  <div className="h-[260px] overflow-y-auto pr-2 space-y-2.5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {alerts.map((alert, i) => <AlertCard key={i} alert={alert} />)}
                  </div>
                </div>
              )}

              {/* Actionable Tips */}
              {tips.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                    Actionable Tips
                    <span className="ml-1.5 font-bold text-emerald-400">({tips.length})</span>
                  </p>
                  <div className="h-[260px] overflow-y-auto pr-2 space-y-2.5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {tips.map((tip, i) => <TipCard key={i} tip={tip} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasData && !loading && (
            <div className="flex flex-col items-center py-6 text-gray-300">
              <Brain size={28} className="mb-1.5 opacity-40" />
              <p className="text-xs">Add transactions to unlock AI insights</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
              <RefreshCw size={13} className="animate-spin" />
              <span className="text-xs">Analysing your finances…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIRecommendations;
