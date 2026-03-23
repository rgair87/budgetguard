import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface MerchantClassification {
  merchantName: string;
  category: string;
  isBill: boolean;
}

const VALID_CATEGORIES = new Set([
  'Food & Dining', 'Groceries', 'Entertainment', 'Shopping',
  'Transportation', 'Gas', 'Utilities', 'Healthcare', 'Insurance',
  'Housing', 'Home Improvement', 'Services', 'Debt Payments',
  'Travel', 'Personal', 'Education', 'Transfers', 'Fees', 'Bills', 'Other',
]);

const SYSTEM_PROMPT = `You are a transaction categorization engine for a personal finance app. Given a list of merchant names from bank transactions, classify each into exactly one category and indicate whether it's likely a recurring bill.

Categories (use these EXACTLY):
- Food & Dining (restaurants, takeout, delivery, coffee shops)
- Groceries (supermarkets, grocery stores)
- Entertainment (streaming, gaming, movies, hobbies, Apple subscriptions)
- Shopping (retail, online shopping, clothing, Amazon, Best Buy)
- Transportation (rideshare, parking, tolls, auto maintenance)
- Gas (gas stations, fuel)
- Utilities (electric, water, phone, internet, cable, municipal bills)
- Healthcare (doctors, dentists, pharmacy, medical — NOT Bankers Healthcare Group which is a lender)
- Insurance (auto, health, home, life insurance)
- Housing (rent, mortgage, HOA, home security like Ring)
- Home Improvement (hardware stores, contractors, home repairs)
- Services (SaaS, professional services, tech subscriptions, home services like HVAC/plumbing)
- Debt Payments (loan payments, credit card payments, Bankers Healthcare Group, auto financing)
- Travel (hotels, flights, vacation rentals)
- Personal (pets, grooming, personal care, salon)
- Education (tuition, school meals, courses)
- Transfers (person-to-person: Zelle, Venmo, CashApp, bank transfers)
- Fees (bank fees, service charges)
- Bills (general recurring bills not fitting above)
- Other (cannot determine)

A merchant is_bill=true if it's a fixed recurring charge (subscriptions, insurance, utilities, memberships, loan payments). Variable spending like groceries, restaurants, gas, shopping, and one-time purchases are is_bill=false.

Respond with ONLY a JSON array. No explanation, no markdown, just the raw JSON:
[{"merchant": "NETFLIX", "category": "Entertainment", "is_bill": true}]`;

const BATCH_SIZE = 50;

export async function classifyMerchantsWithAI(
  merchantNames: string[]
): Promise<MerchantClassification[]> {
  if (merchantNames.length === 0) return [];

  try {
    const results: MerchantClassification[] = [];

    for (let i = 0; i < merchantNames.length; i += BATCH_SIZE) {
      const batch = merchantNames.slice(i, i + BATCH_SIZE);
      const numbered = batch.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

      console.log(`[AI Categorize] Classifying ${batch.length} merchants via Claude Haiku...`);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Classify these merchants:\n${numbered}` }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      // Extract JSON from response (handle possible markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('[AI Categorize] Could not extract JSON from response');
        continue;
      }

      let parsed: Array<{ merchant: string; category: string; is_bill: boolean }>;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn('[AI Categorize] Failed to parse JSON response');
        continue;
      }

      // Use index-based matching — always use original merchant name
      for (let j = 0; j < parsed.length && j < batch.length; j++) {
        const item = parsed[j];
        results.push({
          merchantName: batch[j], // Original name, not AI's version
          category: VALID_CATEGORIES.has(item.category) ? item.category : 'Other',
          isBill: Boolean(item.is_bill),
        });
      }

      console.log(`[AI Categorize] Batch classified: ${Math.min(parsed.length, batch.length)} merchants`);
    }

    return results;
  } catch (err: any) {
    console.warn('[AI Categorize] Failed to classify merchants, falling back to manual:', err.message || err);
    return [];
  }
}
