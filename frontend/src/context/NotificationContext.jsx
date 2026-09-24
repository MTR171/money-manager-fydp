import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle,
  X, CheckCheck, Trash2, Flame, Calendar, Wallet, WifiOff, Cloud
} from 'lucide-react';
import { budgetsAPI, billsAPI } from '../api/client';

const NotificationContext = createContext(null);

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' };

const fmtAmt = (val, currency) => {
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  return `${sym}${Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export function NotificationProvider({
  children,
  user,
  dashboardData,
  recommendations,
  transactions,
  isOnline,
  syncStatus,
  onNavigate,
}) {
  const currency = (user && user.currency) || 'USD';

  const [budgetsStatus, setBudgetsStatus] = useState([]);
  const [billsList, setBillsList] = useState([]);
  const [customEvents, setCustomEvents] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mm_notif_read_ids') || '[]');
    } catch {
      return [];
    }
  });

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mm_notif_dismissed_ids') || '[]');
    } catch {
      return [];
    }
  });

  const [alertPrefs, setAlertPrefs] = useState(() => {
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

  const updateAlertPrefs = useCallback((patch) => {
    setAlertPrefs(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('mm_alert_prefs', JSON.stringify(next));
      return next;
    });
  }, []);

  const toastedRuleIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);
  const prevOnlineRef = useRef(isOnline);
  const prevSyncRef = useRef(syncStatus);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pushToast = useCallback((message, severityOrType = 'info', title = '') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const normalizedSeverity =
      severityOrType === 'error' || severityOrType === 'critical'
        ? 'critical'
        : severityOrType === 'warning'
        ? 'warning'
        : severityOrType === 'success'
        ? 'success'
        : 'info';

    const newToast = {
      id,
      title: title || (
        normalizedSeverity === 'critical' ? 'Critical Alert' :
        normalizedSeverity === 'warning'  ? 'Warning' :
        normalizedSeverity === 'success'  ? 'Success' : 'Notification'
      ),
      message,
      severity: normalizedSeverity,
      createdAt: new Date().toISOString(),
    };

    setToasts(prev => [newToast, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // Fetch live budgets & bills whenever user or transactions change
  const refreshAlerts = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    const now = new Date();
    try {
      const [bRes, billsRes] = await Promise.allSettled([
        budgetsAPI.status(now.getMonth() + 1, now.getFullYear()),
        billsAPI.list(),
      ]);
      if (bRes.status === 'fulfilled' && bRes.value && Array.isArray(bRes.value.data)) {
        setBudgetsStatus(bRes.value.data);
      }
      if (billsRes.status === 'fulfilled' && billsRes.value && Array.isArray(billsRes.value.data)) {
        setBillsList(billsRes.value.data);
      }
    } catch {
      // ignore offline/network errors
    }
  }, [user]);

  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts, transactions, dashboardData]);

  // Track system connectivity & cloud sync transitions
  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      prevOnlineRef.current = isOnline;
      const evtId = `sys_online_${Date.now()}`;
      if (!isOnline) {
        setCustomEvents(prev => [
          {
            id: evtId,
            severity: 'warning',
            category: 'System',
            title: 'Offline Mode Active',
            message: 'Network disconnected. New changes are queued locally in offline storage.',
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 15));
        pushToast('Working offline — changes saved locally', 'warning', 'Offline Mode');
      } else {
        setCustomEvents(prev => [
          {
            id: evtId,
            severity: 'info',
            category: 'System',
            title: 'Connection Restored',
            message: 'Back online. Synchronizing local changes with the cloud.',
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 15));
      }
    }
  }, [isOnline, pushToast]);

  useEffect(() => {
    if (prevSyncRef.current !== syncStatus && syncStatus === 'synced') {
      const evtId = `sys_sync_${Date.now()}`;
      setCustomEvents(prev => [
        {
          id: evtId,
          severity: 'info',
          category: 'System',
          title: 'Cloud Sync Complete',
          message: 'All locally queued transactions have been synced to the cloud.',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 15));
      pushToast('All pending offline changes synced to cloud!', 'success', 'Synced to Cloud');
    }
    prevSyncRef.current = syncStatus;
  }, [syncStatus, pushToast]);

  // Evaluate smart financial rules reactively
  const evaluatedAlerts = React.useMemo(() => {
    const list = [];
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    // 1. Budget Alerts (80% Warning, 100% Critical)
    if (alertPrefs.budgetAlerts !== false) {
      budgetsStatus.forEach(item => {
        const limit = Number(item.monthly_limit || 0);
        const spent = Number(item.spent || 0);
        if (limit <= 0) return;
        const pct = Math.round((spent / limit) * 100);

        if (pct >= 100) {
          list.push({
            id: `budget_crit_${monthKey}_${item.category}`,
            severity: 'critical',
            category: 'Budget',
            title: `Budget Exceeded: ${item.category}`,
            message: `You have spent ${pct}% (${fmtAmt(spent, currency)} of ${fmtAmt(limit, currency)}) in ${item.category}.`,
            timestamp: now.toISOString(),
            targetView: 'budgets',
          });
        } else if (pct >= 80) {
          list.push({
            id: `budget_warn_${monthKey}_${item.category}`,
            severity: 'warning',
            category: 'Budget',
            title: `Budget Near Limit: ${item.category}`,
            message: `${item.category} is at ${pct}% (${fmtAmt(spent, currency)} of ${fmtAmt(limit, currency)} limit).`,
            timestamp: now.toISOString(),
            targetView: 'budgets',
          });
        }
      });
    }

    // 2. Bill Reminders (Overdue = Critical, Due within 3 days = Warning)
    if (alertPrefs.billReminders !== false) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      billsList.forEach(bill => {
        if (bill.is_paid || !bill.due_date) return;
        const due = new Date(bill.due_date);
        const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          list.push({
            id: `bill_overdue_${bill.id}_${bill.due_date.slice(0, 10)}`,
            severity: 'critical',
            category: 'Bills',
            title: `Overdue Bill: ${bill.title}`,
            message: `${fmtAmt(bill.amount, currency)} was due ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago (${dueStart.toLocaleDateString()}).`,
            timestamp: now.toISOString(),
            targetView: 'bills',
          });
        } else if (diffDays <= 3) {
          list.push({
            id: `bill_due_${bill.id}_${bill.due_date.slice(0, 10)}`,
            severity: 'warning',
            category: 'Bills',
            title: `Upcoming Bill: ${bill.title}`,
            message: diffDays === 0
              ? `${fmtAmt(bill.amount, currency)} is due today!`
              : `${fmtAmt(bill.amount, currency)} is due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${dueStart.toLocaleDateString()}).`,
            timestamp: now.toISOString(),
            targetView: 'bills',
          });
        }
      });
    }

    // 3. Spending Velocity Alert (AI projected spend vs income / deficit prediction)
    if (alertPrefs.velocityAlerts !== false) {
      const metrics = (recommendations && recommendations.budget_metrics) || {};
      const projected = Number(metrics.projected_monthly_spend || 0);
      const incomeRef = Number(metrics.income_ref || (dashboardData && dashboardData.current_month && dashboardData.current_month.total_income) || 0);
      const netBalance = Number((dashboardData && dashboardData.current_month && dashboardData.current_month.net_balance) || 0);

      if (incomeRef > 0 && projected > incomeRef) {
        const deficit = projected - incomeRef;
        list.push({
          id: `velocity_deficit_${monthKey}`,
          severity: netBalance < 0 ? 'critical' : 'warning',
          category: 'Velocity',
          title: 'Spending Velocity Alert',
          message: `At current pace, projected month-end spend (${fmtAmt(projected, currency)}) will exceed income by ${fmtAmt(deficit, currency)}.`,
          timestamp: now.toISOString(),
          targetView: 'dashboard',
        });
      } else if (netBalance < 0) {
        list.push({
          id: `velocity_negative_${monthKey}`,
          severity: 'critical',
          category: 'Velocity',
          title: 'Negative Monthly Balance',
          message: `Current month expenses exceed income by ${fmtAmt(Math.abs(netBalance), currency)}.`,
          timestamp: now.toISOString(),
          targetView: 'dashboard',
        });
      }
    }

    // 4. Offline Persistent Indicator if currently offline
    if (!isOnline) {
      list.push({
        id: 'sys_currently_offline',
        severity: 'warning',
        category: 'System',
        title: 'Offline Storage Active',
        message: 'You are currently offline. Transactions are stored locally and will sync automatically.',
        timestamp: now.toISOString(),
      });
    }

    return list;
  }, [budgetsStatus, billsList, recommendations, dashboardData, isOnline, currency, alertPrefs]);

  // Fire toast when a NEW critical/warning rule threshold is crossed after initial load
  useEffect(() => {
    if (!evaluatedAlerts.length) return;
    if (!initialLoadDoneRef.current) {
      evaluatedAlerts.forEach(a => toastedRuleIdsRef.current.add(a.id));
      initialLoadDoneRef.current = true;
      return;
    }
    evaluatedAlerts.forEach(alert => {
      if (!toastedRuleIdsRef.current.has(alert.id)) {
        toastedRuleIdsRef.current.add(alert.id);
        if (alert.severity === 'critical' || alert.severity === 'warning') {
          pushToast(alert.message, alert.severity, alert.title);
        }
      }
    });
  }, [evaluatedAlerts, pushToast]);

  // Combine rule alerts + custom events, filter out dismissed
  const notifications = React.useMemo(() => {
    const combined = [...evaluatedAlerts, ...customEvents];
    const seen = new Set();
    const deduped = [];
    for (const item of combined) {
      if (!seen.has(item.id) && !dismissedIds.includes(item.id)) {
        seen.add(item.id);
        deduped.push({
          ...item,
          isRead: readIds.includes(item.id),
        });
      }
    }
    const order = { critical: 0, warning: 1, info: 2 };
    return deduped.sort((a, b) => (order[a.severity] || 2) - (order[b.severity] || 2));
  }, [evaluatedAlerts, customEvents, readIds, dismissedIds]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const hasCriticalUnread = notifications.some(n => !n.isRead && n.severity === 'critical');

  const markAsRead = useCallback((id) => {
    setReadIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('mm_notif_read_ids', JSON.stringify(next));
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem('mm_notif_read_ids', JSON.stringify(next));
      return next;
    });
  }, [notifications]);

  const dismissNotification = useCallback((id) => {
    setDismissedIds(prev => {
      const next = Array.from(new Set([...prev, id]));
      localStorage.setItem('mm_notif_dismissed_ids', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setDismissedIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem('mm_notif_dismissed_ids', JSON.stringify(next));
      return next;
    });
    setCustomEvents([]);
  }, [notifications]);

  const value = {
    notifications,
    unreadCount,
    hasCriticalUnread,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    toasts,
    pushToast,
    dismissToast,
    refreshAlerts,
    onNavigate,
    alertPrefs,
    updateAlertPrefs,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

// ── Header Notification Center (Bell Dropdown) ───────────────────────────────
export function NotificationBell() {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'warning' | 'info'
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!ctx) return null;
  const {
    notifications,
    unreadCount,
    hasCriticalUnread,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    onNavigate,
  } = ctx;

  const filtered = notifications.filter(n => filter === 'all' || n.severity === filter);

  const severityMeta = {
    critical: {
      badge: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
      card: 'border-l-4 border-l-red-500 bg-red-50/40 dark:bg-red-950/20',
      icon: AlertTriangle,
      iconCls: 'text-red-500 dark:text-red-400',
      label: 'Critical',
    },
    warning: {
      badge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      card: 'border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/15',
      icon: AlertCircle,
      iconCls: 'text-amber-500 dark:text-amber-400',
      label: 'Warning',
    },
    info: {
      badge: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      card: 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/15',
      icon: Info,
      iconCls: 'text-blue-500 dark:text-blue-400',
      label: 'Info',
    },
  };

  const categoryIcon = (cat) => {
    if (cat === 'Budget') return Wallet;
    if (cat === 'Bills') return Calendar;
    if (cat === 'Velocity') return Flame;
    if (cat === 'System') return Cloud;
    return Info;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors focus:outline-none"
        title="Notifications & Smart Alerts"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-gray-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${
              hasCriticalUnread ? 'bg-red-500 animate-pulse' : 'bg-blue-600'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100">Smart Alert Center</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                  title="Clear all alerts"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Severity Filter Tabs */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
            {[
              { id: 'all',      label: `All (${notifications.length})` },
              { id: 'critical', label: `Critical (${notifications.filter(n => n.severity === 'critical').length})` },
              { id: 'warning',  label: `Warning (${notifications.filter(n => n.severity === 'warning').length})` },
              { id: 'info',     label: `Info (${notifications.filter(n => n.severity === 'info').length})` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  filter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200/60 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Alert List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
            {filtered.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500 opacity-70" />
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">All caught up!</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                  No active {filter !== 'all' ? filter : ''} alerts right now.
                </p>
              </div>
            ) : (
              filtered.map(item => {
                const meta = severityMeta[item.severity] || severityMeta.info;
                const SevIcon = meta.icon;
                const CatIcon = categoryIcon(item.category);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      markAsRead(item.id);
                      if (item.targetView && onNavigate) {
                        onNavigate(item.targetView);
                        setOpen(false);
                      }
                    }}
                    className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${meta.card} ${
                      item.isRead ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <SevIcon size={16} className={`${meta.iconCls} mt-0.5 flex-shrink-0`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${meta.badge}`}>
                              {meta.label}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 dark:text-slate-400">
                              <CatIcon size={10} /> {item.category}
                            </span>
                            {!item.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" title="Unread" />
                            )}
                          </div>
                          <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-snug">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5 leading-snug">
                            {item.message}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(item.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md"
                        title="Dismiss"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Non-Intrusive Stacked Toast Engine ───────────────────────────────────────
export function ToastContainer() {
  const ctx = useNotifications();
  if (!ctx || !ctx.toasts.length) return null;

  const { toasts, dismissToast } = ctx;

  const styles = {
    critical: {
      wrap: 'bg-white dark:bg-slate-800 border-l-4 border-l-red-500 border border-red-200 dark:border-red-800/70',
      icon: AlertTriangle,
      iconCls: 'text-red-500',
    },
    warning: {
      wrap: 'bg-white dark:bg-slate-800 border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-800/70',
      icon: AlertCircle,
      iconCls: 'text-amber-500',
    },
    success: {
      wrap: 'bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500 border border-emerald-200 dark:border-emerald-800/70',
      icon: CheckCircle,
      iconCls: 'text-emerald-500',
    },
    info: {
      wrap: 'bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 border border-blue-200 dark:border-blue-800/70',
      icon: Info,
      iconCls: 'text-blue-500',
    },
  };

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map(t => {
        const st = styles[t.severity] || styles.info;
        const Icon = st.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl shadow-xl p-3.5 flex items-start gap-3 transition-all duration-200 animate-fade-in ${st.wrap}`}
          >
            <Icon size={18} className={`${st.iconCls} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-tight">{t.title}</p>
              <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5 leading-snug">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-md"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
