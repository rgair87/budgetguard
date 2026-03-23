# Runway App: Smart Budget Overhaul

## Philosophy
Stop showing scary abstract numbers ("daily burn rate $308"). Instead show people:
1. "Your bills are covered" (the #1 anxiety)
2. Where their spending money ACTUALLY goes (by category)
3. What they can specifically cut and how it extends their runway
4. Progress and wins to keep them motivated

## Changes

### Step 1: Types + Database
**Files:** `packages/shared/src/types.ts`, `apps/server/src/config/db.ts`

- Add `SpendingCategory` type: `{ name, monthlyAmount, budget?, isNecessity, runwayImpact? }`
- Update `PaycheckPlan.buckets.spending` to include `categories: SpendingCategory[]`
- Remove `actualDailyBurn` from the PaycheckPlan type (stop showing it to users)
- Add `spendingPace` field: `{ percentThroughMonth, percentBudgetUsed, onTrack }`
- Add `wins` field: `string[]` — celebrate small victories
- Add `billsCovered` field: `boolean` — the #1 confidence signal
- Add `merchant_categories` table in db.ts for remembering user's merchant classifications
- Add `needs_review` column migration to transactions table

### Step 2: Merchant Auto-Classification
**File:** `apps/server/src/services/paycheck.service.ts`

Build a default merchant→category map for common merchants:
- Starbucks, McDonald's, Chipotle, DoorDash → Restaurants
- Netflix, Spotify, Hulu, Disney+ → Entertainment
- Walmart, Target, Amazon → Shopping
- Shell, BP, Chevron → Transportation
- Whole Foods, Kroger, Trader Joe's, Aldi → Groceries

Also define necessity vs discretionary:
- **Necessities:** Groceries, Transportation, Housing, Utilities, Insurance, Healthcare, Phone/Internet
- **Discretionary (cuttable):** Restaurants, Entertainment, Shopping, Subscriptions, Personal Care, Travel

### Step 3: Spending Breakdown Service
**File:** `apps/server/src/services/paycheck.service.ts`

After calculating the spending bucket, query actual transactions by category:
1. Get all non-recurring spending from last 90 days
2. Apply merchant→category mapping (auto + user overrides from merchant_categories table)
3. Group by category, convert to monthly averages
4. Flag necessity vs discretionary
5. For each discretionary category, calculate runway impact: "If you cut this by 50%, you gain X days"
6. Calculate spending pace: day-of-month / 30 vs budget-used / budget-total
7. Detect wins: any category down from last month, or under budget

### Step 4: Transaction Review Endpoint
**File:** `apps/server/src/routes/runway.routes.ts`

- `GET /runway/review-merchants` — returns merchants with no category mapping (need user input)
- `POST /runway/classify-merchant` — user classifies a merchant, system saves to merchant_categories table
- On CSV import, auto-classify known merchants, flag unknowns

### Step 5: PaycheckPlan.tsx Rewrite
**File:** `apps/web/src/components/PaycheckPlan.tsx`

Replace the overspending section's "daily burn rate" display with a category breakdown:

**When on track:**
```
Your Spending Money                    $3,020/mo
├── Groceries              $400   (need)
├── Restaurants & takeout  $340   (can cut → +12 days)
├── Shopping               $200   (can cut → +8 days)
├── Entertainment          $120   (can cut → +5 days)
├── Transportation         $150   (need)
└── Other                  $810

💡 Cutting dining by half saves $170/mo → +12 days of runway
```

**When overspending:**
Instead of "you spend $308/day vs $187/day income," show:
```
⚠️ After bills, you have $1,900/mo — but you're spending $2,400
Here's where it's going:
├── Restaurants & takeout  $540   (budget: $200) ← over
├── Shopping               $380   (budget: none)
├── Entertainment          $280   (budget: $100) ← over
└── ...

Cut restaurants to budget → saves $340/mo → +15 more days
```

Also show:
- **Spending pace indicator**: "You're 50% through the month and 70% through your spending money. Slow down a bit."
- **Wins**: "You spent $40 less on dining this month vs last. That's 3 more days of runway."

### Step 6: RunwayScore.tsx Rewrite
**File:** `apps/web/src/components/RunwayScore.tsx`

- Replace "Avg Daily Spend" stat card with "Bills Covered" (✓ Yes / ✗ Need $X more)
- When status is red/yellow, coaching section shows category-specific cuts instead of generic "$10/day" math
- Remove daily burn rate number entirely from user-facing display

### Step 7: Home.tsx Updates
**File:** `apps/web/src/pages/Home.tsx`

- Add a "Review Transactions" banner when there are unclassified merchants
  - "We found 5 merchants we're not sure about. Quick tap to classify them."
  - Links to a simple review modal/inline component
- Add spending pace card between RunwayScore and PaycheckPlan

### Step 8: Merchant Review UI
**File:** `apps/web/src/pages/Home.tsx` (inline modal)

Simple classification UI:
- Shows merchant name + sample transaction amount
- Category buttons to tap: Groceries, Restaurants, Shopping, Entertainment, Bills, Transportation, Other
- "Is this a regular bill?" toggle
- System remembers, never asks again for that merchant

## What Makes This Stand Out

1. **Bills-first confidence** — "Your bills are covered ✓" is the primary signal. Every other app buries this.
2. **Category-level actionable cuts** — Not "reduce spending by $10/day" but "Cut DoorDash by half → 12 more days of runway"
3. **No scary burn rates** — We never show "$308/day" when most of that is rent hitting once a month
4. **Spending pace** — "You're halfway through the month but 70% through your spending money" is instantly understood
5. **Win tracking** — "You spent less on dining this month!" keeps people coming back
6. **One-time merchant classify** — Tap once, remembered forever. No manual tagging of every transaction.
7. **Smart defaults** — Auto-classifies 80% of merchants. Only asks about the ones it doesn't know.
