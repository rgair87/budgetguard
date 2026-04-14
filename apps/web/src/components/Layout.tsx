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
  Wallet,
  Settings,
  HelpCircle,
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
  badge?: 'plus' | 'pro';
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
      { to: '/budgets', label: 'Budgets', icon: Wallet },
      { to: '/debt', label: 'Debt', icon: CreditCard },
      { to: '/subscriptions', label: 'Recurring', icon: Repeat },
      { to: '/goals', label: 'Goals', icon: Target },
    ],
  },
  insights: {
    label: 'Insights',
    icon: Lightbulb,
    items: [
      { to: '/advisor', label: 'Advisor', icon: BrainCircuit, badge: 'plus' },
      { to: '/simulator', label: 'What If', icon: Sparkles },
      { to: '/trends', label: 'Trends', icon: TrendingUp },
      { to: '/negotiate', label: 'Negotiate', icon: Phone, badge: 'pro' },
      { to: '/cut-this', label: 'Cut This', icon: Scissors, badge: 'pro' },
      { to: '/chat', label: 'Ask', icon: MessageCircle },
      { to: '/transactions', label: 'Transactions', icon: Receipt },
    ],
  },
  settings: { label: 'Settings', icon: Settings, to: '/settings' },
  help: { label: 'Help', icon: HelpCircle, to: '/help' },
};

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

function getActiveGroup(pathname: string): string {
  if (pathname === '/') return 'home';
  if (['/calendar', '/budgets', '/debt', '/subscriptions', '/goals'].some(p => pathname.startsWith(p))) return 'plan';
  if (['/advisor', '/chat', '/cut-this', '/transactions', '/csv-upload', '/predictions', '/trends', '/negotiate', '/simulator'].some(p => pathname.startsWith(p))) return 'insights';
  if (pathname.startsWith('/settings') || pathname.startsWith('/onboarding')) return 'settings';
  return 'home';
}

/* ------------------------------------------------------------------ */
/*  Sidebar nav link (desktop)                                         */
/* ------------------------------------------------------------------ */

function SidebarLink({ to, icon: Icon, label, end, badge }: NavItem & { end?: boolean }) {
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
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
          badge === 'pro' ? 'bg-violet-500/20 text-violet-400' : 'bg-indigo-500/20 text-indigo-400'
        }`}>{badge === 'pro' ? 'PRO' : 'PLUS'}</span>
      )}
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
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-slate-950 border-r border-white/[0.06]" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 shrink-0">
        <TrendingUp className="w-6 h-6 text-indigo-400" strokeWidth={2.25} />
        <span className="text-[15px] font-bold tracking-[0.15em] uppercase text-slate-200">
          Spenditure
        </span>

        {/* Notification bell */}
        {unreadCount > 0 && (
          <button
            onClick={() => navigate('/settings')}
            className="ml-auto relative p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            aria-label={`${unreadCount} unread notifications`}
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
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3 space-y-0.5">
        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              isActive
                ? 'bg-indigo-500/15 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`
          }
        >
          <HelpCircle className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span>Help</span>
        </NavLink>
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50" aria-label="Mobile navigation">
      {/* Top edge: gradient blur border */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute inset-x-0 -top-3 h-3 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />

      <div className="bg-white/[0.97] backdrop-blur-xl">
        <div className="flex items-center justify-around h-[68px] px-1">
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
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center gap-[3px] py-2 px-5 transition-all duration-200 ease-out"
              >
                {/* Active pill indicator at top */}
                <span
                  className={`absolute -top-[1px] left-1/2 -translate-x-1/2 h-[3.5px] rounded-full bg-indigo-500 transition-all duration-300 ease-out ${
                    isActive ? 'w-8 opacity-100' : 'w-0 opacity-0'
                  }`}
                />

                {/* Icon with glow */}
                <span className="relative">
                  {isActive && (
                    <span className="absolute inset-0 blur-[10px] bg-indigo-400/30 rounded-full scale-150" />
                  )}
                  <Icon
                    className={`relative w-[23px] h-[23px] transition-all duration-200 ${
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                    strokeWidth={isActive ? 2.25 : 1.5}
                    fill={isActive ? 'currentColor' : 'none'}
                    fillOpacity={isActive ? 0.12 : 0}
                  />
                </span>

                <span
                  className={`text-[10px] uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? 'text-indigo-600 font-bold'
                      : 'text-slate-400 font-medium'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Safe area padding for notched phones */}
      <div className="bg-white/[0.97] pb-[env(safe-area-inset-bottom)]" />
    </nav>
  );

  /* ---- Mobile sub-nav pills (segmented control) ---- */
  const [pillScrolled, setPillScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setPillScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const mobileSubNav = subItems && (
    <div
      className={`md:hidden sticky top-0 z-40 px-3 py-2 transition-shadow duration-300 ${
        pillScrolled ? 'shadow-sm shadow-slate-200/60' : ''
      }`}
    >
      <div className="bg-slate-100/80 backdrop-blur-sm rounded-2xl p-1 flex gap-1 overflow-x-auto scrollbar-hide">
        {subItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-[7px] rounded-xl whitespace-nowrap transition-all duration-200 ease-out ${
                  isActive
                    ? 'bg-white text-indigo-600 shadow-md shadow-slate-200/70 scale-[1.02]'
                    : 'bg-transparent text-slate-500 hover:bg-white/50'
                }`
              }
            >
              <Icon className="w-[14px] h-[14px] shrink-0 align-middle" strokeWidth={2} />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebar}

      {mobileSubNav}

      <main className="md:ml-60 min-h-screen pb-20 md:pb-0" role="main">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {mobileBottomNav}

      {/* Floating chat bubble - hidden on the full /chat page */}
      {location.pathname !== '/chat' && <ChatBubble />}
    </div>
  );
}
