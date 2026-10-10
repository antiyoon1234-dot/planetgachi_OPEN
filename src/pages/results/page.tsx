import { useState, useEffect } from 'react';
import { supabase, type Item } from '../../lib/supabase';

export default function Results() {
  const [sortBy, setSortBy] = useState<'value' | 'votes' | 'date'>('value');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'approved')
        .order('current_value', { ascending: false });

      if (error) throw error;
      if (data) setItems(data);
    } catch (error) {
      console.error('아이템 로드 오류:', error);
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

  return (
    <>
      {/* Main Content */}
      <section className="py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-lime-400 mb-3 md:mb-4 font-pixel">아이템 가치</h2>
            <p className="text-base md:text-xl text-stone-300">유저가 승인한 공식 아이템 가치 목록입니다.</p>
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
              <div key={item.id} className="bg-stone-900 border-4 border-stone-950 p-4">
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
                </div>
                <div className="flex items-center justify-between pt-3 border-t-2 border-stone-800">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-lime-400">{item.current_value}</div>
                      <div className="text-xs text-stone-400">가치</div>
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
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">가치</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">투표 수</th>
                    <th className="px-4 lg:px-6 py-4 text-center text-white font-bold">승인일</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, index) => (
                    <tr key={item.id} className="border-t-2 border-stone-950 hover:bg-stone-800 transition-colors">
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
                        <span className="text-xl lg:text-2xl font-bold text-lime-400">{item.current_value}</span>
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
