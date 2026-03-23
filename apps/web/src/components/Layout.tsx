import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  CreditCard,
  Target,
  Repeat,
  Users,
  BrainCircuit,
  Sparkles,
  TrendingUp,
  Phone,
  Scissors,
  MessageCircle,
  Receipt,
  Settings,
  LayoutGrid,
  Lightbulb,
  ChevronRight,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import api from '../api/client';
import ErrorBoundary from './ErrorBoundary';
import ChatBubble from './ChatBubble';

/* ------------------------------------------------------------------ */
/*  Nav structure                                                      */
/* ------------------------------------------------------------------ */

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface NavSingle {
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
}

type NavEntry = NavGroup | NavSingle;

const NAV_GROUPS: Record<string, NavEntry> = {
  home: { label: 'Home', icon: Home, to: '/', end: true },
  plan: {
    label: 'Plan',
    icon: LayoutGrid,
    items: [
      { to: '/calendar', label: 'Calendar', icon: Calendar },
      { to: '/debt', label: 'Debt', icon: CreditCard },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/subscriptions', label: 'Recurring', icon: Repeat },
      { to: '/family', label: 'Family', icon: Users },
    ],
  },
  insights: {
    label: 'Insights',
    icon: Lightbulb,
    items: [
      { to: '/advisor', label: 'Advisor', icon: BrainCircuit },
      { to: '/simulator', label: 'What If', icon: Sparkles },
      { to: '/trends', label: 'Trends', icon: TrendingUp },
      { to: '/negotiate', label: 'Negotiate', icon: Phone },
      { to: '/cut-this', label: 'Cut This', icon: Scissors },
      { to: '/chat', label: 'Ask', icon: MessageCircle },
      { to: '/transactions', label: 'Transactions', icon: Receipt },
    ],
  },
  settings: { label: 'Settings', icon: Settings, to: '/settings' },
};

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

function getActiveGroup(pathname: string): string {
  if (pathname === '/') return 'home';
  if (['/calendar', '/debt', '/subscriptions', '/goals', '/family'].some(p => pathname.startsWith(p))) return 'plan';
  if (['/advisor', '/chat', '/cut-this', '/transactions', '/csv-upload', '/predictions', '/trends', '/negotiate', '/simulator'].some(p => pathname.startsWith(p))) return 'insights';
  if (pathname.startsWith('/settings') || pathname.startsWith('/onboarding')) return 'settings';
  return 'home';
}

/* ------------------------------------------------------------------ */
/*  Sidebar nav link (desktop)                                         */
/* ------------------------------------------------------------------ */

function SidebarLink({ to, icon: Icon, label, end }: NavItem & { end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-indigo-500/15 text-indigo-400'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
        }`
      }
    >
      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
      <span>{label}</span>
    </NavLink>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeGroup = getActiveGroup(location.pathname);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get('/notifications/unread-count').then(r => setUnreadCount(r.data.count || 0)).catch(() => {});
  }, [location.pathname]);

  const group = NAV_GROUPS[activeGroup];
  const subItems = isGroup(group) ? group.items : null;

  /* ---- Desktop sidebar ---- */
  const sidebar = (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-slate-950 border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold tracking-tight">R</span>
        </div>
        <span className="text-[17px] font-semibold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          Runway
        </span>

        {/* Notification bell */}
        {unreadCount > 0 && (
          <button
            onClick={() => navigate('/settings')}
            className="ml-auto relative p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            title={`${unreadCount} unread notifications`}
          >
            <Bell className="w-4 h-4 text-slate-400" />
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-slate-950">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {/* Overview */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Overview
          </p>
          <SidebarLink to="/" icon={Home} label="Home" end />
        </div>

        {/* Plan */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Plan
          </p>
          <div className="space-y-0.5">
            {(NAV_GROUPS.plan as NavGroup).items.map(item => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
        </div>

        {/* Insights */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Insights
          </p>
          <div className="space-y-0.5">
            {(NAV_GROUPS.insights as NavGroup).items.map(item => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom user section */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              isActive
                ? 'bg-indigo-500/15 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`
          }
        >
          <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span>Settings</span>
          <ChevronRight className="w-4 h-4 ml-auto text-slate-600" />
        </NavLink>
      </div>
    </aside>
  );

  /* ---- Mobile bottom nav ---- */
  const MOBILE_TABS: { key: string; icon: LucideIcon; label: string }[] = [
    { key: 'home', icon: Home, label: 'Home' },
    { key: 'plan', icon: LayoutGrid, label: 'Plan' },
    { key: 'insights', icon: Lightbulb, label: 'Insights' },
    { key: 'settings', icon: Settings, label: 'Settings' },
  ];

  const mobileBottomNav = (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200/60 z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {MOBILE_TABS.map(({ key, icon: Icon, label }) => {
          const isActive = activeGroup === key;
          const entry = NAV_GROUPS[key];
          const to = isGroup(entry) ? entry.items[0].to : entry.to;

          return (
            <button
              key={key}
              onClick={() => {
                if (!isActive || !isGroup(entry)) {
                  navigate(to);
                }
              }}
              className="relative flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors"
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-indigo-500" />
              )}
              <Icon
                className={`w-[22px] h-[22px] transition-colors duration-150 ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
                strokeWidth={isActive ? 2 : 1.75}
              />
              <span
                className={`text-[10px] font-semibold transition-colors duration-150 ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  /* ---- Mobile sub-nav pills ---- */
  const mobileSubNav = subItems && (
    <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
      {subItems.map(item => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`
            }
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebar}

      {mobileSubNav}

      <main className="md:ml-60 min-h-screen pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {mobileBottomNav}

      {/* Floating chat bubble — hidden on the full /chat page */}
      {location.pathname !== '/chat' && <ChatBubble />}
    </div>
  );
}
