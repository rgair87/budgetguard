import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import db from '../config/db';
import { calculateRunway } from './runway.service';
import { getPaycheckPlan } from './paycheck.service';
import { getDebtPayoffPlan, getLumpSumRecommendation } from './debt.service';
import { calculateHealthScore } from './healthscore.service';
import type { AdvisorReport, AdvisorInsight } from '@runway/shared';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const CACHE_KEY = 'advisor_report';
const CACHE_DAYS = 3;

// ============================================================
// DATA GATHERING — new queries not covered by existing services
// ============================================================

function getMonthlyTrends(userId: string) {
  const rows = db.prepare(
    `SELECT strftime('%Y-%m', date) as month, category,
            SUM(ABS(amount)) as total, COUNT(*) as tx_count
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-180 days')
     GROUP BY month, category
     ORDER BY month`
  ).all(userId) as unknown as { month: string; category: string; total: number; tx_count: number }[];

  // Group by month
  const byMonth = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, new Map());
    byMonth.get(r.month)!.set(r.category, r.total);
  }

  // Get sorted months
  const months = [...byMonth.keys()].sort();
  if (months.length < 2) return { months, trends: [], totalByMonth: [] };

  // Total spending per month
  const totalByMonth = months.map(m => {
    const cats = byMonth.get(m)!;
    let total = 0;
    for (const v of cats.values()) total += v;
    return { month: m, total: Math.round(total) };
  });

  // Per-category trends: compare most recent month to average of prior months
  const latestMonth = months[months.length - 1];
  const priorMonths = months.slice(0, -1);
  const allCategories = new Set<string>();
  for (const m of byMonth.values()) for (const k of m.keys()) allCategories.add(k);

  const trends: { category: string; currentMonth: number; priorAvg: number; changePercent: number }[] = [];
  for (const cat of allCategories) {
    const current = byMonth.get(latestMonth)?.get(cat) || 0;
    const priorSum = priorMonths.reduce((s, m) => s + (byMonth.get(m)?.get(cat) || 0), 0);
    const priorAvg = priorMonths.length > 0 ? priorSum / priorMonths.length : 0;
    if (priorAvg > 0 || current > 0) {
      const changePct = priorAvg > 0 ? ((current - priorAvg) / priorAvg) * 100 : (current > 0 ? 100 : 0);
      trends.push({
        category: cat,
        currentMonth: Math.round(current),
        priorAvg: Math.round(priorAvg),
        changePercent: Math.round(changePct),
      });
    }
  }

  // Sort by absolute change — biggest movers first
  trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  return { months, trends: trends.slice(0, 10), totalByMonth };
}

function getBehavioralPatterns(userId: string) {
  // Weekend vs weekday
  const dayTypeRows = db.prepare(
    `SELECT CASE WHEN CAST(strftime('%w', date) AS INTEGER) IN (0, 6) THEN 'weekend' ELSE 'weekday' END as day_type,
            SUM(ABS(amount)) as total, COUNT(*) as count, AVG(ABS(amount)) as avg_tx
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     GROUP BY day_type`
  ).all(userId) as unknown as { day_type: string; total: number; count: number; avg_tx: number }[];

  const weekend = dayTypeRows.find(r => r.day_type === 'weekend');
  const weekday = dayTypeRows.find(r => r.day_type === 'weekday');

  // Top 5 largest single purchases in last 30 days
  const bigPurchases = db.prepare(
    `SELECT merchant_name, ABS(amount) as amount, date, category
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-30 days')
     ORDER BY ABS(amount) DESC
     LIMIT 5`
  ).all(userId) as unknown as { merchant_name: string; amount: number; date: string; category: string }[];

  // Average transaction size
  const avgRow = db.prepare(
    `SELECT AVG(ABS(amount)) as avg_amount, COUNT(*) as count
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')`
  ).get(userId) as unknown as { avg_amount: number; count: number };

  return {
    weekendSpend: weekend ? { total: Math.round(weekend.total), count: weekend.count, avgTx: Math.round(weekend.avg_tx) } : null,
    weekdaySpend: weekday ? { total: Math.round(weekday.total), count: weekday.count, avgTx: Math.round(weekday.avg_tx) } : null,
    bigPurchases: bigPurchases.map(p => ({
      merchant: p.merchant_name, amount: Math.round(p.amount), date: p.date, category: p.category,
    })),
    avgTransactionSize: Math.round(avgRow.avg_amount || 0),
    totalTransactions90d: avgRow.count,
  };
}

function getPreviousReport(userId: string): AdvisorReport | null {
  const row = db.prepare(
    `SELECT result FROM ai_cache WHERE user_id = ? AND cache_key = ? ORDER BY created_at DESC LIMIT 1`
  ).get(userId, CACHE_KEY) as unknown as { result: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.result); } catch { return null; }
}

// Strip trailing account numbers, card numbers, and noise from merchant names for grouping
// Strip trailing account numbers, card numbers, and noise from merchant names for grouping
function normalizeMerchantKey(name: string): string {
  return name
    .replace(/x{2,}\d*/gi, '')                    // masked card numbers like xxxxxx8976 or xx6051
    .replace(/\d{5,}/g, '')                        // long digit sequences (5+)
    .replace(/\s*(ACH\s*(DEBIT|CREDIT|WEB[- ]?RECUR?))\s*/gi, '')
    .replace(/\s*(DEBIT CARD|POS PURCHASE|RECURRING DEBIT)\s*/gi, '')
    .replace(/\s*PPD\s*ID:?\s*\S+/gi, '')          // PPD ID: xxx
    .replace(/\s*(CARD|Txxxx)\d+/gi, '')           // CARD1234 or Txxxx7644
    .replace(/\s+\d{2}\/\d{2}$/i, '')              // trailing MM/DD
    .replace(/\s+P\s+\w+$/i, '')                   // trailing " P 2ALF..." type suffixes
    .replace(/\s+[A-Z0-9]{4,}$/i, '')              // trailing alphanumeric IDs
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
}

