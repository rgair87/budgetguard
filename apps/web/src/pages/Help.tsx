import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ChevronDown } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What is the "runway" number?',
    a: 'Your runway tells you how many days your money will last at your current spending rate. It factors in your bank balance, daily spending patterns, upcoming bills, and income. A higher number means more financial cushion.',
  },
  {
    q: 'How do I connect my bank?',
    a: 'Go to Settings > Accounts tab and click "Connect Bank." We use Teller for secure, read-only access to your transactions. We can see your transactions but can never move your money.',
  },
  {
    q: 'How does the AI categorization work?',
    a: 'When transactions come in, we automatically categorize them (groceries, utilities, entertainment, etc). If we get one wrong, just click the category label on any transaction to change it. We learn from your corrections and apply them to all future transactions from that merchant.',
  },
  {
    q: 'What\'s the difference between Free, Plus, and Pro?',
    a: 'Free gives you the dashboard, 5 AI chats per day, and 1 savings goal. Plus ($7.99/mo) adds bank sync, the AI advisor, spending trends, and more goals. Pro ($14.99/mo) adds spending cut recommendations, bill negotiation scripts, and family sharing.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. We use bank-level encryption, read-only bank access (we can never move your money), and we never sell your data to advertisers. You can export or delete all your data anytime from Settings > Data tab.',
  },
  {
    q: 'How do budgets work?',
    a: 'Go to the Budgets page. We suggest limits based on your 3-month spending averages. Set a limit for each category and we\'ll track your spending against it. You\'ll get alerts when you\'re close to going over.',
  },
  {
    q: 'What is "Cut This"?',
    a: 'Cut This scans your spending and finds 3 specific things you could cancel or reduce. It tells you exactly how much you\'d save and how many days it would add to your runway. Available on the Pro plan.',
  },
  {
    q: 'How does bill negotiation work?',
    a: 'We generate custom phone scripts for each of your bills, including the phone number to call, what to say, and fallback tactics if the first approach doesn\'t work. 60% success rate on the first call. Available on the Pro plan.',
  },
  {
    q: 'Can my family see my finances?',
    a: 'Yes, with the Pro plan. Go to Settings > Profile > Family to invite family members. They\'ll see your dashboard, transactions, and financial data in read-only mode.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Settings > Profile tab and click "Manage subscription." This takes you to the Stripe billing portal where you can cancel or change your plan. Your data stays safe and you keep access until the end of your billing period.',
  },
  {
    q: 'What if the app categorizes something wrong?',
    a: 'Click the category label on any transaction to change it. When you correct a category, we automatically update ALL past and future transactions from that merchant. One fix corrects everything.',
  },
  {
    q: 'How do I upload transactions manually?',
    a: 'Go to the CSV Upload page (accessible from the sidebar under Transactions). Download your transaction history from your bank as a CSV file and upload it. We\'ll auto-categorize everything.',
  },
];

const FEATURES = [
  { name: 'Dashboard', path: '/', desc: 'Your financial overview with runway score, charts, and daily action.' },
  { name: 'Calendar', path: '/calendar', desc: 'See projected daily balances, paydays, and upcoming bills.' },
  { name: 'Budgets', path: '/budgets', desc: 'Set spending limits by category with visual progress tracking.' },
  { name: 'Debt Payoff', path: '/debt', desc: 'Avalanche vs snowball strategy with a timeline to debt freedom.' },
  { name: 'Recurring', path: '/subscriptions', desc: 'All your subscriptions, bills, and recurring charges in one place.' },
  { name: 'Goals', path: '/goals', desc: 'Track savings goals with progress rings and daily targets.' },
  { name: 'AI Advisor', path: '/advisor', desc: 'Personalized financial health score and actionable insights.' },
  { name: 'What If', path: '/simulator', desc: 'Simulate how purchases, income changes, or cuts affect your runway.' },
  { name: 'Trends', path: '/trends', desc: 'Month-over-month spending patterns by merchant and category.' },
  { name: 'Negotiate', path: '/negotiate', desc: 'Phone scripts and numbers to lower your bills.' },
  { name: 'Cut This', path: '/cut-this', desc: '3 specific spending cuts with dollar savings amounts.' },
  { name: 'Ask', path: '/chat', desc: 'Ask anything about your finances in plain English.' },
  { name: 'Transactions', path: '/transactions', desc: 'Search, filter, and categorize all your transactions.' },
];

export default function Help() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Help Center</h1>
        <p className="text-sm text-slate-500">Everything you need to know about Spenditure.</p>
      </div>

      {/* Quick links to features */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Features</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FEATURES.map(f => (
            <Link key={f.path} to={f.path} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-3 hover:border-indigo-200 hover:shadow-md transition-all block">
              <p className="text-sm font-medium text-slate-800">{f.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{f.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800 pr-4">{faq.q}</p>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                  <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="bg-slate-50 rounded-2xl p-5 text-center">
        <p className="text-sm text-slate-700 font-medium">Still have questions?</p>
        <p className="text-xs text-slate-500 mt-1">
          Email us at <a href="mailto:support@spenditure.co" className="text-indigo-600">support@spenditure.co</a>
        </p>
      </div>

      {/* Restart tour */}
      <div className="text-center">
        <button
          onClick={() => { localStorage.removeItem('tour_completed'); window.location.href = '/'; }}
          className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
        >
          Restart the guided tour
        </button>
      </div>
    </div>
  );
}
