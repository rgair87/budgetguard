import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h4v6H3V3zm0 8h4v6H3v-6zm6-8h4v4H9V3zm0 6h4v8H9V9zm6-6h2v10h-2V3z" />
      </svg>
    ),
  },
  {
    path: '/accounts',
    label: 'Accounts',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 4.5L10 1l8 3.5M2 4.5v2l8 3.5 8-3.5v-2M2 9.5v2l8 3.5 8-3.5v-2M4 6v8m4-6.5v8m4-8v8m4-6.5v8" />
      </svg>
    ),
  },
  {
    path: '/transactions',
    label: 'Transactions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 7.5h15M2.5 7.5v7a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-7M2.5 7.5l1.5-3.5h12l1.5 3.5M6 12.5h3" />
      </svg>
    ),
  },
  {
    path: '/subscriptions',
    label: 'Subscriptions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h1.977v.652a7 7 0 01-13.818 1.795M2 9.348h1.977m0 0A7 7 0 0116.023 9.348M3.977 9.348V7m12.046 2.348V7M7.5 13.5l2.5-3 2.5 3" />
      </svg>
    ),
  },
  {
    path: '/budgets',
    label: 'Budgets',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2v14H3V3zm4 4h2v10H7V7zm10 0v10h-2V7h2zM6 2h1v1H6V2zm0 2h1v1H6V4zm2 0h1v1H8V4zM6 6h3v1H6V6zm6 0h5v1h-5V6zm-1-4h6v3h-6V2zM5 17h10v1H5v-1z" />
      </svg>
    ),
  },
  {
    path: '/suggestions',
    label: 'Smart Savings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 2a5 5 0 00-3 9v2a1 1 0 001 1h4a1 1 0 001-1v-2a5 5 0 00-3-9zM8 16h4m-3 2h2" />
      </svg>
    ),
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Poll for unread notification count every 30 seconds
  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api.get<any>('/notifications', { page: 1, limit: 1 });
      return res.data?.unreadCount ?? 0;
    },
    refetchInterval: 30_000,
  });

  const initials = user?.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : '?';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navbar */}
      <nav className="bg-white border-b border-gray-100 shadow-sm px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-600">
            <svg className="w-7 h-7 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 9.06-7 10.2-3.87-1.14-7-5.53-7-10.2V6.3l7-3.12z" />
              <path d="M12 7a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" opacity=".6" />
            </svg>
            BudgetGuard
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {typeof unreadCount === 'number' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="h-8 w-8 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <div className="text-sm text-gray-600">
              {user?.firstName || user?.email}
            </div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-56 min-h-[calc(100vh-57px)] bg-white border-r border-gray-200 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-l-[3px] border-l-primary-600 bg-primary-50 text-primary-700 font-semibold pl-[calc(0.75rem-3px)] pr-3'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 pl-3 pr-3'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