function getSpendingContext(userId: string) {
  // Get all expense transactions from last 90 days
  const rawTransactions = db.prepare(
    `SELECT merchant_name, ABS(amount) as amount, date
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND merchant_name IS NOT NULL AND merchant_name != ''`
  ).all(userId) as unknown as { merchant_name: string; amount: number; date: string }[];

  // Group by normalized merchant key to merge "GEICO ... 8976" and "GEICO ... 1905"
  const grouped = new Map<string, { displayName: string; amounts: number[]; dates: string[] }>();
  for (const tx of rawTransactions) {
    const key = normalizeMerchantKey(tx.merchant_name);
    const existing = grouped.get(key) || { displayName: tx.merchant_name, amounts: [], dates: [] };
    existing.amounts.push(tx.amount);
    existing.dates.push(tx.date);
    grouped.set(key, existing);
  }

  const merchantFrequency = [...grouped.entries()]
    .map(([_, g]) => {
      const total = g.amounts.reduce((s, a) => s + a, 0);
      const avg = total / g.amounts.length;
      const dates = g.dates.sort();
      return {
        merchant_name: g.displayName,
        occurrences: g.amounts.length,
        total,
        avg_amount: avg,
        first_seen: dates[0],
        last_seen: dates[dates.length - 1],
      };
    })
    .filter(m => m.total > 50)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // Detect debt payments from transaction categories (catches loans not in accounts table)
  const DEBT_CATEGORIES = ['Debt Payments', 'Loan Payment'];
  const LOAN_KEYWORDS = ['loan', 'pymt', 'payment', 'bankers healthca', 'sofi bank', 'lending', 'finance'];

  // Mark each as one-time or recurring, and flag debt/loan payments
  const spending = merchantFrequency.map(m => {
    const lower = m.merchant_name.toLowerCase();
    const isDebtPayment = DEBT_CATEGORIES.some(c => lower.includes(c.toLowerCase())) ||
      LOAN_KEYWORDS.some(kw => lower.includes(kw));
    return {
      merchant: m.merchant_name,
      total90d: Math.round(m.total),
      avgPerPayment: Math.round(m.avg_amount * 100) / 100,
      occurrences: m.occurrences,
      isOneTime: m.occurrences === 1,
      isRecurring: m.occurrences >= 2,
      isDebtOrLoan: isDebtPayment,
      firstSeen: m.first_seen,
      lastSeen: m.last_seen,
    };
  });

  // Also check transaction categories for debt payments not caught by merchant name
  const debtFromCategories = db.prepare(
    `SELECT merchant_name, AVG(ABS(amount)) as avg_amount, COUNT(*) as occurrences
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND category IN ('Debt Payments', 'Loan Payment')
       AND merchant_name IS NOT NULL
     GROUP BY LOWER(merchant_name)
     HAVING occurrences >= 2`
  ).all(userId) as unknown as { merchant_name: string; avg_amount: number; occurrences: number }[];

  // Mark any spending entries that match debt categories
  for (const debt of debtFromCategories) {
    const match = spending.find(s => s.merchant.toLowerCase().includes(debt.merchant_name.toLowerCase().substring(0, 15)));
    if (match) match.isDebtOrLoan = true;
  }

  // Get debt accounts from the accounts table
  const debtAccounts = db.prepare(
    `SELECT name, type, current_balance, interest_rate, minimum_payment
     FROM accounts
     WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')`
  ).all(userId) as unknown as { name: string; type: string; current_balance: number; interest_rate: number | null; minimum_payment: number | null }[];

  // Calculate ACTUAL income from deposits — filter out outliers (bonuses, tax refunds, etc.)
  const NON_PAY_KEYWORDS = ['refund', 'cashback', 'cash back', 'venmo', 'zelle', 'paypal',
    'int trnsfr', 'acct xfer', 'inst xfer', 'ext trnsfr',
    'atm', 'reversal', 'adjustment', 'interest', 'dividend', 'rebate',
    'irs', 'tax ref', 'treas 310'];

  const incomeRows = db.prepare(
    `SELECT merchant_name, amount, date FROM transactions
     WHERE user_id = ? AND amount > 0 AND amount >= 200
       AND date >= date('now', '-90 days')
       AND (merchant_name IS NULL OR (${NON_PAY_KEYWORDS.map(() => 'LOWER(merchant_name) NOT LIKE ?').join(' AND ')}))
     ORDER BY date DESC`
  ).all(userId, ...NON_PAY_KEYWORDS.map(k => `%${k}%`)) as unknown as { merchant_name: string; amount: number; date: string }[];

  // Group by source to find recurring income
  const incomeBySource = new Map<string, { amounts: number[]; dates: string[] }>();
  for (const r of incomeRows) {
    const key = (r.merchant_name || 'unknown').toLowerCase().substring(0, 30).trim();
    const existing = incomeBySource.get(key) || { amounts: [], dates: [] };
    existing.amounts.push(r.amount);
    existing.dates.push(r.date);
    incomeBySource.set(key, existing);
  }

  // Filter out outlier deposits: if a single deposit is > 3x the median for that source, exclude it
  const incomeSources = [...incomeBySource.entries()]
    .filter(([_, v]) => v.amounts.length >= 2)
    .map(([name, v]) => {
      // Sort to find median
      const sorted = [...v.amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      // Exclude amounts > 3x median (bonuses, one-time windfalls)
      const regular = v.amounts.filter(a => a <= median * 3);
      const regularTotal = regular.reduce((s, a) => s + a, 0);
      const excluded = v.amounts.filter(a => a > median * 3);
      return {
        source: name,
        avgRegularAmount: regular.length > 0 ? Math.round(regularTotal / regular.length * 100) / 100 : 0,
        occurrences: regular.length,
        totalRegularLast90d: Math.round(regularTotal),
        estimatedMonthly: Math.round(regularTotal / 3),
        excludedOutliers: excluded.length,
        outlierTotal: Math.round(excluded.reduce((s, a) => s + a, 0)),
      };
    })
    .filter(s => s.estimatedMonthly > 0);

  let totalMonthlyIncome = incomeSources.reduce((s, src) => s + src.estimatedMonthly, 0);

  // Fallback: if no income detected from transactions, use user-configured pay settings
  let incomeSource: 'transactions' | 'settings' = 'transactions';
  if (totalMonthlyIncome === 0) {
    const user = db.prepare('SELECT take_home_pay, pay_frequency FROM users WHERE id = ?').get(userId) as any;
    if (user?.take_home_pay && user.take_home_pay > 0) {
      const freq = user.pay_frequency || 'monthly';
      const multiplier = freq === 'weekly' ? 4.33 : freq === 'biweekly' ? 2.167 : freq === 'twice_monthly' ? 2 : 1;
      totalMonthlyIncome = Math.round(user.take_home_pay * multiplier);
      incomeSource = 'settings';
      incomeSources.push({
        source: `Configured income (${freq})`,
        avgRegularAmount: user.take_home_pay,
        occurrences: 0,
        totalRegularLast90d: 0,
        estimatedMonthly: totalMonthlyIncome,
        excludedOutliers: 0,
        outlierTotal: 0,
      });
    }
  }

  return { spending, debtAccounts, incomeSources, totalMonthlyIncome, incomeSource };
}

function getLatestTransactionDate(userId: string): string | null {
  const row = db.prepare(
    `SELECT MAX(date) as latest FROM transactions WHERE user_id = ?`
  ).get(userId) as unknown as { latest: string | null };
  return row?.latest || null;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are a tough-love personal finance advisor. You've seen it all — people drowning in debt, paycheck-to-paycheck situations, and people who don't realize they're bleeding money. You don't sugarcoat, but you're not cruel. You care deeply and show it by being brutally honest.

PERSONA RULES:
- Use plain language. No financial jargon like "amortization" or "liquidity ratio."
- Reference REAL numbers from the user's data. Never make up amounts.
- Be specific: name merchants, categories, and dollar amounts.
- When things are bad (red/yellow status), lead with the most urgent fix first.
- When things are good (green), celebrate briefly but push for the next level.
- Every insight MUST have a concrete action — never say "consider" or "think about."
- "What if" scenarios must use real data to calculate plausible outcomes.
- Keep each insight body to 2-4 sentences max.

CRITICAL RULES — DO NOT VIOLATE:
1. ONE-TIME vs RECURRING: The data includes "occurrences" per merchant. If occurrences=1, it's a ONE-TIME purchase — do NOT project it as monthly spending or suggest "canceling" it. Only treat merchants with 3+ occurrences as recurring.
2. DEBT OBLIGATIONS: Loans (mortgage, auto loan, student loan, personal loan) and credit card minimums are LEGAL OBLIGATIONS. NEVER suggest "stopping" or "canceling" loan payments. Instead suggest: refinancing at lower rates, consolidation, calling the lender to negotiate terms, income-driven repayment, forbearance as last resort, or finding ways to accelerate payoff.
3. CUTTABLE vs NON-CUTTABLE: The "cuttableMerchants" list from the data may include one-time purchases inflated to look monthly — always cross-reference with the "spendingContext" data which shows actual occurrence counts. Only recommend cutting truly recurring discretionary spending.
4. DAILY BURN RATE: This is a 90-day average. If it includes large one-time purchases, the true ongoing burn rate is lower. Factor this into your analysis.
5. DEBT ACCOUNTS: The data includes a "debtAccounts" list AND merchants flagged with "isDebtOrLoan: true" in topMerchants. Companies like "Bankers Healthcare", "SoFi Bank" are LOAN COMPANIES — they are personal loan lenders, NOT healthcare or banking. Any merchant with isDebtOrLoan=true or containing "PYMT", "PAYMENT", "LOAN", "LENDING" is a debt obligation. Give REALISTIC debt advice (refinance, consolidate, negotiate, avalanche/snowball) — never "just stop paying."
6. EXACT AMOUNTS: When citing bill amounts, you MUST use the "avgPerPayment" field from spendingContext.topMerchants. This is the verified per-transaction average. NEVER invent dollar amounts. NEVER split a single merchant into "multiple policies." If the data shows GEICO with avgPerPayment=$243.47 and occurrences=2, that means ONE insurance payment averaging $243/month — NOT two separate $99 and $93 policies. Always cite the avgPerPayment value directly.
7. INCOME: Use "actualIncomeFromDeposits.totalMonthlyIncome" as the real monthly income. This EXCLUDES outlier deposits like annual bonuses and tax refunds (those are listed separately as excludedOutliers). The paycheck settings may be outdated. If there's a large discrepancy between stated income and deposit-based income, note this as an insight.
8. MERCHANT NAMES: "Bankers Healthcare" is a PERSONAL LOAN company, not a healthcare provider. "SoFi Bank PL PYMT" is a personal loan payment. Do not confuse these with medical expenses or banking fees.

SEVERITY GUIDE:
- "critical": User will run out of money or miss payments if they don't act NOW
- "warning": A negative trend or risk that needs attention within 2 weeks
- "info": Useful observation, not urgent
- "win": Something positive to celebrate — momentum matters

HEALTH SCORE: The healthScore and healthLabel are calculated server-side and provided in the data. Use them exactly as given — do NOT recalculate.

INSIGHT CATEGORIES — generate 6-10 insights covering DIFFERENT categories:
- health_score: Overall financial health observation
- spending_trend: Month-over-month category changes, lifestyle creep
- cash_flow: Cash flow between paychecks, upcoming bill coverage
- debt_intelligence: Interest costs, optimal payment strategy, refinancing
- quick_win: Specific merchants/subscriptions to cut with exact savings
- bill_negotiation: Bills that are likely negotiable (insurance, phone, internet)
- behavioral_pattern: Weekend vs weekday spending, impulse patterns, frequency changes
- what_if: Scenario analysis using real data
- progress: What improved or got worse since last report
- action_plan: The single most important thing to do right now
- savings: Emergency fund, savings, and investment recommendations (NOTE: savings insights are generated server-side, so you do NOT need to generate them — skip this category)

WHAT-IF SCENARIOS — generate exactly 3 REALISTIC scenarios using real data:
- Only include scenarios the user can actually do (no "stop paying your mortgage")
- Good scenarios: cut discretionary spending, refinance a high-rate loan, negotiate insurance, pick up side income, consolidate debt, reduce grocery budget by X%
- Calculate plausible outcomes. Use the daily burn rate and runway data to estimate runway days gained.
- For one-time purchases in the data, do NOT include them in "current monthly" since they won't repeat.

PRIORITY ACTIONS — generate exactly 3, ranked by impact:
- These must be REALISTIC actions the user can take RIGHT NOW.
- NEVER suggest stopping loan payments, defaulting on debt, or skipping legal obligations.
- Good actions: call lender to negotiate rate, cancel a subscription, refinance, apply for balance transfer, reduce a discretionary category, sell something, pick up overtime.`;

// ============================================================
// SAVINGS & INVESTMENT INSIGHTS — deterministic, always included
// ============================================================

function generateSavingsInsights(
  runway: ReturnType<typeof calculateRunway>,
  spendingContext: ReturnType<typeof getSpendingContext>,
  paycheckPlan: ReturnType<typeof getPaycheckPlan>,
): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];
  const monthlyExpenses = runway.dailyBurnRate * 30;
  const cashBalance = runway.spendableBalance;
  const totalDebt = runway.totalDebt;
  const monthlyIncome = spendingContext.totalMonthlyIncome || (paycheckPlan?.monthlyIncome ?? 0);
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const emergencyFundTarget = monthlyExpenses * 3;
  const hasEmergencyFund = cashBalance >= emergencyFundTarget;

  // Find high-interest and low-interest debt
  const debtAccounts = spendingContext.debtAccounts || [];
  const highInterestDebts = debtAccounts.filter(d => (d.interest_rate || 0) > 8);
  const lowInterestDebts = debtAccounts.filter(d => (d.interest_rate || 0) > 0 && (d.interest_rate || 0) <= 8);
  const hasHighInterestDebt = highInterestDebts.length > 0;
  const hasAnyDebt = debtAccounts.some(d => d.current_balance > 0);
  const hasOnlyLowInterestDebt = !hasHighInterestDebt && lowInterestDebts.length > 0;

  // (a) Emergency fund check
  if (monthlyExpenses > 0 && !hasEmergencyFund) {
    const shortfall = emergencyFundTarget - cashBalance;
    insights.push({
      id: crypto.randomUUID(),
      category: 'savings',
      severity: cashBalance < monthlyExpenses ? 'critical' : 'warning',
      title: `Build your emergency fund to $${Math.round(emergencyFundTarget).toLocaleString()}`,
      body: `You have $${Math.round(cashBalance).toLocaleString()} in cash but need $${Math.round(emergencyFundTarget).toLocaleString()} (3 months of expenses) as a safety net. You're $${Math.round(shortfall).toLocaleString()} short. Put this in a High-Yield Savings Account (HYSA) earning 4-5% APY — that's $${Math.round(emergencyFundTarget * 0.045 / 12)}/mo in free interest once fully funded.`,
      action: 'Open a HYSA at Ally, Marcus, or Wealthfront (all offer 4-5% APY, no minimums, FDIC insured). Set up auto-transfer of $' + Math.round(Math.min(shortfall, monthlySurplus > 0 ? monthlySurplus * 0.5 : 100)).toLocaleString() + '/mo from checking — takes 10 minutes online.',
      estimatedImpact: `Build $${Math.round(emergencyFundTarget).toLocaleString()} safety net`,
      timeToComplete: '10 min to open account',
      difficulty: 'easy',
      relatedPage: null,
    });
  }

  // (b) Debt vs invest decision
  if (hasHighInterestDebt) {
    const worstDebt = highInterestDebts.sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))[0];
    const rate = worstDebt.interest_rate || 0;
    const monthlyInterestCost = Math.round((worstDebt.current_balance * (rate / 100)) / 12);
    insights.push({
      id: crypto.randomUUID(),
      category: 'savings',
      severity: 'warning',
      title: `Pay off high-interest debt before investing`,
      body: `Your ${worstDebt.name} charges ${rate}% APR — that's $${monthlyInterestCost}/mo in interest on a $${Math.round(worstDebt.current_balance).toLocaleString()} balance. No investment reliably beats ${rate}% returns. Every dollar toward this debt is a guaranteed ${rate}% return.`,
      action: `Focus all extra cash on ${worstDebt.name} first. Set up autopay for more than the minimum. Even $${Math.round(Math.max(50, monthlyInterestCost * 0.5))}/mo extra cuts months off the payoff timeline.`,
      estimatedImpact: `Save $${monthlyInterestCost}/mo in interest`,
      timeToComplete: '5 min to adjust autopay',
      difficulty: 'easy',
      relatedPage: '/debt',
    });
  } else if (hasOnlyLowInterestDebt) {
    const avgRate = lowInterestDebts.reduce((s, d) => s + (d.interest_rate || 0), 0) / lowInterestDebts.length;
    insights.push({
      id: crypto.randomUUID(),
      category: 'savings',
      severity: 'info',
      title: 'Your debt interest is low — invest alongside payments',
      body: `Your remaining debt averages ${avgRate.toFixed(1)}% APR, which is below typical investment returns of 7-10%. It makes sense to keep making regular payments while also investing extra cash for long-term growth.`,
      action: 'Split extra cash: keep paying debt minimums on schedule, and put additional savings into investments. A simple S&P 500 index fund has averaged ~10% annually over the long term.',
      estimatedImpact: 'Long-term wealth building while managing debt',
      timeToComplete: '15 min to set up',
      difficulty: 'medium',
      relatedPage: '/debt',
    });
  }

  // (c) Where to save/invest — based on situation
  if (!hasEmergencyFund && monthlyExpenses > 0) {
    // Already covered by emergency fund insight above — skip to avoid duplication
  } else if (hasEmergencyFund && hasAnyDebt) {
    // Has emergency fund + debt: prioritize debt paydown
    const focusDebt = [...debtAccounts]
      .filter(d => d.current_balance > 0)
      .sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))[0];
    if (focusDebt && !hasHighInterestDebt) {
      // Only add if we didn't already cover high-interest debt above
      insights.push({
        id: crypto.randomUUID(),
        category: 'savings',
        severity: 'info',
        title: 'Emergency fund set — now accelerate debt payoff',
        body: `With $${Math.round(cashBalance).toLocaleString()} in cash (3+ months covered), your safety net is solid. Now direct extra cash at ${focusDebt.name} ($${Math.round(focusDebt.current_balance).toLocaleString()} at ${focusDebt.interest_rate || 0}% APR) to eliminate it faster.`,
        action: `Increase your ${focusDebt.name} payment above the minimum. Use the debt avalanche method — highest interest rate first. Check /debt for your optimal payoff plan.`,
        estimatedImpact: 'Faster debt freedom',
        timeToComplete: '5 min to adjust payment',
        difficulty: 'easy',
        relatedPage: '/debt',
      });
    }
  } else if (hasEmergencyFund && !hasAnyDebt) {
    // Has emergency fund + no debt: recommend investing
    insights.push({
      id: crypto.randomUUID(),
      category: 'savings',
      severity: 'win',
      title: 'No debt + emergency fund = time to invest',
      body: `You're in an excellent position: $${Math.round(cashBalance).toLocaleString()} in cash, no debt, and 3+ months of expenses covered. Now make your money grow. A broad index fund (S&P 500) has averaged ~10% annually over decades.`,
      action: 'Open a brokerage account (Fidelity, Schwab, or Vanguard — all free). Start with a Roth IRA if eligible ($7,000/year limit, tax-free growth). Then consider I-Bonds for inflation protection and a taxable index fund for anything beyond.',
      estimatedImpact: 'Long-term wealth accumulation',
      timeToComplete: '20 min to open account',
      difficulty: 'medium',
      relatedPage: null,
    });
  }

  // (d) EXCESS CASH vs DEBT DECISION TREE
  // This is the core logic that decides: hold cash, pay debt, or invest
  if (monthlySurplus > 0 && hasAnyDebt) {
    const excessCash = cashBalance - emergencyFundTarget;
    const monthsOfRunway = monthlyExpenses > 0 ? cashBalance / monthlyExpenses : 999;

    // Decision tree:
    // 1. If no emergency fund → build emergency fund first
    // 2. If high-interest debt (>8%) AND excess cash > 3 months runway → pay it down
    // 3. If high-interest debt AND excess cash > 1 month but < 3 → partial paydown
    // 4. If only low-interest debt (<8%) AND excess > 6 months → split invest + paydown
    // 5. If tight on cash (<3 months) → hold cash regardless of debt

    if (!hasEmergencyFund) {
      // Already handled by emergency fund insight above
    } else if (hasHighInterestDebt && excessCash > 0) {
      const worstDebt = highInterestDebts.sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))[0];
      const rate = worstDebt.interest_rate || 0;
      const debtBalance = worstDebt.current_balance;
      const paydownAmount = Math.min(excessCash, debtBalance);
      const monthlyInterestSaved = Math.round((paydownAmount * (rate / 100)) / 12);

      if (monthsOfRunway > 4) {
        // Plenty of cash — aggressively pay down high-interest debt
        insights.push({
          id: crypto.randomUUID(),
          category: 'savings',
          severity: 'critical',
          title: `Use $${Math.round(paydownAmount).toLocaleString()} to pay down ${worstDebt.name} now`,
          body: `You have $${Math.round(cashBalance).toLocaleString()} in cash (${Math.round(monthsOfRunway)} months of expenses) but ${worstDebt.name} charges ${rate}% APR. Every month you hold excess cash instead of paying this debt costs you $${monthlyInterestSaved} in interest. After paying $${Math.round(paydownAmount).toLocaleString()}, you'd still have $${Math.round(cashBalance - paydownAmount).toLocaleString()} (${Math.round((cashBalance - paydownAmount) / monthlyExpenses)} months of expenses).`,
          action: `Log into your ${worstDebt.name} account and make a one-time payment of $${Math.round(paydownAmount).toLocaleString()} today. This saves you $${monthlyInterestSaved}/mo in interest — that's a guaranteed ${rate}% return on your money. Keep your 3-month emergency fund intact.`,
          estimatedImpact: `Save $${monthlyInterestSaved}/mo ($${Math.round(monthlyInterestSaved * 12)}/yr) in interest`,
          timeToComplete: '5 min to make payment',
          difficulty: 'easy',
          relatedPage: '/debt',
        });
      } else if (monthsOfRunway > 2) {
        // Some breathing room — moderate paydown
        const safePay = Math.round(excessCash * 0.5);
        insights.push({
          id: crypto.randomUUID(),
          category: 'savings',
          severity: 'warning',
          title: `Put $${safePay.toLocaleString()} toward ${worstDebt.name}`,
          body: `You have ${Math.round(monthsOfRunway)} months of cash runway — tight but workable. Put half your excess ($${safePay.toLocaleString()}) toward ${worstDebt.name} at ${rate}% APR while keeping a buffer. This saves ~$${Math.round((safePay * (rate / 100)) / 12)}/mo in interest.`,
          action: `Make a $${safePay.toLocaleString()} payment to ${worstDebt.name}. Then set up autopay for $${Math.round(monthlySurplus * 0.5)}/mo extra (half your surplus) to accelerate payoff.`,
          estimatedImpact: `Save ~$${Math.round((safePay * (rate / 100)) / 12)}/mo in interest`,
          timeToComplete: '5 min',
          difficulty: 'easy',
          relatedPage: '/debt',
        });
      }
      // If monthsOfRunway <= 2: too tight, don't recommend lump sum (emergency fund insight handles this)
    }
  }

  // (e) High income surplus recommendation
  if (monthlySurplus > 500 && hasEmergencyFund) {
    insights.push({
      id: crypto.randomUUID(),
      category: 'savings',
      severity: 'info',
      title: `You're saving $${Math.round(monthlySurplus).toLocaleString()}/mo — maximize it`,
      body: `After all expenses, you have $${Math.round(monthlySurplus).toLocaleString()}/mo in surplus. ${hasAnyDebt ? 'After debt payments, put' : 'Put'} this to work: max out tax-advantaged accounts before taxable investing. A 401(k) saves you taxes now ($23,500/year limit), a Roth IRA grows tax-free ($7,000/year limit).`,
      action: `${hasAnyDebt ? 'After accelerating debt payoff, increase' : 'Increase'} your 401(k) contribution to at least the employer match (free money). Then fund a Roth IRA. Only after maxing both should you open a taxable brokerage account.`,
      estimatedImpact: `$${Math.round(monthlySurplus * 12).toLocaleString()}/year invested`,
      timeToComplete: '30 min to adjust contributions',
      difficulty: 'medium',
      relatedPage: null,
    });
  }

  return insights;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

