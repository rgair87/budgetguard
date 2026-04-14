import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ArrowRight, ChevronRight } from 'lucide-react';

interface TourStep {
  page: string; // route path to show on
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'center';
  nextLabel?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    page: '/',
    title: 'Welcome to Spenditure',
    body: 'This is your dashboard. The big number at the top is your financial runway \u2014 how many days your money will last at your current spending rate.',
    position: 'top',
    nextLabel: 'Got it',
  },
  {
    page: '/',
    title: 'Your daily action',
    body: 'Each day we suggest the one thing that would help your finances the most. It could be cutting a subscription, paying down debt, or just knowing your daily budget.',
    position: 'center',
    nextLabel: 'What else?',
  },
  {
    page: '/',
    title: 'Track your progress',
    body: 'The charts below show your cash flow over time, income vs expenses, and how your runway has changed. Everything updates automatically when your bank syncs.',
    position: 'bottom',
    nextLabel: 'Next',
  },
  {
    page: '/',
    title: 'Explore the sidebar',
    body: 'Use the navigation on the left to check your calendar, set budgets, track debt payoff, manage recurring charges, and more. Each page gives you specific insights on that area.',
    position: 'center',
    nextLabel: 'Next',
  },
  {
    page: '/',
    title: 'Ask anything',
    body: 'See the chat bubble in the bottom right? You can ask questions about your finances in plain English. "Can I afford a new laptop?" or "How much did I spend on food this month?"',
    position: 'bottom',
    nextLabel: 'Start exploring',
  },
];

export default function GuidedTour() {
  const location = useLocation();
  const [step, setStep] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('tour_completed');
    const hasData = localStorage.getItem('runway_token'); // only show if logged in
    if (completed || !hasData) {
      setDismissed(true);
      return;
    }

    // Only start tour on the home page
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      // Delay start so the page loads first
      const timer = setTimeout(() => setStep(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  function next() {
    if (step === null) return;
    if (step >= TOUR_STEPS.length - 1) {
      complete();
    } else {
      setStep(step + 1);
    }
  }

  function complete() {
    localStorage.setItem('tour_completed', 'true');
    setStep(null);
    setDismissed(true);
  }

  if (dismissed || step === null) return null;

  const current = TOUR_STEPS[step];
  if (current.page !== '/' && !location.pathname.startsWith(current.page)) return null;

  const positionClass = current.position === 'top'
    ? 'top-24 left-1/2 -translate-x-1/2'
    : current.position === 'bottom'
    ? 'bottom-24 left-1/2 -translate-x-1/2'
    : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[60] animate-fade-in" onClick={complete} />

      {/* Tooltip */}
      <div className={`fixed z-[61] w-80 sm:w-96 ${positionClass} animate-fade-in`}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5">
          {/* Progress dots */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-indigo-600' : i < step ? 'bg-indigo-300' : 'bg-slate-200'}`} />
              ))}
            </div>
            <button onClick={complete} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Close tour">
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base font-semibold text-slate-900 mb-1">{current.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">{current.body}</p>

          <div className="flex items-center justify-between">
            <button onClick={complete} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Skip tour
            </button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
            >
              {current.nextLabel || 'Next'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
