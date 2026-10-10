import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, type Item, type ValueHistory } from '../../lib/supabase';
import { Package, Clock, TrendingUp } from 'lucide-react';

const floorToHundreds = (value: number) => Math.floor(Number(value) / 100) * 100;

const ItemAuctionHistory = ({ itemType }: { itemType: string }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enhanceFilter, setEnhanceFilter] = useState<number | null>(null);
  const [enchantFilter, setEnchantFilter] = useState<string | null>(null);

  useEffect(() => {
    const loadTransactions = async () => {
      setLoading(true);
      try {
        let searchType = itemType.toLowerCase();
        if (!searchType.startsWith('minecraft:')) {
          searchType = `minecraft:${searchType}`;
        }

        let fetchQuery = supabase
          .from('auction_transactions')
          .select('*')
          .ilike('item_type', searchType)
          .order('transaction_date', { ascending: false })
          .limit(50);

        if (enhanceFilter !== null) {
          fetchQuery = fetchQuery.eq('enhancement_level', enhanceFilter);
        }

        const { data, error } = await fetchQuery;
        if (error) throw error;

        let filtered = data || [];
        if (enchantFilter !== null) {
          filtered = filtered.filter((tx: any) =>
            tx.enchants?.some((e: any) => e.id === enchantFilter)
          );
        }

        setTransactions(filtered.slice(0, 5)); // 최신 5개만 표시
      } catch (error) {
        console.error('거래소 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [itemType, enhanceFilter, enchantFilter]);

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

  return (
    <div className="bg-stone-900 border-4 border-stone-950 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-amber-400" />
          최근 거래소 거래
        </h3>

        <div className="flex flex-wrap gap-2">
          <select
            className="bg-stone-800 border-2 border-stone-700 text-stone-300 text-sm py-1 px-2 focus:outline-none focus:border-lime-600 font-bold"
            value={enhanceFilter === null ? "" : enhanceFilter.toString()}
            onChange={(e) => setEnhanceFilter(e.target.value === "" ? null : parseInt(e.target.value))}
          >
            <option value="">강화 전체</option>
            {Array.from({ length: 35 }, (_, i) => i + 1).map(level => (
              <option key={level} value={level}>+{level}</option>
            ))}
          </select>
          <select
            className="bg-stone-800 border-2 border-stone-700 text-stone-300 text-sm py-1 px-2 focus:outline-none focus:border-lime-600 font-bold"
            value={enchantFilter === null ? "" : enchantFilter}
            onChange={(e) => setEnchantFilter(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">인챈트 전체</option>
            <option value="minecraft:sharpness">날카로움</option>
            <option value="minecraft:protection">보호</option>
            <option value="minecraft:power">힘</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <i className="ri-loader-4-line text-3xl text-lime-400 animate-spin inline-block"></i>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 bg-stone-800 border-2 border-stone-700">
          <Package className="size-8 text-stone-600 mx-auto mb-2" />
          <p className="text-stone-400 text-sm">해당 조건의 거래 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-stone-800 border-l-4 border-stone-700 hover:border-lime-500 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {tx.enhancement_level !== null ? (
                    <span className={`text-sm font-bold ${getEnhanceColor(tx.enhancement_level)}`}>
                      [+{tx.enhancement_level}]
                    </span>
                  ) : tx.item_info?.lore?.some((l: string) => l.includes("확률 보너스")) ? (
                    <span className="text-sm font-bold text-fuchsia-400">
                      {tx.item_info.lore.find((l: string) => l.includes("확률 보너스"))?.replace(/§[0-9a-fk-or]/g, '').replace("확률 보너스", "확률")}
                    </span>
                  ) : (
                    <span className="text-sm text-stone-400 font-bold">기본</span>
                  )}
                  {tx.enchants && tx.enchants.length > 0 && (
                    <div className="flex gap-1">
                      {tx.enchants.map((e: any, i: number) => (
                        <span key={i} className="text-[10px] bg-stone-900 border border-stone-700 px-1 text-stone-300 rounded-sm">
                          {formatEnchantName(e.id)} {e.level}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Clock className="size-3" />
                  {formatDate(tx.transaction_date)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-amber-400 font-bold font-pixel block">{floorToHundreds(tx.price).toLocaleString()} 원</span>
                {tx.item_info?.amount > 1 && (
                  <span className="text-[10px] text-stone-500 block">x{tx.item_info.amount} 묶음</span>
                )}
              </div>
            </div>
          ))}
          <a href="/auction" className="block w-full text-center text-xs text-stone-400 hover:text-lime-400 mt-4 py-2 border border-dashed border-stone-700 hover:border-lime-500 transition-colors">
            거래소 전체 내역 보기
          </a>
        </div>
      )}
    </div>
  );
};

// 간단한 라인 차트 컴포넌트
const ValueChart = ({ history }: { history: ValueHistory[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || history.length === 0) {
      console.log('차트 렌더링 조건 미충족:', {
        canvas: !!canvasRef.current,
        container: !!containerRef.current,
        historyLength: history.length
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context를 가져올 수 없습니다');
      return;
    }

    console.log('차트 렌더링 시작, 데이터 개수:', history.length);

    // 캔버스 크기 설정
    const container = containerRef.current;
    const dpr = window.devicePixelRatio || 1;
    const containerWidth = container.clientWidth;
    const containerHeight = 300; // 높이 증가

    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    ctx.scale(dpr, dpr);

    const width = containerWidth;
    const height = containerHeight;
    const padding = { top: 30, right: 30, bottom: 50, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 배경 초기화
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, width, height);

    // 데이터 정렬 (오래된 순)
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    );

    console.log('정렬된 히스토리:', sortedHistory.map(h => ({ value: h.value, date: h.changed_at })));

    const values = sortedHistory.map(h => h.value);
    const minValue = Math.min(...values) * 0.9;
    const maxValue = Math.max(...values) * 1.1;
    const valueRange = maxValue - minValue || 1;

    console.log('값 범위:', { minValue, maxValue, valueRange });

    // 그리드 라인
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y축 레이블
      const value = maxValue - (valueRange / gridLines) * i;
      ctx.fillStyle = '#a8a29e';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(value).toLocaleString(), padding.left - 10, y);
    }

    // 데이터 포인트 계산
    const points = sortedHistory.map((h, i) => {
      const x = padding.left + (chartWidth / Math.max(sortedHistory.length - 1, 1)) * i;
      const y = padding.top + chartHeight - ((h.value - minValue) / valueRange) * chartHeight;
      return {
        x,
        y,
        value: h.value,
        date: new Date(h.changed_at),
      };
    });

    console.log('계산된 포인트:', points);

    // 그라데이션 영역
    if (points.length > 0) {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
      gradient.addColorStop(0, 'rgba(132, 204, 22, 0.3)');
      gradient.addColorStop(1, 'rgba(132, 204, 22, 0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding.bottom);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 라인 그리기
    if (points.length > 0) {
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // 포인트 그리기
    points.forEach((p, i) => {
      // 외곽 원
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1917';
      ctx.fill();
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 내부 원
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#84cc16';
      ctx.fill();

      // X축 날짜 레이블
      if (points.length <= 5 || i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) {
        ctx.fillStyle = '#a8a29e';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const dateStr = `${p.date.getMonth() + 1}/${p.date.getDate()}`;
        ctx.fillText(dateStr, p.x, height - padding.bottom + 10);
      }
    });

    console.log('차트 렌더링 완료');

  }, [history]);

  if (history.length === 0) {
    return (
      <div className="bg-stone-900 border-4 border-stone-950 p-8 text-center">
        <i className="ri-line-chart-line text-5xl text-stone-600 mb-3"></i>
        <p className="text-stone-400 text-lg">가치 변동 데이터가 없습니다</p>
        <p className="text-stone-500 text-sm mt-2">아이템이 등록되면 그래프가 표시됩니다</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-stone-900 border-4 border-stone-950 p-6">
      <canvas ref={canvasRef} className="w-full" style={{ display: 'block' }} />
    </div>
  );
};

// 가격 계산기 컴포넌트
const PriceCalculator = ({ item }: { item: Item }) => {
  const [quantity, setQuantity] = useState(1);

  const unitCount = item.unit_type === 'stack' ? 64 : item.unit_type === 'set' ? 16 : 1;
  const pricePerOne = item.current_value / unitCount;
  const calculatedPrice = pricePerOne * quantity;

  return (
    <div className="bg-stone-800 border-2 border-stone-700 rounded-lg p-4 mt-4">
      <h4 className="text-white font-bold mb-3 flex items-center gap-2">
        <i className="ri-calculator-line text-amber-400"></i>
        가격 계산기
      </h4>

      {/* 1개당 가격 표시 */}
      <div className="bg-stone-900 rounded-lg p-3 mb-3">
        <p className="text-xs text-stone-400 mb-1">1개당 가격</p>
        <p className="text-xl font-bold text-amber-400">
          {pricePerOne % 1 === 0 ? pricePerOne.toLocaleString() : pricePerOne.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {unitCount > 1 && (
          <p className="text-xs text-stone-500 mt-1">
            ({item.current_value.toLocaleString()} ÷ {unitCount}개)
          </p>
        )}
      </div>

      {/* 수량 입력 */}
      <div className="mb-3">
        <label className="text-xs text-stone-400 mb-1 block">원하는 수량</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 bg-stone-700 text-white font-bold hover:bg-stone-600 transition-colors cursor-pointer"
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
            className="flex-1 px-3 py-2 bg-stone-900 border-2 border-stone-700 text-white text-center font-bold focus:outline-none focus:border-amber-600"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 bg-stone-700 text-white font-bold hover:bg-stone-600 transition-colors cursor-pointer"
          >
            +
          </button>
        </div>
      </div>

      {/* 빠른 선택 버튼 */}
      <div className="flex gap-2 mb-3">
        {[1, 16, 32, 64].map((num) => (
          <button
            key={num}
            onClick={() => setQuantity(num)}
            className={`flex-1 py-2 text-sm font-bold transition-colors cursor-pointer ${quantity === num
              ? 'bg-amber-600 text-white'
              : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
          >
            {num}개
          </button>
        ))}
      </div>

      {/* 계산 결과 */}
      <div className="bg-amber-900/30 border-2 border-amber-600 rounded-lg p-3">
        <p className="text-xs text-amber-400 mb-1">{quantity}개 가격</p>
        <p className="text-2xl font-bold text-amber-400">
          {calculatedPrice % 1 === 0 ? calculatedPrice.toLocaleString() : calculatedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
};

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<ValueHistory[]>([]);

  useEffect(() => {
    if (id) {
      loadItemData(id);
    } else {
      window.location.replace('/');
    }
  }, [id]);

  useEffect(() => {
    if (!item) return;

    // 실시간 구독 설정
    const itemChannel = supabase
      .channel(`item-${item.id}-realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items',
          filter: `id=eq.${item.id}`,
        },
        (payload) => {
          console.log('아이템 실시간 업데이트:', payload);
          const updatedItem = payload.new as Item;
          setItem(updatedItem);
        }
      )
      .subscribe();

    // 히스토리 실시간 구독
    const historyChannel = supabase
      .channel(`history-${item.id}-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'value_history',
          filter: `item_id=eq.${item.id}`,
        },
        (payload) => {
          console.log('히스토리 실시간 업데이트:', payload);

          if (payload.eventType === 'INSERT') {
            const newHistory = payload.new as ValueHistory;
            setHistory(prev => [newHistory, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedHistory = payload.new as ValueHistory;
            setHistory(prev =>
              prev.map(h => h.id === updatedHistory.id ? updatedHistory : h)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: number }).id;
            setHistory(prev => prev.filter(h => h.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [item]);

  const loadItemData = async (itemIdentifier: string) => {
    try {
      // 아이템 정보 로드
      const decodedIdentifier = decodeURIComponent(itemIdentifier);
      const isNumericId = /^\d+$/.test(decodedIdentifier);
      const itemQuery = supabase
        .from('items')
        .select('*')
        .eq('status', 'approved');
      const { data: itemData, error: itemError } = isNumericId
        ? await itemQuery.eq('id', Number(decodedIdentifier)).maybeSingle()
        : await itemQuery.ilike('code', decodedIdentifier).maybeSingle();

      if (itemError) throw itemError;

      if (!itemData) {
        console.error('아이템을 찾을 수 없습니다');
        window.location.replace('/');
        return;
      }

      setItem(itemData);

      // 가치 변동 히스토리 로드
      const { data: historyData, error: historyError } = await supabase
        .from('value_history')
        .select('*')
        .eq('item_id', itemData.id)
        .order('changed_at', { ascending: false });

      if (historyError) throw historyError;

      if (historyData && historyData.length > 0) {
        setHistory(historyData);
      } else {
        // 히스토리가 없으면 초기 히스토리 생성
        const { error: insertError } = await supabase
          .from('value_history')
          .insert({
            item_id: itemData.id,
            value: itemData.current_value,
            reason: '초기 등록',
            votes: itemData.votes || 0,
          });

        if (insertError) {
          console.error('히스토리 생성 오류:', insertError);
        } else {
          // 다시 로드
          const { data: newHistory } = await supabase
            .from('value_history')
            .select('*')
            .eq('item_id', itemData.id)
            .order('changed_at', { ascending: false });

          if (newHistory) setHistory(newHistory);
        }
      }
    } catch (error) {
      console.error('아이템 데이터 로드 오류:', error);
      window.location.replace('/');
    }
  };

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-24 h-24 flex items-center justify-center bg-stone-900 rounded-full mx-auto mb-4">
            <i className="ri-loader-4-line text-5xl text-lime-400 animate-spin"></i>
          </div>
          <p className="text-stone-300 text-lg">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-stone-400 hover:text-lime-400 mb-6 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-arrow-left-line"></i>
          <span>돌아가기</span>
        </a>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* 아이템 정보 */}
          <div className="lg:col-span-1">
            <div className="bg-stone-900 border-4 border-stone-950 overflow-hidden sticky top-24">
              <div className="aspect-square bg-stone-800 p-8">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-2xl font-bold text-white">{item.name}</h2>
                  <span className={`px-2 py-1 text-xs font-bold flex-shrink-0 ${item.unit_type === 'stack'
                    ? 'bg-purple-900 text-purple-400'
                    : item.unit_type === 'set'
                      ? 'bg-amber-900 text-amber-400'
                      : 'bg-cyan-900 text-cyan-400'
                    }`}>
                    {item.unit_type === 'stack' ? '64개' : item.unit_type === 'set' ? '16개' : '1개'}
                  </span>
                </div>
                <p className="text-stone-400 mb-6 font-mono text-sm">{item.code}</p>

                <div className="bg-lime-900/30 border-2 border-lime-600 rounded-lg p-4 mb-4">
                  <p className="text-sm text-lime-400 mb-1">
                    현재 가치 <span className="text-stone-400">({item.unit_type === 'stack' ? '64개 기준' : item.unit_type === 'set' ? '16개 기준' : '1개 기준'})</span>
                  </p>
                  <p className="text-4xl font-bold text-lime-400">
                    {item.current_value.toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2 text-amber-400">
                    <i className="ri-thumb-up-fill text-xl"></i>
                    <span className="font-bold">{item.votes}표</span>
                  </div>
                  <div className="text-stone-400 text-sm">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>

                {/* 가격 계산기 */}
                <PriceCalculator item={item} />

                <a
                  href="/submit"
                  className="w-full bg-lime-600 text-white py-3 font-bold hover:bg-lime-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer mt-4"
                >
                  <i className="ri-edit-line"></i>
                  <span>가치 변경 제안하기</span>
                </a>
              </div>
            </div>
          </div>

          {/* 가치 변동 그래프 & 히스토리 */}
          <div className="lg:col-span-2 space-y-6">
            <ItemAuctionHistory itemType={item.code} />

            {/* 가치 변동 그래프 */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <i className="ri-line-chart-line text-lime-400"></i>
                가치 변동 그래프
              </h3>
              <ValueChart history={history} />
              {history.length > 0 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-lime-500 rounded-full"></span>
                      <span className="text-stone-400">가치</span>
                    </div>
                  </div>
                  <div className="text-stone-500">
                    총 {history.length}회 변동
                  </div>
                </div>
              )}
            </div>

            {/* 가치 변동 히스토리 */}
            <div className="bg-stone-900 border-4 border-stone-950 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <i className="ri-history-line text-amber-400"></i>
                가치 변동 히스토리
              </h3>

              {history.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 flex items-center justify-center bg-stone-800 rounded-full mx-auto mb-4">
                    <i className="ri-history-line text-4xl text-stone-600"></i>
                  </div>
                  <p className="text-stone-400">아직 변동 히스토리가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((record, index) => {
                    const isIncrease = record.previous_value && record.value > record.previous_value;
                    const isDecrease = record.previous_value && record.value < record.previous_value;
                    const change = record.previous_value ? record.value - record.previous_value : 0;

                    return (
                      <div
                        key={record.id}
                        className="border-4 border-stone-950 bg-stone-800 p-4 hover:border-lime-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 flex items-center justify-center ${index === 0
                                ? 'bg-lime-600'
                                : isIncrease
                                  ? 'bg-emerald-600'
                                  : isDecrease
                                    ? 'bg-red-600'
                                    : 'bg-stone-700'
                                }`}
                            >
                              <i
                                className={`text-xl text-white ${index === 0
                                  ? 'ri-star-line'
                                  : isIncrease
                                    ? 'ri-arrow-up-line'
                                    : isDecrease
                                      ? 'ri-arrow-down-line'
                                      : 'ri-subtract-line'
                                  }`}
                              ></i>
                            </div>
                            <div>
                              <p className="font-bold text-white text-lg">
                                {record.value.toLocaleString()}
                              </p>
                              {record.previous_value && (
                                <p className="text-sm text-stone-400">
                                  이전: {record.previous_value.toLocaleString()}
                                  <span
                                    className={`ml-2 font-medium ${isIncrease ? 'text-emerald-400' : 'text-red-400'
                                      }`}
                                  >
                                    ({change > 0 ? '+' : ''}{change.toLocaleString()})
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-stone-500 whitespace-nowrap">
                            {new Date(record.changed_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-stone-300">{record.reason}</p>
                          <div className="flex items-center gap-1 text-sm text-amber-400">
                            <i className="ri-thumb-up-line"></i>
                            <span>{record.votes}표</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
