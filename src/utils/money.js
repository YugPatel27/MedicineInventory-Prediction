// Shared, crash-proof currency formatter.
//
// Several screens (Cart, Checkout, Orders, Order Detail / Invoice) called
// `.toFixed(2)` directly on values coming from the cart, the API, or a
// medicine's `unit_price`. If any one of those was ever missing, null, or
// not-yet-loaded (e.g. a medicine imported from CSV with a blank price
// column, or a legacy order document), `.toFixed` would throw
// "Cannot read properties of undefined (reading 'toFixed')". Because the
// app has no error boundary, that exception unmounts the whole page —
// which is exactly what "the invoice is not visible" looks like from the
// outside: a blank panel instead of the invoice.
//
// `formatMoney` never throws: anything that isn't a finite number is
// treated as 0.
export function formatMoney(currencySymbol, value) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return `${currencySymbol}${safe.toFixed(2)}`;
}

// Same idea, without the currency symbol prefix — useful inside the PDF
// where jsPDF/autoTable just wants plain strings.
export function safeFixed(value, digits = 2) {
  const num = Number(value);
  return (Number.isFinite(num) ? num : 0).toFixed(digits);
}

// Invoice-specific formatter: "Rs." (text) in place of the ₹ symbol,
// since jsPDF's built-in "helvetica" font has no glyph for ₹ and leading
// an amount with it prints as a broken/empty box in the generated PDF.
// "Rs." reads unambiguously as rupees without that rendering problem. The
// on-screen invoice preview uses the same formatter so the two never
// drift apart. Non-rupee symbols (already safe in both contexts) are left
// exactly as passed in.
export function formatInvoiceMoney(currencySymbol, value) {
  const amount = safeFixed(value);
  const label = currencySymbol === '₹' ? 'Rs.' : currencySymbol;
  return `${label}${amount}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`;
}

function threeDigitWords(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return twoDigitWords(rest);
  return `${ONES[h]} Hundred${rest ? ' and ' + twoDigitWords(rest) : ''}`;
}

// Converts a rupee amount into the words line printed on Indian tax
// invoices, e.g. 1234.5 -> "One Thousand Two Hundred and Thirty Four
// Rupees and Fifty Paise Only". Never throws on a missing/odd value.
export function amountToWords(value) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? Math.abs(num) : 0;
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundreds = n;

  const segments = [];
  if (crore) segments.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) segments.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) segments.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundreds) segments.push(threeDigitWords(hundreds));

  let words = `${segments.join(' ')} Rupees`;
  if (paise > 0) words += ` and ${twoDigitWords(paise)} Paise`;
  return `${words} Only`;
}
