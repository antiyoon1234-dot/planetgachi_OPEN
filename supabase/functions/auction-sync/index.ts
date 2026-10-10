import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RemoteTransaction = {
  id: number | string;
  price: number;
  transaction_date?: string;
  itemInfo?: { type?: string; displayName?: string; amount?: number; lore?: string[]; enchants?: unknown[] };
};
type StoredTransaction = { id: number; price: number; item_type: string; item_info: { displayName?: string; amount?: number }; transaction_date: string };

const floorToHundreds = (value: number) => Math.floor(value / 100) * 100;
const unitPrice = (row: StoredTransaction) => Number(row.price) / Math.max(1, Number(row.item_info?.amount ?? 1));

const corsHeaders = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
const keyFor = (itemType: string, displayName: string) => `${itemType}::${displayName}`;

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get('AUCTION_SYNC_SECRET');
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiUrl = Deno.env.get('MARKET_API_URL') ?? 'https://api.planetearth.kr/auction/list';
  const token = Deno.env.get('MARKET_API_TOKEN');
  const apiResponse = await fetch(apiUrl, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!apiResponse.ok) return new Response(JSON.stringify({ error: `market api failed: ${apiResponse.status}` }), { status: 502, headers: corsHeaders });

  const payload = await apiResponse.json();
  const remoteRows: RemoteTransaction[] = Array.isArray(payload) ? payload : payload.data;
  if (!Array.isArray(remoteRows)) return new Response(JSON.stringify({ error: 'unexpected market API response' }), { status: 502, headers: corsHeaders });

  const transactions = remoteRows
    .filter((row) => Number.isFinite(Number(row.id)) && Number.isFinite(Number(row.price)) && row.itemInfo?.type)
    .map((row) => ({
      id: Number(row.id), price: floorToHundreds(Number(row.price)), transaction_date: row.transaction_date ?? new Date().toISOString(),
      item_type: row.itemInfo!.type!, enhancement_level: null, enchants: row.itemInfo?.enchants ?? null, item_info: row.itemInfo,
    }));
  if (transactions.length) {
    const { error } = await client.from('auction_transactions').upsert(transactions, { onConflict: 'id' });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: sevenDayRows, error: rowsError }, { data: rules }, { data: config }] = await Promise.all([
    client.from('auction_transactions').select('id,price,item_type,item_info,transaction_date').gte('transaction_date', since),
    client.from('auction_price_rules').select('item_type,price_cap,include_anomalies'),
    client.from('market_settings').select('setting_key,setting_value').eq('setting_key', 'pricing').maybeSingle(),
  ]);
  if (rowsError) return new Response(JSON.stringify({ error: rowsError.message }), { status: 500, headers: corsHeaders });
  const pricing = (config?.setting_value ?? {}) as { anomalyRate?: number; minimumSamples?: number };
  const anomalyRate = Number(pricing.anomalyRate ?? 50) / 100;
  const minimumSamples = Number(pricing.minimumSamples ?? 5);
  const ruleByType = new Map((rules ?? []).map((rule) => [rule.item_type, rule]));
  const groups = new Map<string, StoredTransaction[]>();
  for (const row of (sevenDayRows ?? []) as StoredTransaction[]) {
    const displayName = row.item_info?.displayName ?? row.item_type;
    const key = keyFor(row.item_type, displayName);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const prices = [];
  const anomalies = [];
  for (const [key, rows] of groups) {
    const first = rows[0];
    const displayName = first.item_info?.displayName ?? first.item_type;
    const rule = ruleByType.get(first.item_type);
    const rawAverage = rows.reduce((sum, row) => sum + unitPrice(row), 0) / rows.length;
    const normalRows = rows.filter((row) => Math.abs(unitPrice(row) - rawAverage) / rawAverage <= anomalyRate);
    const includedRows = rule?.include_anomalies ? rows : normalRows;
    const average = includedRows.length >= minimumSamples ? floorToHundreds(includedRows.reduce((sum, row) => sum + unitPrice(row), 0) / includedRows.length) : null;
    if (!rule?.include_anomalies) for (const row of rows.filter((row) => !normalRows.includes(row))) anomalies.push({ id: row.id, item_type: row.item_type, item_name: displayName, price: floorToHundreds(unitPrice(row)), avg_price: floorToHundreds(rawAverage), diff_percent: Math.round((unitPrice(row) / rawAverage - 1) * 100), transaction_date: row.transaction_date });
    prices.push({ item_key: key, item_type: first.item_type, display_name: displayName, auction_average_price: average, display_price: average === null ? null : Math.min(average, rule?.price_cap ?? average), transaction_count: includedRows.length, excluded_anomaly_count: rows.length - normalRows.length, price_cap: rule?.price_cap ?? null, calculated_at: new Date().toISOString() });
  }
  if (anomalies.length) await client.from('auction_anomalies').upsert(anomalies, { onConflict: 'id' });
  if (prices.length) await client.from('auction_market_prices').upsert(prices, { onConflict: 'item_key' });
  return new Response(JSON.stringify({ synced: transactions.length, prices: prices.length, anomalies: anomalies.length }), { headers: corsHeaders });
});
