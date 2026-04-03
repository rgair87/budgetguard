// ─── Merchant name cleaning & normalization ──────────────────

const US_STATES = new Set(['TX','WA','CA','NY','FL','IL','PA','OH','GA','NC','MI','NJ','VA','AZ','MA','CO','WI','MN','MO','MD','IN','TN','OR','SC','KY','LA','OK','CT','IA','MS','AR','KS','NV','NM','NE','WV','ID','HI','ME','NH','RI','MT','DE','SD','ND','AK','VT','WY','DC']);

export function cleanMerchantName(raw: string): string {
  return raw
    // Strip transaction type prefixes
    .replace(/\s*(DEBIT CARD PURCHASE|DEBIT CARD CREDIT|RECURRING DEBIT CARD|POS DEBIT|POS PURCHASE|CHECKCARD|CHECK CARD|PURCHASE AUTHORIZED ON \d{2}\/\d{2})\s*/gi, '')
    .replace(/\s*(ACH WEB-?RECUR?|ACH WEB|ACH DEBIT|ACH CREDIT|ACH TEL|ACH DR|PPD ID:?\s*\S+|WEB ID:?\s*\S+)\s*/gi, '')
    .replace(/\s*(EXTERNAL WITHDRAWAL|EXTERNAL DEPOSIT|ONLINE PAYMENT|ONLINE TRANSFER|MOBILE PAYMENT)\s*/gi, '')
    .replace(/\s*(DIR DEP|DIRECT DEPOSIT|DIRECT DEP)\s*/gi, '')
    // Strip EFT/E-payment references
    .replace(/\s*E-?PAYMENT\d*/gi, '')
    .replace(/\s*EFT\s+\w+/gi, '')
    .replace(/\s*EZTAGSTPPD/gi, '')
    .replace(/\s*CKFPOS/gi, '')
    // Strip card numbers and masked digits (various formats)
    .replace(/\s*POSxxxx\d+\s*xxx\d+/gi, '')
    .replace(/x{3,}\d*/gi, '')
    .replace(/\d{12,16}/g, '')
    .replace(/\s*(CARD\s*\d+|\[PENDING\])/gi, '')
    .replace(/\s*VIS\s+\d{4}/gi, '')  // "VIS 0319" visa transaction refs
    // Strip store numbers like "#1071", "x0996", "*0232"
    .replace(/\s*[#x*]\d{3,6}/gi, '')
    .replace(/\s+\d{3,5}\b(?!\s*(ST|AVE|RD|BLVD|DR))/gi, '')  // trailing store numbers, not street addresses
    // Strip "SQ *", "SQSP*", "TST*" prefixes (Square, Squarespace, Toast payments)
    .replace(/^(SQ|SQSP|TST)\s*\*\s*/i, '')
    // Strip trailing phone numbers
    .replace(/\s+\d{3}-\d{3,}-?\d*\s+\w{2}\s*$/i, '')
    .replace(/\s+\d{3}-\d{3,4}-?\d{0,4}$/i, '')
    // Strip trailing dates
    .replace(/\s+\d{2}\/\d{2}$/i, '')
    // Strip trailing city + state like "CONROE TX" or "WILLIS TX"
    .replace(/\s+[A-Z][a-z]+\s+([A-Z]{2})\s*$/i, (match, state) => {
      return US_STATES.has(state.toUpperCase()) ? '' : match;
    })
    // Strip ALL CAPS city + state like "CONROE TX"
    .replace(/\s+[A-Z]{3,}\s+([A-Z]{2})\s*$/i, (match, state) => {
      return US_STATES.has(state.toUpperCase()) ? '' : match;
    })
    // Strip trailing bare state codes
    .replace(/\s+([A-Z]{2})\s*$/i, (match, state) => {
      return US_STATES.has(state.toUpperCase()) ? '' : match;
    })
    // Strip trailing transaction reference numbers
    .replace(/\s+#\S+$/i, '')
    .replace(/\s+REF\s*#?\s*\S+$/i, '')
    // Strip trailing alphanumeric reference codes (like "3vvae", "P2ALF")
    // Only strip if it contains digits or is all-uppercase (looks like a code, not a word)
    .replace(/\s+(?=[A-Z0-9]*\d)[A-Z0-9]{4,8}$/i, '')
    // Collapse whitespace and trim
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Normalize merchant name for grouping (maps common variants to same name)
const MERCHANT_ALIASES: [RegExp, string][] = [
  [/^capital\s*one/i, 'Capital One'],
  [/^chase/i, 'Chase'],
  [/^amazon/i, 'Amazon'],
  [/^walmart/i, 'Walmart'],
  [/^target/i, 'Target'],
  [/^shell\s*oil/i, 'Shell'],
  [/^kohls?/i, "Kohl's"],
  [/^lowes?/i, "Lowe's"],
  [/^torchys?/i, "Torchy's Tacos"],
  [/^cvs/i, 'CVS Pharmacy'],
  [/^walgreen/i, 'Walgreens'],
  [/^starbuck/i, 'Starbucks'],
  [/^mcdonald/i, "McDonald's"],
  [/^chick-?fil/i, 'Chick-fil-A'],
  [/^home\s*depot/i, 'Home Depot'],
  [/^costco/i, 'Costco'],
  [/^kroger/i, 'Kroger'],
  [/^heb\b/i, 'HEB'],
  [/^rack\s*room/i, 'Rack Room Shoes'],
  [/^kfc\b/i, 'KFC'],
  [/^paypal/i, 'PayPal'],
  [/^venmo/i, 'Venmo'],
  [/^zelle/i, 'Zelle'],
  [/^nextier/i, 'NextTier'],
  [/^fid\s*bkg/i, 'Fidelity'],
  [/^irs\s*treas/i, 'IRS Treasury'],
  [/^oil\s*ranch/i, 'Oil Ranch'],
  [/^hctra/i, 'HCTRA Toll'],
  [/^discover/i, 'Discover'],
  [/^bank\s*of\s*america/i, 'Bank of America'],
  [/^wells?\s*fargo/i, 'Wells Fargo'],
  [/^usaa/i, 'USAA'],
  [/^navy\s*fed/i, 'Navy Federal'],
  [/^(jp\s*)?morgan\s*chase/i, 'Chase'],
  [/^headway/i, 'Headway'],
  [/^cpenergy|^centerpoint/i, 'CenterPoint Energy'],
  [/^entex/i, 'CenterPoint Energy'],
  [/^squarespace|^sqsp/i, 'Squarespace'],
  [/^manscap/i, 'Manscaped'],
  [/^burger\s*king/i, 'Burger King'],
  [/^whataburger/i, 'Whataburger'],
  [/^best\s*buy/i, 'Best Buy'],
  [/^apple\.com|^apple\s/i, 'Apple'],
  [/^netflix/i, 'Netflix'],
  [/^spotify/i, 'Spotify'],
  [/^google\s/i, 'Google'],
  [/^microsoft/i, 'Microsoft'],
  [/^sofi/i, 'SoFi'],
  [/^riverstone/i, 'Riverstone'],
];

export function normalizeMerchantName(cleaned: string): string {
  for (const [pattern, name] of MERCHANT_ALIASES) {
    if (pattern.test(cleaned)) return name;
  }
  return cleaned;
}

// Title case a cleaned merchant name
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase())
    // Keep known acronyms uppercase
    .replace(/\b(Cvs|Heb|Usps|Ups|Atm|Ach|Kfc)\b/gi, m => m.toUpperCase());
}
