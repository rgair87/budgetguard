import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import PlaidLinkButton from '../components/PlaidLink';
import {
  Shield,
  TrendingDown,
  Calculator,
  Landmark,
  CalendarDays,
  Banknote,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';

type Step = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Progress bar - hidden on welcome step */}
      {step > 0 && (
        <div className="w-full max-w-lg mb-8">
          <div className="flex items-center justify-between text-xs font-medium text-gray-400 mb-2">
            <span className={step >= 1 ? 'text-indigo-600' : ''}>Connect</span>
            <span className={step >= 2 ? 'text-indigo-600' : ''}>Events</span>
            <span className={step >= 3 ? 'text-indigo-600' : ''}>Paycheck</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((step) / 3) * 100}%` }}
            />
          </div>
        </div>
      )}

      {step === 0 && (
        <StepWelcome
          onGetStarted={() => setStep(1)}
          onDemoData={async () => {
            try {
              await api.post('/auth/demo-data');
              navigate('/');
            } catch (err) {
              console.error('Failed to load demo data:', err);
            }
          }}
        />
      )}
      {step === 1 && <StepConnect onNext={() => setStep(2)} />}
      {step === 2 && <StepEvents onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepPaycheck onDone={() => navigate('/')} onBack={() => setStep(2)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 0 — Welcome / Value Prop                                     */
/* ------------------------------------------------------------------ */

function StepWelcome({
  onGetStarted,
  onDemoData,
}: {
  onGetStarted: () => void;
  onDemoData: () => void;
}) {
  const [loadingDemo, setLoadingDemo] = useState(false);

  async function handleDemo() {
    setLoadingDemo(true);
    try {
      await onDemoData();
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      {/* Hero card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 relative px-8 pt-12 pb-10 text-center overflow-hidden">
          {/* Decorative blurs */}
          <div className="absolute -top-16 -left-16 w-64 h-64 bg-indigo-700/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-slate-700/20 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-indigo-200 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Personal finance, reimagined
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
              Welcome to Runway
            </h1>
            <p className="text-indigo-200 text-base leading-relaxed max-w-sm mx-auto">
              Know exactly when you'll run out of money — and what to do about it
            </p>
          </div>
        </div>

        {/* Value props */}
        <div className="px-8 py-8 space-y-6">
          <ValueProp
            icon={<Shield className="w-5 h-5 text-indigo-600" />}
            title="See your runway"
            description="Know how many days your money will last"
          />
          <ValueProp
            icon={<TrendingDown className="w-5 h-5 text-indigo-600" />}
            title="Get ahead of problems"
            description="Alerts before bills hit, not after"
          />
          <ValueProp
            icon={<Calculator className="w-5 h-5 text-indigo-600" />}
            title="Take action"
            description="Negotiation scripts, spending simulator, AI advice"
          />
        </div>

        {/* CTAs */}
        <div className="px-8 pb-8 space-y-3">
          <button
            onClick={onGetStarted}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleDemo}
            disabled={loadingDemo}
            className="w-full bg-gray-50 text-gray-700 py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-100 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
          >
            {loadingDemo ? 'Loading sample data...' : 'Try with sample data'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ValueProp({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Connect Bank                                             */
/* ------------------------------------------------------------------ */

function StepConnect({ onNext }: { onNext: () => void }) {
  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Connect your bank</h2>
            <p className="text-sm text-gray-500">
              Link your bank so Runway can track spending and calculate your runway.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <PlaidLinkButton onSuccess={onNext} />

          <div className="border-t border-gray-100 pt-5 space-y-2">
            <button
              onClick={onNext}
              className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
            >
              Skip — I'll add accounts manually in Settings
            </button>
            <p className="text-xs text-gray-400 leading-relaxed">
              You can also upload a CSV of your transactions later, or add accounts and balances by hand in Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Upcoming Events                                          */
/* ------------------------------------------------------------------ */

function StepEvents({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [events, setEvents] = useState<{ name: string; amount: string; timing: string }[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [timing, setTiming] = useState('anytime');
  const [saving, setSaving] = useState(false);

  const suggestions = ['Holiday shopping', 'Vacation', 'Car repair', 'Medical bill', 'Lawyer payment'];

  function addEvent() {
    if (!name || !amount) return;
    setEvents([...events, { name, amount, timing }]);
    setName('');
    setAmount('');
    setTiming('anytime');
  }

  async function saveAndContinue() {
    setSaving(true);
    try {
      for (const evt of events) {
        const expectedDate =
          evt.timing === 'anytime'
            ? null
            : evt.timing === 'this_month'
              ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
                  .toISOString()
                  .split('T')[0]
              : evt.timing === 'next_3_months'
                ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0]
                : null;

        await api.post('/events', {
          name: evt.name,
          estimated_amount: parseFloat(evt.amount),
          expected_date: expectedDate,
        });
      }
      onNext();
    } catch (err) {
      console.error('Failed to save events:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add upcoming expenses</h2>
            <p className="text-sm text-gray-500">
              Big expenses you know are coming. This is what makes Runway different.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setName(s)}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Add form */}
          <div className="flex gap-2">
            <input
              placeholder="Expense name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
            <input
              placeholder="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            >
              <option value="anytime">Anytime</option>
              <option value="this_month">This month</option>
              <option value="next_3_months">Next 3 months</option>
            </select>
            <button
              onClick={addEvent}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 shadow-lg shadow-indigo-500/25"
            >
              Add
            </button>
          </div>

          {/* Event list */}
          {events.length > 0 && (
            <div className="space-y-2">
              {events.map((evt, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-gray-50 rounded-xl p-4"
                >
                  <span className="text-sm font-medium text-gray-900">{evt.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      ${parseFloat(evt.amount).toLocaleString()}
                    </span>
                    <button
                      onClick={() => setEvents(events.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={saveAndContinue}
              disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              {saving ? 'Saving...' : events.length > 0 ? 'Save & continue' : 'Skip'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Paycheck Info                                            */
/* ------------------------------------------------------------------ */

function StepPaycheck({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [frequency, setFrequency] = useState('biweekly');
  const [nextPayday, setNextPayday] = useState('');
  const [takeHome, setTakeHome] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!nextPayday || !takeHome) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await api.put('/runway/paycheck', {
        pay_frequency: frequency,
        next_payday: nextPayday,
        take_home_pay: parseFloat(takeHome),
      });
      onDone();
    } catch (err) {
      console.error('Failed to save paycheck info:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Paycheck info</h2>
            <p className="text-sm text-gray-500">
              Helps Runway count down to payday and calculate your daily budget.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How often are you paid?
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="twice_monthly">Twice a month</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Next payday</label>
            <input
              type="date"
              value={nextPayday}
              onChange={(e) => setNextPayday(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Take-home per paycheck
            </label>
            <input
              type="number"
              placeholder="e.g. 2800"
              value={takeHome}
              onChange={(e) => setTakeHome(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              {saving ? 'Saving...' : 'Finish setup'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