export async function generateAdvisorReport(userId: string, forceRefresh = false): Promise<AdvisorReport> {
  // Check cache
  if (!forceRefresh) {
    const cached = db.prepare(
      `SELECT result, created_at FROM ai_cache
       WHERE user_id = ? AND cache_key = ?
         AND created_at >= datetime('now', '-${CACHE_DAYS} days')`
    ).get(userId, CACHE_KEY) as unknown as any;
    if (cached) {
      const report = JSON.parse(cached.result) as AdvisorReport;
      // Overlay fresh runway numbers on cached qualitative advice
      const freshRunway = calculateRunway(userId);
      return {
        ...report,
        cached: true,
        cachedAt: cached.created_at,
        // Attach live data so frontend can show fresh numbers alongside cached insights
        freshRunway: {
          runwayDays: freshRunway.runwayDays,
          dailyBurnRate: freshRunway.dailyBurnRate,
          spendableBalance: freshRunway.spendableBalance,
          totalDebt: freshRunway.totalDebt,
          spentThisMonth: freshRunway.spentThisMonth,
        },
      } as AdvisorReport & { freshRunway: any };
    }
  }

  // Guard: need at least some transactions
  const txCount = (db.prepare(
    'SELECT COUNT(*) as c FROM transactions WHERE user_id = ?'
  ).get(userId) as unknown as any).c;
  if (txCount === 0) {
    return emptyReport('No transaction data yet. Import a CSV or link a bank account to get your financial health report.');
  }

  console.log('[Advisor] Gathering financial data...');

  // Gather data from existing services
  const runway = calculateRunway(userId);
  const paycheckPlan = getPaycheckPlan(userId);
  const debtPlan = getDebtPayoffPlan(userId);
  const lumpSum = getLumpSumRecommendation(userId);
  const healthScore = calculateHealthScore(userId);

  // New data
  const monthlyTrends = getMonthlyTrends(userId);
  const behavioral = getBehavioralPatterns(userId);
  const spendingContext = getSpendingContext(userId);
  const previousReport = getPreviousReport(userId);
  const dataAsOf = getLatestTransactionDate(userId) || new Date().toISOString().split('T')[0];

  // Log key merchants for debugging
  const geicoData = spendingContext.spending.filter(s => s.merchant.toLowerCase().includes('geico'));
  const sofiData = spendingContext.spending.filter(s => s.merchant.toLowerCase().includes('sofi'));
  if (geicoData.length) console.log('[Advisor] Geico data:', JSON.stringify(geicoData));
  if (sofiData.length) console.log('[Advisor] SoFi data:', JSON.stringify(sofiData));
  console.log('[Advisor] Actual monthly income:', spendingContext.totalMonthlyIncome);
  console.log('[Advisor] Data gathered. Calling Claude...');

  // Build data payload for Claude
  const dataPayload = {
    runway: {
      status: runway.status,
      runwayDays: runway.runwayDays,
      runoutDate: runway.runoutDate,
      dailyBurnRate: runway.dailyBurnRate,
      spendableBalance: runway.spendableBalance,
      totalDebt: runway.totalDebt,
      daysToPayday: runway.daysToPayday,
      spentThisMonth: runway.spentThisMonth,
      remainingBudget: runway.remainingBudget,
      cuttableMerchants: runway.cuttableMerchants,
      spendBreakdown: (runway as any).spendBreakdown || null,
      note: 'dailyBurnRate now EXCLUDES outlier transactions and accounts for refunds. spendBreakdown.rawDailyBurn is the unfiltered rate. spendBreakdown.outlierTransactions lists the large one-time purchases that were excluded.',
    },
    paycheck: paycheckPlan ? {
      monthlyIncome: paycheckPlan.monthlyIncome,
      billsAmount: paycheckPlan.buckets.bills.amount,
      billDetails: paycheckPlan.buckets.bills.details.slice(0, 10),
      debtPayments: paycheckPlan.buckets.debt.amount,
      savingsAmount: paycheckPlan.buckets.savings.amount,
      savingsReason: paycheckPlan.buckets.savings.reason,
      spendingMonthly: paycheckPlan.buckets.spending.monthly,
      isShortfall: paycheckPlan.isShortfall,
      shortfallAmount: paycheckPlan.shortfallAmount,
      isOverspending: paycheckPlan.isOverspending,
      spendingPace: paycheckPlan.spendingPace,
      topCut: paycheckPlan.topCut,
      discretionary: paycheckPlan.buckets.spending.totalDiscretionary,
      necessities: paycheckPlan.buckets.spending.totalNecessities,
    } : null,
    debt: {
      strategy: debtPlan.strategy,
      strategyReason: debtPlan.strategyReason,
      totalDebt: debtPlan.totalDebt,
      totalMinimumPayments: debtPlan.totalMinimumPayments,
      monthsToPayoff: debtPlan.monthsToPayoff,
      totalInterestSaved: debtPlan.totalInterestSaved,
      debts: debtPlan.debts.map(d => ({
        name: d.name, balance: d.balance,
        interestRate: d.interestRate, minimumPayment: d.minimumPayment,
        isFocus: d.isFocus,
      })),
      lumpSum: {
        shouldPayoff: lumpSum.shouldPayoff,
        reason: lumpSum.reason,
        totalInterestSaved: lumpSum.totalInterestSaved,
        monthsShaved: lumpSum.monthsShaved,
        monthlyFreedUp: lumpSum.monthlyFreedUp,
      },
    },
    spendingContext: {
      topMerchants: spendingContext.spending,
      debtAccounts: spendingContext.debtAccounts,
      actualIncomeFromDeposits: {
        sources: spendingContext.incomeSources,
        totalMonthlyIncome: spendingContext.totalMonthlyIncome,
        note: 'This is calculated from actual CSV deposits. The paycheck settings may be outdated. Use THIS number for income analysis, not the paycheck setting.',
      },
    },
    healthScore: {
      score: healthScore.score,
      label: healthScore.label,
      breakdown: healthScore.breakdown,
      note: 'This health score was calculated server-side with real math. Use this exact score and label — do NOT recalculate.',
    },
    trends: monthlyTrends,
    behavioral,
    previous: previousReport ? {
      healthScore: previousReport.healthScore,
      healthLabel: previousReport.healthLabel,
      generatedAt: previousReport.generatedAt,
    } : null,
  };

  const userPrompt = `Analyze this financial data and produce a complete advisor report.

IMPORTANT: The healthScore and healthLabel have been calculated server-side. Use EXACTLY the values from healthScore.score and healthScore.label in the data. Do NOT recalculate.

FINANCIAL DATA:
${JSON.stringify(dataPayload, null, 2)}

Respond with a JSON object matching this EXACT structure:
{
  "healthScore": ${healthScore.score},
  "healthLabel": "${healthScore.label}",
  "healthSummary": "<1-2 sentence summary of their situation>",
  "insights": [
    {
      "category": "<health_score|spending_trend|cash_flow|debt_intelligence|quick_win|bill_negotiation|behavioral_pattern|what_if|progress|action_plan|savings>",
      "severity": "<critical|warning|info|win>",
      "title": "<under 80 chars>",
      "body": "<2-4 sentences with specific numbers>",
      "action": "<ONE specific, concrete step. Include: the exact thing to do, who to call or what to click, and how long it takes. Examples: 'Call GEICO at 1-800-207-7847 and ask for a loyalty discount — 10 min call, typically saves $20-40/mo' or 'Open Netflix.com/cancel and downgrade to Basic ($6.99) — saves $9/mo, 2 minutes' or 'Log into Chase.com, go to Balance Transfer, and apply for 0% APR promo — 15 minutes, could save $84/mo in interest'. Never say just 'consider' or 'think about'. Be SPECIFIC.>",
      "estimatedImpact": "<e.g. '+14 days runway' or 'Save $47/mo' or null>",
      "timeToComplete": "<e.g. '5 min phone call' or '2 min online' or '30 min research' or null>",
      "difficulty": "<easy|medium|hard>",
      "relatedPage": "<one of: /debt, /cut-this, /subscriptions, /calendar, /settings, or null>"
    }
  ],
  "scenarios": [
    {
      "description": "<what if description>",
      "currentMonthly": <number>,
      "proposedMonthly": <number>,
      "monthlySavings": <number>,
      "runwayDaysGained": <number>,
      "debtPayoffMonthsShaved": <number>,
      "annualImpact": <number>
    }
  ],
  "changes": {
    "hasLastReport": <boolean>,
    "summary": "<string or null>",
    "improved": ["<string>"],
    "regressed": ["<string>"]
  },
  "priorityActions": [
    { "rank": 1, "action": "<specific action with exact steps>", "reason": "<string>", "impact": "<string>", "timeToComplete": "<string>", "difficulty": "<easy|medium|hard>" },
    { "rank": 2, "action": "<specific action with exact steps>", "reason": "<string>", "impact": "<string>", "timeToComplete": "<string>", "difficulty": "<easy|medium|hard>" },
    { "rank": 3, "action": "<specific action with exact steps>", "reason": "<string>", "impact": "<string>", "timeToComplete": "<string>", "difficulty": "<easy|medium|hard>" }
  ]
}

Generate 6-10 insights covering different categories. Include exactly 3 what-if scenarios. Respond ONLY with the JSON object, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (parseErr: any) {
      console.log('[Advisor] JSON parse error:', parseErr.message);
      console.log('[Advisor] Raw response (first 500 chars):', text.substring(0, 500));
      parsed = null;
    }

    if (!parsed || !parsed.healthScore) {
      console.log('[Advisor] Failed to parse AI response, using fallback');
      console.log('[Advisor] Stop reason:', response.stop_reason);
      return buildFallbackReport(runway.status, dataAsOf);
    }

    // Add IDs to insights
    const aiInsights: AdvisorInsight[] = (parsed.insights || []).map((ins: any) => ({
      ...ins,
      id: crypto.randomUUID(),
    }));

    // Generate deterministic savings & investment insights
    const savingsInsights = generateSavingsInsights(runway, spendingContext, paycheckPlan);
    const insights: AdvisorInsight[] = [...aiInsights, ...savingsInsights];

    // Validate what-if scenarios: cap savings to monthly income, verify math
    const validatedScenarios = (parsed.scenarios || []).map((s: any) => ({
      ...s,
      // Cap monthly savings to monthly income (can't save more than you earn)
      monthlySavings: Math.min(Math.abs(s.monthlySavings || 0), spendingContext.totalMonthlyIncome || 99999),
      // Cap runway days gained to max projection window
      runwayDaysGained: Math.min(Math.abs(s.runwayDaysGained || 0), 730),
      // Recalculate annual impact from validated monthly
      annualImpact: Math.min(Math.abs(s.monthlySavings || 0), spendingContext.totalMonthlyIncome || 99999) * 12,
    }));

    // Strip any hallucinated phone numbers from insight actions
    for (const ins of aiInsights) {
      if (ins.action) {
        ins.action = ins.action.replace(/1-\d{3}-\d{3}-\d{4}/g, '[call customer service]');
        ins.action = ins.action.replace(/\d{1,2}-\d{3}-\d{3}-\d{4}/g, '[call customer service]');
      }
    }

    const report: AdvisorReport = {
      healthScore: healthScore.score, // Always use server-side score
      healthLabel: healthScore.label,
      healthSummary: parsed.healthSummary || '',
      insights,
      scenarios: validatedScenarios,
      changes: parsed.changes || { hasLastReport: false, summary: null, improved: [], regressed: [] },
      priorityActions: parsed.priorityActions || [],
      generatedAt: new Date().toISOString(),
      cached: false,
      cachedAt: null,
      dataAsOf,
    };

    // Cache
    db.prepare(
      `INSERT OR REPLACE INTO ai_cache (id, user_id, cache_key, result, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(crypto.randomUUID(), userId, CACHE_KEY, JSON.stringify(report));

    console.log(`[Advisor] Report generated: score=${report.healthScore}, insights=${report.insights.length}`);
    return report;
  } catch (err: any) {
    console.error('[Advisor] Claude API error:', err.message);
    return buildFallbackReport(runway.status, dataAsOf);
  }
}

