export type CatalogTransaction = {
  item_type: string; price: number;
  item_info?: { amount?: number; displayName?: string | null } | null;
};
export const marketKey = (value: string) => value.toLowerCase().replace('minecraft:', '').replaceAll('블럭', '블록').replace(/[^a-z0-9가-힣]/g, '');

export function catalogAverage(item: { code: string; name: string }, rows: CatalogTransaction[], unitAmount: number) {
  const name = marketKey(item.name);
  const code = marketKey(item.code);
  const named = rows.filter(row => row.item_info?.displayName?.trim() && marketKey(row.item_info.displayName) === name);
  // A named custom item must never become the fallback for its base material.
  const matches = named.length ? named : rows.filter(row => marketKey(row.item_type) === code &&
    (!row.item_info?.displayName?.trim() || marketKey(row.item_info.displayName) === code));
  const prices = matches.flatMap(row => {
    const amount = Number(row.item_info?.amount ?? 1);
    const price = Number(row.price);
    return Number.isFinite(amount) && amount > 0 && Number.isFinite(price) && price >= 0 ? [price / amount * unitAmount] : [];
  }).sort((a,b) => a-b);
  if (!prices.length) return { average: null, samples: 0, total: 0 };
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : (prices[middle-1] + prices[middle]) / 2;
  const normal = prices.filter(price => median === 0 || Math.abs(price - median) / median <= 0.2 + 1e-9);
  const included = normal.length ? normal : prices;
  return { average: Math.round(included.reduce((sum, price) => sum + price, 0) / included.length), samples: included.length, total: prices.length };
}
