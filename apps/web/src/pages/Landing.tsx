import { Link } from 'react-router-dom';
import {
  TrendingUp, BarChart3, CreditCard, Scissors,
  Phone, MessageCircle, CheckCircle,
  ArrowRight, Target, Shield, Lock,
  Repeat, Wallet,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" strokeWidth={2.25} />
            <span className="text-[14px] font-bold tracking-[0.15em] uppercase text-slate-900">Spenditure</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link to="/login?register=true" className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
              Try it free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div>
              <p className="text-sm font-medium text-indigo-600 mb-4">Personal finance that actually helps</p>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-slate-900 tracking-tight leading-[1.15] mb-5">
                See where your money goes.
                <br />
                <span className="text-slate-400">Then fix it.</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                Spenditure connects to your bank, organizes every transaction, and shows you
                what to cut, what to negotiate, and how long your money will last.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3 mb-6">
                <Link
                  to="/login?register=true"
                  className="inline-flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg transition-colors shadow-sm"
                >
                  Start your free trial <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-sm text-slate-400 sm:pt-2.5">7 days free. No credit card.</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-slate-400" /> 256-bit encryption</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-slate-400" /> Read-only access</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-slate-400" /> SOC 2 compliant partners</span>
              </div>
            </div>

            {/* Right: product preview mock */}
            <div className="hidden lg:block">
              <div className="bg-slate-950 rounded-xl p-6 shadow-2xl shadow-slate-900/20 border border-slate-800">
                {/* Mock dashboard header */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="text-[10px] text-slate-500 ml-2">spenditure.co/dashboard</span>
                </div>
                {/* Mock runway card */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg p-5 mb-4">
                  <p className="text-xs text-indigo-200 mb-1">Your financial runway</p>
                  <p className="text-3xl font-bold text-white">47 days</p>
                  <p className="text-xs text-indigo-200 mt-1">$3,240 at $69/day</p>
                </div>
                {/* Mock stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Spent this month</p>
                    <p className="text-sm font-bold text-white">$2,847</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Can save</p>
                    <p className="text-sm font-bold text-emerald-400">$312/mo</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Debt payoff</p>
                    <p className="text-sm font-bold text-white">14 mo</p>
                  </div>
                </div>
                {/* Mock transaction list */}
                <div className="space-y-2">
                  {[
                    { name: 'Netflix', amount: '-$15.99', cat: 'Streaming' },
                    { name: 'Whole Foods', amount: '-$67.32', cat: 'Groceries' },
                    { name: 'Payroll', amount: '+$2,450', cat: 'Income', positive: true },
                  ].map(t => (
                    <div key={t.name} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-slate-300">{t.name}</p>
                        <p className="text-[10px] text-slate-600">{t.cat}</p>
                      </div>
                      <p className={`text-xs font-semibold ${t.positive ? 'text-emerald-400' : 'text-slate-400'}`}>{t.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Numbers strip */}
      <section className="border-b border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">2 min</p>
              <p className="text-xs text-slate-500 mt-1">Setup time</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">$89</p>
              <p className="text-xs text-slate-500 mt-1">Avg monthly savings found</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">60%</p>
              <p className="text-xs text-slate-500 mt-1">Bill negotiation success rate</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">10,000+</p>
              <p className="text-xs text-slate-500 mt-1">Banks supported</p>
            </div>
          </div>
        </div>
      </section>

      {/* Video walkthrough */}
      <section className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm font-medium text-indigo-600 mb-3">See it in action</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">How Spenditure works</h2>
          <div className="relative max-w-3xl mx-auto bg-slate-900 rounded-2xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
            {/* Replace this div with a real video embed: */}
            {/* <iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID" ... /> */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <p className="text-sm text-slate-400">Video coming soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <p className="text-sm font-medium text-indigo-600 mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Three steps. Two minutes. Done.</h2>
          <p className="text-slate-500 mb-14 max-w-lg">No spreadsheets. No manual entry. Connect once and everything updates automatically.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold flex items-center justify-center mb-4">1</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">Link your bank</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Connect in under 2 minutes through Teller. Read-only access means we
                can see your transactions but can never move your money.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold flex items-center justify-center mb-4">2</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">Everything gets organized</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Transactions categorized. Recurring bills flagged. Subscriptions detected.
                You see where every dollar is going.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold flex items-center justify-center mb-4">3</div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">You get a clear plan</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Your financial runway. What to cut. Which debt to pay first.
                A budget that's based on how you actually spend.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features - two columns, more detailed */}
      <section className="border-b border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <p className="text-sm font-medium text-indigo-600 mb-3">Features</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-14">Everything you need, nothing you don't</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
            {[
              {
                icon: BarChart3,
                title: 'Financial runway',
                desc: 'How many days your money will last at your current pace. Updates daily with your real spending.',
              },
              {
                icon: Scissors,
                title: 'Spending cuts',
                desc: 'Three specific things you can cancel or reduce right now. We show you the dollar amount for each one.',
              },
              {
                icon: Phone,
                title: 'Bill negotiation',
                desc: 'Word-for-word phone scripts, direct numbers to call, and what to say. Most people save on the first try.',
              },
              {
                icon: CreditCard,
                title: 'Debt payoff plan',
                desc: 'Avalanche or snowball. Which one saves you more, how much interest you dodge, and when you\'re done.',
              },
              {
                icon: MessageCircle,
                title: 'Ask anything about your money',
                desc: '"Can I afford this trip?" "Where\'d my money go last month?" Real answers from your real numbers.',
              },
              {
                icon: Target,
                title: 'Goals and budgets',
                desc: 'Set targets. Get nudged when you\'re close to going over. Track progress toward the things that matter.',
              },
              {
                icon: Repeat,
                title: 'Subscription tracking',
                desc: 'Every recurring charge, surfaced. See what you\'re paying monthly and decide what stays and what goes.',
              },
              {
                icon: Wallet,
                title: 'Paycheck planning',
                desc: 'Know exactly how to split each paycheck. Bills, savings, spending money. All laid out before you get paid.',
              },
            ].map(f => (
              <div key={f.title} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <f.icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <Shield className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Your data is safe</h2>
            <p className="text-slate-500 mb-10">We take this seriously. It's your money.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { title: 'Read-only access', desc: 'We can see your transactions. We can never move, transfer, or touch your money.' },
              { title: 'Bank-level encryption', desc: 'All data encrypted in transit and at rest. Same standards your bank uses.' },
              { title: 'No data selling', desc: 'We don\'t sell your information to advertisers, data brokers, or anyone else.' },
              { title: 'Delete anytime', desc: 'Export all your data or permanently delete your account from Settings. No hoops.' },
            ].map(s => (
              <div key={s.title} className="text-center sm:text-left">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Simple, honest pricing</h2>
            <p className="text-slate-500">Start free. Upgrade if it's worth it to you.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-900">Free</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">$0</p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Dashboard, transactions, 5 chats per day, 1 savings goal</p>
            </div>
            <div className="rounded-xl border-2 border-indigo-200 bg-white p-6 relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-indigo-600 text-white px-3 py-0.5 rounded-full">Most popular</span>
              <p className="text-sm font-semibold text-slate-900">Plus</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">$7.99<span className="text-sm text-slate-500 font-normal">/mo</span></p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Bank sync, advisor, trends, 15 chats/day, 5 goals</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-900">Pro</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">$14.99<span className="text-sm text-slate-500 font-normal">/mo</span></p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Everything, plus spending cuts, bill negotiation, family sharing</p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              to="/login?register=true"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg transition-colors shadow-sm"
            >
              Start your free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-slate-400 mt-3">7-day free trial with full Pro access. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Stop wondering where your money went</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Set up takes 2 minutes. You'll know more about your spending in the first hour than most people learn in a year.
          </p>
          <Link
            to="/login?register=true"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 bg-white hover:bg-slate-100 px-6 py-3 rounded-lg transition-colors"
          >
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" strokeWidth={2.25} />
            <span className="text-xs font-bold tracking-[0.12em] uppercase text-slate-400">Spenditure</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link to="/pricing" className="hover:text-slate-600 transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-slate-600 transition-colors">Sign in</Link>
          </div>
          <p className="text-xs text-slate-300">&copy; {new Date().getFullYear()} Initium Professional Services LLC</p>
        </div>
      </footer>
    </div>
  );
}
