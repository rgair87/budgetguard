import { Link } from 'react-router-dom';
import {
  TrendingUp, BarChart3, CreditCard, Scissors,
  Phone, MessageCircle, CheckCircle,
  ArrowRight, Target,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" strokeWidth={2.25} />
            <span className="text-[14px] font-bold tracking-[0.15em] uppercase text-slate-900">Spenditure</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link to="/login?register=true" className="text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">
              Try it free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero - simple, direct, no fluff */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.15] mb-5">
            See where your money goes.
            <br />
            <span className="text-slate-400">Then fix it.</span>
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-lg">
            Spenditure connects to your bank, categorizes your spending, and shows you
            exactly what to cut, what to negotiate, and how long your money will actually last.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
            <Link
              to="/login?register=true"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-6 py-3 rounded-lg transition-colors"
            >
              Start your free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-sm text-slate-400 pt-2.5">7 days free. No credit card.</span>
          </div>
        </div>
      </section>

      {/* What it does - not "features", just plain English */}
      <section className="border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Here's what happens when you sign up</h2>
          <p className="text-slate-500 mb-12 max-w-lg">You link your bank. We do the rest. Takes about 2 minutes.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div>
              <div className="text-sm font-bold text-indigo-600 mb-2">Step 1</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">Your spending gets organized</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Every transaction gets categorized. Recurring bills get flagged. You see exactly
                where your money is going each month, broken down by category.
              </p>
            </div>
            <div>
              <div className="text-sm font-bold text-indigo-600 mb-2">Step 2</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">We find what you can save</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Subscriptions you forgot about. Bills you're overpaying. Spending habits that are
                quietly draining your account. We surface all of it.
              </p>
            </div>
            <div>
              <div className="text-sm font-bold text-indigo-600 mb-2">Step 3</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">You get a plan that works</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                How many days your money will last. Which debt to pay off first.
                A budget based on your actual spending, not guesswork.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Specifics - what exactly you get */}
      <section className="border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-12">What's inside</h2>

          <div className="space-y-8">
            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <BarChart3 className="w-4.5 h-4.5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Financial runway</h3>
                <p className="text-sm text-slate-500">How many days your money will last at your current burn rate. Updates daily.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Scissors className="w-4.5 h-4.5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Spending cuts</h3>
                <p className="text-sm text-slate-500">Three specific things you can cancel or reduce right now, with dollar amounts.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Phone className="w-4.5 h-4.5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Bill negotiation scripts</h3>
                <p className="text-sm text-slate-500">Word-for-word scripts and phone numbers to call and lower your bills. 60% success rate on the first try.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-4.5 h-4.5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Debt payoff plan</h3>
                <p className="text-sm text-slate-500">Which debt to attack first, how much interest you'll save, and exactly when you'll be debt-free.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <MessageCircle className="w-4.5 h-4.5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Ask anything</h3>
                <p className="text-sm text-slate-500">"Can I afford this?" "How much did I spend on food last month?" Answers from your real numbers, not generic advice.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Target className="w-4.5 h-4.5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Goals and budgets</h3>
                <p className="text-sm text-slate-500">Set savings goals and spending limits. Get nudged when you're close to going over, not after it's too late.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / safety */}
      <section className="border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex flex-wrap gap-x-10 gap-y-4 justify-center">
            {[
              'Bank-level encryption',
              'We never move your money',
              'Delete your data anytime',
              'No selling your info to advertisers',
            ].map(item => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Simple pricing</h2>
          <p className="text-slate-500 mb-10">Start free. Upgrade if it's worth it to you.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            <div className="rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Free</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">$0</p>
              <p className="text-xs text-slate-500 mt-2">Dashboard, transactions, 5 chats per day, 1 savings goal</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
              <p className="text-sm font-semibold text-slate-900">Plus</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">$7.99<span className="text-sm text-slate-500 font-normal">/mo</span></p>
              <p className="text-xs text-slate-500 mt-2">Bank sync, advisor, trends, 15 chats/day, 5 goals</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-5">
              <p className="text-sm font-semibold text-slate-900">Pro</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">$14.99<span className="text-sm text-slate-500 font-normal">/mo</span></p>
              <p className="text-xs text-slate-500 mt-2">Everything, plus spending cuts, bill negotiation, family sharing</p>
            </div>
          </div>

          <Link
            to="/login?register=true"
            className="inline-flex items-center gap-2 mt-10 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-6 py-3 rounded-lg transition-colors"
          >
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-slate-400" strokeWidth={2.25} />
          <span className="text-xs font-bold tracking-[0.15em] uppercase text-slate-400">Spenditure</span>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
          <Link to="/login" className="hover:text-slate-600 transition-colors">Sign in</Link>
        </div>
        <p className="text-xs text-slate-300 mt-4">&copy; {new Date().getFullYear()} Initium Professional Services LLC</p>
      </footer>
    </div>
  );
}
