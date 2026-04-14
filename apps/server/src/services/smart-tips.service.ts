import db from '../config/db';
import { roundCurrency as rc } from '../utils/currency';

interface SmartTip {
  id: string;
  title: string;
  body: string;
  category: 'utility' | 'spending' | 'debt' | 'savings';
  merchantName: string;
  icon: 'electric' | 'gas' | 'water' | 'fuel' | 'food' | 'shopping' | 'debt' | 'general';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getSmartTips(userId: string): SmartTip[] {
  const tips: SmartTip[] = [];
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const nextMonth = (currentMonth + 1) % 12;

  // Get recurring merchants with seasonal data
  const rows = db.prepare(`
    SELECT merchant_name, category,
           strftime('%m', date) as month_num,
           AVG(ABS(amount)) as avg_amount,
           MAX(ABS(amount)) as max_amount,
           MIN(ABS(amount)) as min_amount,
           COUNT(*) as count
    FROM transactions
    WHERE user_id = ? AND amount < 0 AND is_recurring = 1
      AND date >= date('now', '-18 months')
      AND merchant_name IS NOT NULL
    GROUP BY merchant_name, strftime('%m', date)
    ORDER BY merchant_name
  `).all(userId) as { merchant_name: string; category: string; month_num: string; avg_amount: number; max_amount: number; min_amount: number; count: number }[];

  // Group by merchant
  const byMerchant = new Map<string, Map<number, { avg: number; max: number; count: number }>>();
  const merchantCats = new Map<string, string>();

  for (const row of rows) {
    if (!byMerchant.has(row.merchant_name)) byMerchant.set(row.merchant_name, new Map());
    merchantCats.set(row.merchant_name, row.category || 'Other');
    byMerchant.get(row.merchant_name)!.set(parseInt(row.month_num) - 1, {
      avg: row.avg_amount,
      max: row.max_amount,
      count: row.count,
    });
  }

  for (const [merchant, months] of byMerchant) {
    if (months.size < 4) continue; // need enough data
    const cat = merchantCats.get(merchant) || 'Other';
    const lowerName = merchant.toLowerCase();

    // Determine icon
    let icon: SmartTip['icon'] = 'general';
    if (lowerName.includes('electric') || lowerName.includes('duke') || lowerName.includes('power') || lowerName.includes('energy')) icon = 'electric';
    else if (lowerName.includes('gas') && !lowerName.includes('gasoline') && !lowerName.includes('shell') && !lowerName.includes('exxon')) icon = 'gas';
    else if (lowerName.includes('water') || lowerName.includes('sewer')) icon = 'water';
    else if (lowerName.includes('shell') || lowerName.includes('exxon') || lowerName.includes('chevron') || lowerName.includes('bp ') || lowerName.includes('fuel') || lowerName.includes('gasoline') || cat === 'Gas') icon = 'fuel';
    else if (cat === 'Food & Dining' || cat === 'Groceries') icon = 'food';
    else if (cat === 'Shopping') icon = 'shopping';
    else if (cat === 'Debt Payments') icon = 'debt';

    // Overall average
    const allAmounts = [...months.values()];
    const overallAvg = allAmounts.reduce((s, m) => s + m.avg, 0) / allAmounts.length;

    // Next month's expected
    const nextMonthData = months.get(nextMonth);
    const currentMonthData = months.get(currentMonth);
    const nextExpected = nextMonthData ? rc(nextMonthData.avg) : rc(overallAvg);

    // Find peak month
    let peakMonth = 0;
    let peakAmount = 0;
    for (const [m, data] of months) {
      if (data.avg > peakAmount) { peakAmount = data.avg; peakMonth = m; }
    }

    // Generate contextual tips
    const isUtility = icon === 'electric' || icon === 'gas' || icon === 'water';

    // Tip: upcoming seasonal spike
    if (nextMonthData && nextMonthData.avg > overallAvg * 1.2) {
      const increase = rc(nextMonthData.avg - overallAvg);
      tips.push({
        id: `spike-${merchant}`,
        title: `${merchant} will likely be higher in ${MONTH_NAMES[nextMonth]}`,
        body: `Based on last year, expect ~$${nextExpected} (about $${increase} more than your average of $${rc(overallAvg)}).${isUtility && icon === 'electric' ? ' Consider adjusting your thermostat to save.' : ''}`,
        category: 'utility',
        merchantName: merchant,
        icon,
      });
    }

    // Tip: upcoming seasonal dip
    if (nextMonthData && nextMonthData.avg < overallAvg * 0.8) {
      const savings = rc(overallAvg - nextMonthData.avg);
      tips.push({
        id: `dip-${merchant}`,
        title: `${merchant} drops in ${MONTH_NAMES[nextMonth]}`,
        body: `Good news. You'll likely pay ~$${nextExpected}, about $${savings} less than average. Consider putting the difference toward savings.`,
        category: 'savings',
        merchantName: merchant,
        icon,
      });
    }

    // Tip: spending trend
    if (currentMonthData && months.size >= 6) {
      const sixMonthsAgo = (currentMonth - 6 + 12) % 12;
      const oldData = months.get(sixMonthsAgo);
      if (oldData && currentMonthData.avg > oldData.avg * 1.25) {
        tips.push({
          id: `rising-${merchant}`,
          title: `${merchant} is trending up`,
          body: `You're paying ~$${rc(currentMonthData.avg)} now, up from ~$${rc(oldData.avg)} six months ago. That's $${rc((currentMonthData.avg - oldData.avg) * 12)}/year more.`,
          category: 'spending',
          merchantName: merchant,
          icon,
        });
      }
    }
  }

  // Shuffle and return top tips
  tips.sort(() => Math.random() - 0.5);
  return tips.slice(0, 5);
}
