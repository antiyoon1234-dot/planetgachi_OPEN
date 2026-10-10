export type AuctionAverage = { item_type: string; display_name: string | null; avg_price: number; tx_count: number };
export type AuctionTransaction = {
  id: string | number; price: number; item_type: string; transaction_date: string;
  enhancement_level?: number | null; enchants?: unknown[] | null;
  item_info?: { displayName?: string | null; amount?: number; enchants?: unknown[] } | null;
};
export type AuctionAnomaly = {
  id: string | number; item_type: string; item_name: string; price: number;
  avg_price: number; diff_percent: number; transaction_date: string; detected?: boolean;
};
const keyFor = (type: string, name?: string | null) => JSON.stringify([type, name || '']);

// Compare unit prices without rounding; persist/display total prices consistently.
export function detectAuctionAnomalies(transactions: AuctionTransaction[], averages: AuctionAverage[], rate = 50, minimumSamples = 3): AuctionAnomaly[] {
  const threshold = Number.isFinite(rate) && rate > 0 ? rate : 50;
  const minimum = Number.isFinite(minimumSamples) && minimumSamples >= 1 ? minimumSamples : 3;
  const baselines = new Map(averages.map(row => [keyFor(row.item_type, row.display_name), row]));
  return transactions.flatMap(tx => {
    if (tx.enhancement_level != null || tx.enchants?.length || tx.item_info?.enchants?.length) return [];
    const baseline = baselines.get(keyFor(tx.item_type, tx.item_info?.displayName));
    const average = Number(baseline?.avg_price);
    const price = Number(tx.price);
    const amount = Number(tx.item_info?.amount ?? 1);
    if (!baseline || baseline.tx_count < minimum || !Number.isFinite(average) || average <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(amount) || amount <= 0) return [];
    const diff = (price / amount / average - 1) * 100;
    if (Math.abs(diff) + 1e-9 < threshold) return [];
    return [{ id: tx.id, item_type: tx.item_type, item_name: tx.item_info?.displayName || tx.item_type, price, avg_price: Math.round(average * amount), diff_percent: Math.round(diff), transaction_date: tx.transaction_date }];
  });
}

// Build a recent, outlier-resistant unit-price reference for each exact item variant.
// Do not round unit prices: 100 G / 64 is 1.5625 G, not 2 G or 0 G.
export function buildAuctionBaselines(transactions: AuctionTransaction[], rate = 20): AuctionAverage[] {
  const groups = new Map<string, { item_type: string; display_name: string | null; prices: number[] }>();
  const threshold = Number.isFinite(rate) && rate > 0 ? rate / 100 : 0.2;
  for (const tx of transactions) {
    if (tx.enhancement_level != null || tx.enchants?.length || tx.item_info?.enchants?.length) continue;
    const amount = Number(tx.item_info?.amount ?? 1);
    const price = Number(tx.price);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(price) || price < 0) continue;
    const key = keyFor(tx.item_type, tx.item_info?.displayName);
    const group = groups.get(key) ?? { item_type: tx.item_type, display_name: tx.item_info?.displayName || null, prices: [] };
    group.prices.push(price / amount);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const sorted = group.prices.sort((a,b) => a-b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
    const normal = sorted.filter(price => median === 0 ? price === 0 : Math.abs(price - median) / median <= threshold + 1e-9);
    const included = normal.length ? normal : sorted;
    return { item_type: group.item_type, display_name: group.display_name, avg_price: included.reduce((a,b) => a+b,0) / included.length, tx_count: included.length };
  });
}
