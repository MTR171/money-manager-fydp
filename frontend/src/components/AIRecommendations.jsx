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
              <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">50/30/20 Budget Analysis</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(budget_metrics).map(([key, val]) => (
                  <div key={key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                    <p className="font-semibold text-gray-800 text-sm">
                      {typeof val === 'number' ? val.toFixed(1) : val}
                      {key.includes('pct') || key.includes('rate') || key.includes('ratio') ? '%' : ''}
                    </p>
                  </div>
                ))}
              </div>
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
