import { supabase } from './supabase';
import type { AuctionTransaction } from './auctionAnomalies';
export async function loadCatalogTransactions(): Promise<AuctionTransaction[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();
  const rows: AuctionTransaction[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('auction_transactions')
      .select('id,item_type,price,item_info,transaction_date,enhancement_level,enchants').gte('transaction_date', since).lte('transaction_date', until)
      .order('transaction_date', { ascending: false }).order('id', { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
