import { useState, useEffect, useCallback } from "react";
import { Loader2, Package, Search, ChevronLeft, ChevronRight, Clock, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { syncAuctionTransactions } from "../../lib/auctionSync";
import { getItemName, searchItemTypes } from "../../lib/itemNames";

const floorToHundreds = (value: number) => Math.floor(Number(value) / 100) * 100;

type CatalogItem = { code: string; name: string };

function itemCodeKey(value: string) {
  return value
    .toLowerCase()
    .replace("minecraft:", "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

function itemNameKey(value: string) {
  return value
    .toLowerCase()
    .replaceAll("블럭", "블록")
    .replace(/[^a-z0-9가-힣]/g, "");
}

export default function AuctionPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [averagePrices, setAveragePrices] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const ITEMS_PER_PAGE = 30;

  const loadAveragePrices = async () => {
    try {
      const { data, error } = await supabase.from("auction_average_prices").select("*");
      if (error) throw error;

      const priceMap: Record<string, number> = {};
      data?.forEach((row: any) => {
        const displayNameStr = row.display_name || '';
        const key = row.probability ? `${row.item_type}_${displayNameStr}_${row.probability}` : `${row.item_type}_${displayNameStr}`;
        priceMap[key] = floorToHundreds(Number(row.avg_price));
      });
      setAveragePrices(priceMap);
    } catch (error) {
      console.error("평균가 로드 실패:", error);
    }
  };

  const loadCatalogItems = async () => {
    try {
      const { data, error } = await supabase.from("items").select("code,name");
      if (error) throw error;
      setCatalogItems((data ?? []) as CatalogItem[]);
    } catch (error) {
      console.error("품목 코드 로드 실패:", error);
    }
  };

  const getCatalogItem = (transaction: any) => {
    const byCode = catalogItems.find(
      (item) => itemCodeKey(item.code) === itemCodeKey(transaction.item_type),
    );
    if (byCode) return byCode;

    const apiName =
      transaction.item_info?.displayName?.trim() || getItemName(transaction.item_type);
    return catalogItems.find(
      (item) => itemNameKey(item.name) === itemNameKey(apiName),
    );
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("auction_transactions")
        .select("*", { count: "exact" })
        .order("transaction_date", { ascending: false });

      if (searchQuery) {
        // 한글 이름 매핑에서 매칭되는 item_type ID 목록 검색
        const matchedItemTypes = searchItemTypes(searchQuery);

        if (matchedItemTypes.length > 0) {
          // 한글 매핑 결과가 있으면 item_type IN 필터 + 기존 텍스트 검색 결합
          const orFilters = [
            `item_type.ilike.%${searchQuery}%`,
            `item_info->>displayName.ilike.%${searchQuery}%`,
            `item_type.in.(${matchedItemTypes.join(',')})`
          ];
          query = query.or(orFilters.join(','));
        } else {
          // 한글 매핑 결과가 없으면 기존 텍스트 검색만
          query = query.or(`item_type.ilike.%${searchQuery}%,item_info->>displayName.ilike.%${searchQuery}%`);
        }
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      setTransactions(data || []);
      if (count !== null) setTotalCount(count);
    } catch (error) {
      console.error("거래소 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    loadAveragePrices();
    loadCatalogItems();
    
    // 백그라운드 동기화 (페이지네이션과 무관하게 최초 1회 및 1분마다 체크, 실제 API 호출은 15분마다 내부적으로 제한됨)
    const runSync = async () => {
      try {
        await syncAuctionTransactions();
      } catch (error) {
        console.error("동기화 중 오류 발생:", error);
      }
    };
    runSync();
    
    const interval = setInterval(runSync, 60000); // 1분마다 체크
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 딜레이를 주어 타이핑마다 API 호출되는 것을 방지
    const debounce = setTimeout(() => {
      loadTransactions();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadTransactions]);

  // 실시간 구독 로직 추가
  useEffect(() => {
    const channel = supabase
      .channel('auction-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_transactions',
        },
        (payload) => {
          // 1페이지이고 검색어가 없을 때만 새 내역을 맨 앞에 추가
          if (page === 1 && !searchQuery) {
            setTransactions((prev) => {
              // 이미 존재하는 ID인지 확인하여 중복 방지
              if (prev.some((tx) => tx.id === payload.new.id)) return prev;
              const newTransactions = [payload.new, ...prev];
              // 한 페이지의 최대 갯수 유지
              return newTransactions.slice(0, ITEMS_PER_PAGE);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getEnhanceColor = (level: number) => {
    if (level >= 8) return "text-fuchsia-400";
    if (level >= 5) return "text-amber-400";
    if (level >= 3) return "text-emerald-400";
    return "text-lime-400";
  };

  const formatEnchantName = (id: string) => {
    const name = id.split(':')[1] || id;
    const translations: Record<string, string> = {
      sharpness: "날카로움",
      protection: "보호",
      power: "힘"
    };
    return translations[name] || name;
  };

  const maxPage = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let start = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let end = start + maxVisiblePages - 1;
    
    if (end > maxPage) {
      end = maxPage;
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] bg-stone-800 flex-col items-center py-6 px-4">
      <div className="w-full max-w-5xl space-y-4">
        {/* Header */}
        <div className="bg-stone-900 border-4 border-stone-950 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl text-lime-400 font-bold font-pixel flex items-center gap-2">
              <TrendingUp className="size-6" />
              거래소 거래 내역
              {totalCount > 0 && <span className="text-sm text-stone-500 font-sans ml-2 mt-1">({totalCount.toLocaleString()}건)</span>}
            </h1>
            <p className="text-stone-400 text-sm mt-1">거래소 거래 기록입니다 (15분마다 새로고침 됩니다.)</p>
          </div>
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-500" />
            <input
              type="text"
              placeholder="아이템 이름/타입 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-800 border-2 border-stone-700 text-white placeholder:text-stone-500 text-sm focus:outline-none focus:border-lime-600 font-bold"
            />
          </div>
        </div>

        {/* Content */}
        {loading && page === 1 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 text-lime-400 animate-spin" />
          </div>
        ) : transactions.length > 0 ? (
          <div className="bg-stone-900 border-4 border-stone-950 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b-4 border-stone-950 bg-stone-950/50">
                  <th className="px-5 py-4 text-stone-500 text-sm font-bold">아이템</th>
                  <th className="px-5 py-4 text-stone-500 text-sm font-bold">강화/인챈트</th>
                  <th className="px-5 py-4 text-stone-500 text-sm font-bold text-right">거래 가격</th>
                  <th className="px-5 py-4 text-stone-500 text-sm font-bold text-right">거래소 평균 시세</th>
                  <th className="px-5 py-4 text-stone-500 text-sm font-bold text-right">거래 일시</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const catalogItem = getCatalogItem(tx);
                  return (
                  <tr key={tx.id} className="border-b-2 border-stone-950 last:border-b-0 hover:bg-stone-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-stone-800 border-2 border-stone-700 flex items-center justify-center shrink-0">
                          {tx.item_info?.amount && tx.item_info.amount > 1 && (
                            <span className="absolute -bottom-1 -right-1 text-[10px] bg-stone-900 px-1 font-bold text-white border border-stone-700">
                              x{tx.item_info.amount}
                            </span>
                          )}
                          <Package className="size-5 text-stone-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">
                            {catalogItem?.name ??
                              (tx.item_info?.displayName ||
                                getItemName(tx.item_type))}
                          </p>
                          <p className="text-xs text-stone-500 truncate max-w-[200px]">
                            {catalogItem?.code ?? "DB 미등록"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        {tx.enhancement_level !== null && (
                          <span className={`text-sm font-bold ${getEnhanceColor(tx.enhancement_level)}`}>
                            [+{tx.enhancement_level}]
                          </span>
                        )}
                        {tx.item_info?.lore?.some((l: string) => l.includes("확률 보너스")) && (
                          <span className="text-sm font-bold text-fuchsia-400">
                            {tx.item_info.lore.find((l: string) => l.includes("확률 보너스"))?.replace(/§[0-9a-fk-or]/g, '').replace("확률 보너스", "확률")}
                          </span>
                        )}
                        {tx.enchants && tx.enchants.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tx.enchants.map((e: any, i: number) => (
                              <span key={i} className="text-[10px] bg-stone-800 border border-stone-700 px-1.5 py-0.5 text-stone-300 rounded-sm">
                                {formatEnchantName(e.id)} {e.level}
                              </span>
                            ))}
                          </div>
                        )}
                        {tx.enhancement_level === null && (!tx.enchants || tx.enchants.length === 0) && (!tx.item_info?.lore?.some((l: string) => l.includes("확률 보너스"))) && (
                          <span className="text-xs text-stone-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-amber-400 font-bold font-pixel text-lg">{floorToHundreds(tx.price).toLocaleString()} 원</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-emerald-400 font-bold font-pixel text-lg">
                        {(() => {
                           const probMatch = tx.item_info?.lore?.find((l: string) => l.includes("확률 보너스"));
                           const prob = probMatch ? probMatch.match(/확률 보너스:\s*([\d.]+)%/)?.[1] : null;
                           const displayNameStr = tx.item_info?.displayName || '';
                           const key = prob ? `${tx.item_type}_${displayNameStr}_${prob}` : `${tx.item_type}_${displayNameStr}`;
                           return averagePrices[key]
                             ? `${floorToHundreds(averagePrices[key] * (tx.item_info?.amount || 1)).toLocaleString()} 원`
                             : '-';
                        })()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs text-stone-400">
                        <Clock className="size-3.5" />
                        {formatDate(tx.transaction_date)}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-stone-900 border-4 border-stone-950 p-12 text-center">
            <Package className="size-12 text-stone-600 mx-auto mb-4" />
            <h3 className="text-xl text-white font-bold mb-2">거래 내역이 없습니다</h3>
            <p className="text-stone-400">최근에 거래된 아이템이 없거나 검색 결과가 없습니다.</p>
          </div>
        )}

        {/* Pagination */}
        {transactions.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between bg-stone-900 border-4 border-stone-950 p-4 gap-4">
            
            {/* Direct Input */}
            <div className="flex items-center gap-2">
              <span className="text-stone-400 text-sm font-bold">페이지 이동:</span>
              <input 
                type="number"
                min={1}
                max={maxPage}
                className="w-16 px-2 py-1.5 bg-stone-800 border-2 border-stone-700 text-white text-center font-bold focus:outline-none focus:border-lime-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt(e.currentTarget.value);
                    if (!isNaN(val) && val >= 1 && val <= maxPage) {
                      setPage(val);
                      e.currentTarget.value = '';
                    }
                  }
                }}
                placeholder={page.toString()}
              />
              <span className="text-stone-500 text-sm font-bold">/ {maxPage}</span>
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-stone-700 text-white font-bold flex items-center transition-colors"
                title="첫 페이지"
              >
                <ChevronLeft className="size-4" />
                <ChevronLeft className="size-4 -ml-2" />
              </button>
              
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-stone-700 text-white font-bold transition-colors"
                title="이전 페이지"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center mx-1 gap-1">
                {getPageNumbers().map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[40px] h-10 px-2 border-2 font-bold transition-colors flex items-center justify-center ${
                      page === pageNum 
                        ? 'bg-lime-600 border-lime-400 text-white' 
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page >= maxPage}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-stone-700 text-white font-bold transition-colors"
                title="다음 페이지"
              >
                <ChevronRight className="size-4" />
              </button>
              
              <button
                onClick={() => setPage(maxPage)}
                disabled={page >= maxPage}
                className="p-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-stone-700 text-white font-bold flex items-center transition-colors"
                title="마지막 페이지"
              >
                <ChevronRight className="size-4 -mr-2" />
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
