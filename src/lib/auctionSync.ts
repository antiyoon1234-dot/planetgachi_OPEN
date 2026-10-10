import { loadCatalogTransactions } from './loadCatalogTransactions';
import { supabase } from './supabase';
import { detectAuctionAnomalies, buildAuctionBaselines } from './auctionAnomalies';

const API_URL = import.meta.env.VITE_AUCTION_PROXY_URL || '';
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;
const CHUNK_SIZE = 50;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || '';


let syncPromise: Promise<void> | null = null;

export function syncAuctionTransactions() {
  if (!syncPromise) {
    syncPromise = (async () => {
      try {
        if (!API_URL || !ANON_KEY) {
          console.warn('거래소 동기화 설정이 없습니다. VITE_AUCTION_PROXY_URL과 VITE_SUPABASE_ANON_KEY를 설정하세요.');
          return;
        }
        const { data: configData } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'last_auction_update')
          .maybeSingle();

        let lastUpdate = 0;
        if (configData && configData.value) {
          lastUpdate = new Date(configData.value).getTime();
        }

        const now = Date.now();

        if (now - lastUpdate < UPDATE_INTERVAL_MS) {
          console.log('최근 15분 이내에 업데이트되었습니다. 동기화를 건너뜁니다.');
          return;
        }

        console.log('거래소 거래 내역을 동기화합니다...');

        const response = await fetch(API_URL, {
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`
          }
        });

        const text = await response.text();
        const result = JSON.parse(text);

        // 429 또는 FAILED 처리 (response.ok 체크 전에)
        if (result.status === 'FAILED') {
          const code = result.error?.code;
          if (code === 'RATE_LIMITED') {
            console.warn('거래소 API 요청 제한. 15분 후 재시도됩니다.');
            return;
          }
          throw new Error(`API 오류: ${result.error?.message}`);
        }

        if (!response.ok) {
          throw new Error(`API 호출 실패: ${response.status}`);
        }

        if (result.status !== 'SUCCESS' || !Array.isArray(result.data)) {
          throw new Error('API 응답 형식이 올바르지 않습니다.');
        }

        const apiTxIds = result.data.map((tx: any) => tx.id);

        const existingIds = new Set<string>();
        if (apiTxIds.length > 0) {
          for (let i = 0; i < apiTxIds.length; i += CHUNK_SIZE) {
            const chunk = apiTxIds.slice(i, i + CHUNK_SIZE);
            const { data: existingData, error: existingError } = await supabase
              .from('auction_transactions')
              .select('id')
              .in('id', chunk);
            if (!existingError && existingData) {
              existingData.forEach(d => existingIds.add(d.id));
            }
          }
        }


        const { data: pricingData, error: pricingError } = await supabase.from('market_settings').select('setting_value').eq('setting_key', 'pricing').maybeSingle();
        if (pricingError) throw pricingError;
        const pricing = pricingData?.setting_value ?? {};
        const history = await loadCatalogTransactions();
        const historicalById = new Map(history.map(tx => [String(tx.id), tx]));
        const transactions = [];
        const detectionRows = [];

        for (const tx of result.data) {
          const displayName = tx.itemInfo?.displayName || '';
          const itemType = tx.itemInfo?.type || 'unknown';

          let enhancementLevel = null;
          const enhanceMatch = displayName.match(/\[\+(\d+)\]/);
          if (enhanceMatch && enhanceMatch[1]) {
            enhancementLevel = parseInt(enhanceMatch[1], 10);
          }

          const allowedEnchants = ['minecraft:sharpness', 'minecraft:protection', 'minecraft:power'];
          let filteredEnchants: any[] = [];
          if (Array.isArray(tx.itemInfo?.enchants)) {
            filteredEnchants = tx.itemInfo.enchants.filter((e: any) =>
              allowedEnchants.includes(e.id)
            );
          }

          const txDate = new Date(tx.transaction_date);
          const transaction_date = isNaN(txDate.getTime())
            ? new Date().toISOString()
            : txDate.toISOString();

          const price = Number(tx.price);
          const parsedTx = {
            id: tx.id,
            price,
            transaction_date,
            item_type: itemType,
            enhancement_level: enhancementLevel,
            enchants: filteredEnchants.length > 0 ? filteredEnchants : null,
            item_info: tx.itemInfo
          };

          if (!existingIds.has(tx.id)) transactions.push(parsedTx);
          detectionRows.push(historicalById.get(String(tx.id)) ?? parsedTx);
        }
        const referenceRows = new Map(history.map(tx => [String(tx.id), tx]));
        for (const tx of detectionRows) referenceRows.set(String(tx.id), tx);
        const rate = Number(pricing.anomalyRate ?? 20);
        const averagePrices = buildAuctionBaselines([...referenceRows.values()], rate);
        const anomalies = detectAuctionAnomalies(detectionRows, averagePrices, rate, Number(pricing.minimumSamples ?? 3));

        // upsert 도 청크로 나눠서
        for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
          const chunk = transactions.slice(i, i + CHUNK_SIZE);
          const { error: upsertError } = await supabase
            .from('auction_transactions')
            .upsert(chunk, { onConflict: 'id' });
          if (upsertError) throw upsertError;
        }

        if (anomalies.length > 0) {
          for (let i = 0; i < anomalies.length; i += CHUNK_SIZE) {
            const chunk = anomalies.slice(i, i + CHUNK_SIZE);
            const { error: anomalyError } = await supabase
              .from('auction_anomalies')
              .upsert(chunk, { onConflict: 'id' });
            if (anomalyError) {
              throw anomalyError;
            }
          }
        }

        const { error: configError } = await supabase
          .from('system_config')
          .upsert({
            key: 'last_auction_update',
            value: new Date(now).toISOString()
          }, { onConflict: 'key' });

        if (configError) throw configError;
        console.log(`거래소 동기화 완료! ${transactions.length}건 새로 추가됨. 이상 거래 ${anomalies.length}건 발견.`);
      } catch (error) {
        console.error('거래소 동기화 중 오류 발생:', error);
      } finally {
        syncPromise = null;
      }
    })();
  }
  return syncPromise;
}
