// All currencies Frankfurter (ECB reference rates) supports — used by the
// correlation calculator so "alle Forex Pairs" isn't limited to the 8
// currencies with curated central-bank data (that dataset is only needed
// for the rate-differential pages; correlation just needs live FX prices).
export const TRADABLE_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
  'TRY', 'ZAR', 'MXN', 'BRL', 'INR', 'KRW', 'ILS', 'THB', 'IDR', 'PHP', 'MYR',
];

// Shared FX cross-rate math: Frankfurter gives rates vs. a single base
// currency; any pair's price is derivable from one fetch by treating the
// base's own rate as 1.
export function crossPrice(rates: Record<string, number>, base: string, a: string, b: string): number | null {
  const rateOf = (currency: string) => (currency === base ? 1 : rates[currency]);
  const rateA = rateOf(a);
  const rateB = rateOf(b);
  if (rateA === undefined || rateB === undefined) return null;
  return rateB / rateA;
}
