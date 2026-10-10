import { useState, useEffect } from 'react';
import { supabase, type Item, type Banner } from '../../lib/supabase';
import { getUnitAmount } from '../../lib/marketUnits';

import { catalogAverage } from '../../lib/catalogAverage';
import { loadCatalogTransactions } from '../../lib/loadCatalogTransactions';

export default function Home() {
  const [sortBy, setSortBy] = useState<'value' | 'votes' | 'date'>('value');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [auctionAverages, setAuctionAverages] = useState<Record<number, number | null>>({});
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    loadItems();
    loadBanners();
    trackVisit();

    // 실시간 구독 설정
    const itemsChannel = supabase
      .channel('items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
        },
        (payload) => {
          console.log('아이템 실시간 업데이트:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as Item;
            if (newItem.status === 'approved') {
              setItems(prev => [newItem, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as Item;
            if (updatedItem.status === 'approved') {
              setItems(prev => 
                prev.map(item => item.id === updatedItem.id ? updatedItem : item)
              );
            } else {
              setItems(prev => prev.filter(item => item.id !== updatedItem.id));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: number }).id;
            setItems(prev => prev.filter(item => item.id !== deletedId));
          }
        }
      )
      .subscribe();

    // 배너 실시간 구독
    const bannersChannel = supabase
      .channel('banners-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'banners',
        },
        (payload) => {
          console.log('배너 실시간 업데이트:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newBanner = payload.new as Banner;
            if (newBanner.active) {
              setBanners(prev => [newBanner, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBanner = payload.new as Banner;
            if (updatedBanner.active) {
              setBanners(prev => 
                prev.map(banner => banner.id === updatedBanner.id ? updatedBanner : banner)
              );
            } else {
              setBanners(prev => prev.filter(banner => banner.id !== updatedBanner.id));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: number }).id;
            setBanners(prev => prev.filter(banner => banner.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(bannersChannel);
    };
  // Initial data and realtime subscriptions are intentionally created once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'approved')
        .order('current_value', { ascending: false });

      if (error) throw error;
      if (data) {
        setItems(data);
        void loadAuctionAverages(data);
      }
    } catch (error) {
      console.error('아이템 로드 오류:', error);
    }
  };

  const loadAuctionAverages = async (catalog: Item[]) => {
    try {
      const rows = await loadCatalogTransactions();
      const next: Record<number, number | null> = {};
      catalog.forEach(item => {
        next[item.id] = catalogAverage(item, rows, getUnitAmount(item.unit_type)).average;
      });
      setAuctionAverages(next);
    } catch (error) {
      console.error('거래소 평균가 로드 오류:', error);
    }
  };

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('active', true)
        .order('id', { ascending: true });

      if (error) throw error;
      if (data) {
        console.log('로드된 배너:', data);
        setBanners(data);
      }
    } catch (error) {
      console.error('배너 로드 오류:', error);
    }
  };

  const trackVisit = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingVisit } = await supabase
        .from('visit_stats')
        .select('*')
        .eq('date', today)
        .is('hour', null)
        .maybeSingle();
      
      if (existingVisit) {
        const { error: updateError } = await supabase
          .from('visit_stats')
          .update({ visits: existingVisit.visits + 1 })
          .eq('id', existingVisit.id);
        
        if (updateError) {
          console.error('방문 통계 업데이트 오류:', updateError);
        }
      } else {
        const { error: insertError } = await supabase
          .from('visit_stats')
          .insert({ date: today, visits: 1 });
        
        if (insertError) {
          console.error('방문 통계 추가 오류:', insertError);
        }
      }
    } catch (error) {
      console.error('방문 기록 오류:', error);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return b.current_value - a.current_value;
      case 'votes':
        return b.votes - a.votes;
      case 'date':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  const handleItemClick = (itemId: number) => {
    window.REACT_APP_NAVIGATE(`/item/${itemId}`);
  };

  return (
    <>
      {/* Banner Section */}
      {banners.length > 0 && (
        <section className="bg-stone-900 border-b-4 border-stone-950 py-4 md:py-6">
          <div className="max-w-7xl mx-auto px-4">
            <div className="relative max-w-4xl mx-auto bg-stone-800 border-2 border-stone-700 rounded-lg overflow-hidden">
              <div className="relative h-20 md:h-24">
                {banners.map((banner, index) => (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      index === currentBannerIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {banner.image && banner.image !== 'text-only' ? (
                      <a 
                        href={banner.link || '#'} 
                        target={banner.link ? "_blank" : "_self"} 
                        rel="noopener noreferrer" 
                        className="relative z-10 block w-full h-full cursor-pointer"
                      >
                        <img 
                          src={banner.image} 
                          alt={banner.title} 
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {banner.link ? (
                          <a href={banner.link} target="_blank" rel="noopener noreferrer" className="block">
                            <h2 className="text-base md:text-xl font-bold text-lime-400 font-pixel px-4 text-center">
                              {banner.title}
                            </h2>
                          </a>
                        ) : (
                          <h2 className="text-base md:text-xl font-bold text-lime-400 font-pixel px-4 text-center">
                            {banner.title}
                          </h2>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {banners.length > 1 && (
                <div className="absolute bottom-2 right-3 flex gap-1.5">
                  {banners.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentBannerIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                        index === currentBannerIndex
                          ? 'bg-lime-400 w-5'
                          : 'bg-stone-600 hover:bg-stone-500'
                      }`}
                      aria-label={`배너 ${index + 1}`}
                    ></button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <section className="py-10 md:py-16">
        <div className="max-w-[1500px] mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-lime-400 mb-3 md:mb-4 font-pixel">아이템 가치표</h2>
            <p className="text-base md:text-xl text-stone-300">커뮤니티가 결정한 공식 아이템 가치를 확인하세요.</p>
          </div>

          {/* Search and Sort */}
          <div className="mb-6 md:mb-8 flex flex-col gap-3 md:gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="아이템 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-stone-900 border-4 border-stone-950 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
              />
              <i className="ri-search-line absolute right-4 top-1/2 -translate-y-1/2 text-lg md:text-xl text-stone-400"></i>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSortBy('value')}
                className={`px-4 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-sm md:text-base flex-shrink-0 ${
                  sortBy === 'value' 
                    ? 'bg-lime-600 text-white' 
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-700'
                }`}
              >
                가치순
              </button>
              <button
                onClick={() => setSortBy('votes')}
                className={`px-4 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-sm md:text-base flex-shrink-0 ${
                  sortBy === 'votes' 
                    ? 'bg-lime-600 text-white' 
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-700'
                }`}
              >
                투표순
              </button>
              <button
                onClick={() => setSortBy('date')}
                className={`px-4 md:px-6 py-2 md:py-3 font-bold transition-colors whitespace-nowrap cursor-pointer text-sm md:text-base flex-shrink-0 ${
                  sortBy === 'date' 
                    ? 'bg-lime-600 text-white' 
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-700'
                }`}
              >
                최신순
              </button>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {sortedItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="block bg-stone-900 border-4 border-stone-950 p-4 hover:border-lime-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-stone-950 text-lime-400 font-bold flex items-center justify-center text-sm">
                    {index + 1}
                  </div>
                  <div className="w-10 h-10 bg-stone-800 border-2 border-stone-700 flex items-center justify-center">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{item.name}</div>
                    <div className="text-stone-400 text-xs font-mono truncate">{item.code}</div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold flex-shrink-0 ${
                    item.unit_type === 'stack' 
                      ? 'bg-purple-900/50 text-purple-400' 
                      : item.unit_type === 'set'
                      ? 'bg-amber-900/50 text-amber-400'
                      : 'bg-cyan-900/50 text-cyan-400'
                  }`}>
                    {item.unit_type === 'stack' ? '64개' : item.unit_type === 'set' ? '16개' : '1개'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t-2 border-stone-800">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-lime-400">{item.current_value}</div>
                      <div className="text-xs text-stone-400">가치</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-bold text-cyan-400">{auctionAverages[item.id] === null || auctionAverages[item.id] === undefined ? '-' : `${auctionAverages[item.id]!.toLocaleString()} G`}</div>
                      <div className="text-xs text-stone-400">거래소 평균</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-amber-400">
                        <i className="ri-thumb-up-fill"></i>
                        <span className="font-bold">{item.votes}</span>
                      </div>
                      <div className="text-xs text-stone-400">투표</div>
                    </div>
                  </div>
                  <div className="text-stone-400 text-xs">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-stone-900 border-4 border-stone-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-950">
                  <tr>
                    <th className="px-4 lg:px-6 py-4 text-left text-white font-bold">순위</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white font-bold">이미지</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white font-bold">아이템 코드</th>
                    <th className="px-4 lg:px-6 py-4 text-left text-white font-bold">아이템 이름</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">단위</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">가치</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">거래소 평균가</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">투표 수</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className="border-t-2 border-stone-950 hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 bg-stone-950 text-lime-400 font-bold">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-stone-800 border-2 border-stone-700 flex items-center justify-center">
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-8 h-8 lg:w-10 lg:h-10 object-contain"
                          />
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="font-mono text-stone-300 text-xs lg:text-sm">{item.code}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="text-white font-semibold text-sm lg:text-base">{item.name}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-bold ${
                          item.unit_type === 'stack' 
                            ? 'bg-purple-900/50 text-purple-400' 
                            : item.unit_type === 'set'
                            ? 'bg-amber-900/50 text-amber-400'
                            : 'bg-cyan-900/50 text-cyan-400'
                        }`}>
                          {item.unit_type === 'stack' ? '64개' : item.unit_type === 'set' ? '16개' : '1개'}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span className="text-xl lg:text-2xl font-bold text-lime-400">{item.current_value}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span className="text-base lg:text-xl font-bold text-cyan-400">
                          {auctionAverages[item.id] === null || auctionAverages[item.id] === undefined ? '-' : `${auctionAverages[item.id]!.toLocaleString()} G`}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <i className="ri-thumb-up-fill text-amber-400"></i>
                          <span className="text-white font-bold">{item.votes}</span>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span className="text-stone-400 text-xs lg:text-sm">
                          {new Date(item.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {sortedItems.length === 0 && (
            <div className="text-center py-12 bg-stone-900 border-4 border-stone-950">
              <i className="ri-inbox-line text-5xl md:text-6xl text-stone-600 mb-4"></i>
              <p className="text-base md:text-xl text-stone-400">검색 결과가 없습니다.</p>
            </div>
          )}

          {/* Stats Cards */}
          <div className="mt-8 md:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-lime-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-trophy-line text-2xl md:text-3xl text-white"></i>
                </div>
                <div className="min-w-0">
                  <div className="text-lg md:text-3xl font-bold text-lime-400 truncate">
                    {sortedItems.length > 0 ? sortedItems[0].name : '-'}
                  </div>
                  <div className="text-stone-400 text-xs md:text-base">최고 가치 아이템</div>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-fire-line text-2xl md:text-3xl text-white"></i>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-amber-400">
                    {sortedItems.reduce((sum, item) => sum + item.votes, 0)}
                  </div>
                  <div className="text-stone-400 text-xs md:text-base">총 투표 수</div>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-checkbox-circle-line text-2xl md:text-3xl text-white"></i>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-emerald-400">{sortedItems.length}</div>
                  <div className="text-stone-400 text-xs md:text-base">승인된 아이템</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