// ============================================================
// SUMMARY — cache-only for Home page, never calls Claude
// ============================================================

export function getAdvisorSummary(userId: string): {
  available: boolean;
  healthScore?: number;
  healthLabel?: string;
  topInsights?: AdvisorInsight[];
} {
  const cached = db.prepare(
    `SELECT result FROM ai_cache
     WHERE user_id = ? AND cache_key = ?
     ORDER BY created_at DESC LIMIT 1`
  ).get(userId, CACHE_KEY) as unknown as { result: string } | undefined;

  if (!cached) return { available: false };

  try {
    const report = JSON.parse(cached.result) as AdvisorReport;
    // Sort by severity priority: critical > warning > win > info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, win: 2, info: 3 };
    const sorted = [...report.insights].sort(
      (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    );
    return {
      available: true,
      healthScore: report.healthScore,
      healthLabel: report.healthLabel,
      topInsights: sorted.slice(0, 3),
    };
  } catch {
    return { available: false };
  }
}

// ============================================================
// CACHE INVALIDATION — called after CSV import
// ============================================================

export function invalidateAdvisorCache(userId: string): void {
  db.prepare('DELETE FROM ai_cache WHERE user_id = ? AND cache_key = ?').run(userId, CACHE_KEY);
}

// ============================================================
// HELPERS
// ============================================================

function emptyReport(summary: string): AdvisorReport {
  return {
    healthScore: 0,
    healthLabel: 'Unknown',
    healthSummary: summary,
    insights: [],
    scenarios: [],
    changes: { hasLastReport: false, summary: null, improved: [], regressed: [] },
    priorityActions: [],
    generatedAt: new Date().toISOString(),
    cached: false,
    cachedAt: null,
    dataAsOf: '',
  };
}

function buildFallbackReport(status: 'green' | 'yellow' | 'red', dataAsOf: string): AdvisorReport {
  const scoreMap = { red: 20, yellow: 45, green: 70 };
  const labelMap = { red: 'Critical', yellow: 'Stable', green: 'Strong' };
  return {
    healthScore: scoreMap[status],
    healthLabel: labelMap[status],
    healthSummary: 'Unable to generate detailed analysis right now. Check back later or try refreshing.',
    insights: [],
    scenarios: [],
    changes: { hasLastReport: false, summary: null, improved: [], regressed: [] },
    priorityActions: [],
    generatedAt: new Date().toISOString(),
    cached: false,
    cachedAt: null,
    dataAsOf,
  };
}
