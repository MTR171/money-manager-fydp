import React, { useState } from 'react';
import { Brain, AlertTriangle, Info, TrendingDown, CheckCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const AlertCard = ({ alert }) => {
  const config = {
    danger: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle, iconColor: 'text-red-500', titleColor: 'text-red-700', msgColor: 'text-red-600' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-500', titleColor: 'text-yellow-700', msgColor: 'text-yellow-600' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, iconColor: 'text-blue-500', titleColor: 'text-blue-700', msgColor: 'text-blue-600' },
  }[alert.type] || { bg: 'bg-gray-50', border: 'border-gray-200', icon: Info, iconColor: 'text-gray-500', titleColor: 'text-gray-700', msgColor: 'text-gray-600' };
  
  const Icon = config.icon;
  
  return (
    <div className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div>
          <p className={`font-semibold text-sm ${config.titleColor}`}>{alert.title}</p>
          <p className={`text-sm mt-0.5 ${config.msgColor}`}>{alert.message}</p>
        </div>
      </div>
    </div>
  );
};

const AIRecommendations = ({ recommendations, onRefresh, loading = false }) => {
  const [expanded, setExpanded] = useState(true);

  const { alerts = [], recommendations: tips = [], budget_metrics = {} } = recommendations || {};

  const hasData = alerts.length > 0 || tips.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {/* Header */}
      <div
        className="flex items-center justify-between p-6 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 rounded-xl">
            <Brain size={22} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">AI Financial Insights</h3>
            <p className="text-xs text-gray-400">Powered by rule-based analysis & machine learning</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}
            title="Refresh insights"
          >
            <RefreshCw size={16} className="text-gray-400" />
          </button>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-6">
          {/* Budget Metrics */}
          {Object.keys(budget_metrics).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Spending Overview</h4>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {budget_metrics.custom_budgets_set > 0
                    ? `${budget_metrics.custom_budgets_set} custom budget${budget_metrics.custom_budgets_set > 1 ? 's' : ''} active`
                    : 'No custom budgets set'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'income_ref',              label: 'Income Ref' },
                  { key: 'total_expense',            label: 'Total Spent' },
                  { key: 'actual_savings',           label: 'Net Savings' },
                  { key: 'projected_monthly_spend',  label: 'Projected Spend' },
                ].map(({ key, label }) => budget_metrics[key] !== undefined && (
                  <div key={key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`font-semibold text-sm ${
                      key === 'actual_savings' && budget_metrics[key] < 0 ? 'text-red-600' : 'text-gray-800'
                    }`}>
                      {typeof budget_metrics[key] === 'number'
                        ? budget_metrics[key].toLocaleString('en-US', { maximumFractionDigits: 0 })
                        : budget_metrics[key]}
                    </p>
                  </div>
                ))}
              </div>
              {budget_metrics.custom_budgets_set === 0 && (
                <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                  💡 Go to <strong>Budgets → My Budgets</strong> to set category limits — alerts below will then be based on your own numbers.
                </p>
              )}
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Active Alerts</h4>
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <AlertCard key={i} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {tips.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Actionable Tips</h4>
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-800">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasData && !loading && (
            <div className="text-center py-8 text-gray-400">
              <Brain size={40} className="mx-auto mb-2 opacity-30" />
              <p>Add some transactions to get AI insights</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-gray-400">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">Analyzing your finances...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIRecommendations;
