import React from 'react';
import {
  LayoutDashboard,
  List,
  Wallet,
  Target,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  DollarSign
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, route: '/dashboard' },
  { id: 'transactions', label: 'Transactions', icon: List,            route: '/transactions' },
  { id: 'budgets',      label: 'Budgets',      icon: Wallet,          route: '/budgets' },
  { id: 'goals',        label: 'Goals',        icon: Target,          route: '/goals' },
  { id: 'bills',        label: 'Bills',        icon: Receipt,         route: '/bills' },
  { id: 'reports',      label: 'Reports',      icon: BarChart3,       route: '/reports' },
  { id: 'settings',     label: 'Settings',     icon: Settings,        route: '/settings' },
];

export default function Sidebar({
  activeView,
  setActiveView,
  sidebarOpen,
  setSidebarOpen,
  user,
  onLogout
}) {
  const mainNavItems = NAV_ITEMS.slice(0, 6);
  const settingsItem = NAV_ITEMS[6];

  return (
    <>
      {/* Sidebar overlay for mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar Aside */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static`}
      >
        {/* ── Brand Logo Header ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-sm flex items-center justify-center">
            <DollarSign size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm leading-tight tracking-tight">
              Money Manager
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5">AI Finance Tracker</p>
          </div>
        </div>

        {/* ── Core Navigation Links (Items 1 - 6) ───────────────────────── */}
        <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {/* Active left indicator */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                )}
                <Icon
                  size={17}
                  className={
                    active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Bottom Section: Settings (Item 7), Logout & User Profile ───── */}
        <div className="px-3 pb-4 pt-2 border-t border-gray-100 space-y-0.5">
          {/* Settings Nav Item */}
          {(() => {
            const Icon = settingsItem.icon;
            const active = activeView === settingsItem.id;
            return (
              <button
                key={settingsItem.id}
                onClick={() => {
                  setActiveView(settingsItem.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                )}
                <Icon
                  size={17}
                  className={
                    active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }
                />
                <span>{settingsItem.label}</span>
              </button>
            );
          })()}

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 px-3 pt-2 mt-1 border-t border-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Dynamic Version & Live Status Badge */}
          <div className="mt-2 pt-2 border-t border-gray-100 px-3 flex items-center justify-between text-xs text-gray-400 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0'}</span>
              <span className="text-gray-300">•</span>
              <span className="text-emerald-600 font-medium font-sans">Stable</span>
            </div>
            {typeof __BUILD_DATE__ !== 'undefined' && (
              <span className="text-[10px] text-gray-400">{__BUILD_DATE__}</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
