import { useState, useEffect, useRef } from 'react';
import { supabase, type Item } from '../../lib/supabase';
import { Package, Clock } from 'lucide-react';
import { getItemName } from '../../lib/itemNames';

const floorToHundreds = (value: number) => Math.floor(Number(value) / 100) * 100;

// XSS 공격 방지
const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

const MiniAuctionReference = ({ itemCode }: { itemCode: string }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemCode || itemCode.length < 2) {
      setTransactions([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      let searchType = itemCode.toLowerCase();
      if (!searchType.startsWith('minecraft:')) {
        searchType = `minecraft:${searchType}`;
      }

      const { data } = await supabase
        .from('auction_transactions')
        .select('*')
        .ilike('item_type', searchType)
        .order('transaction_date', { ascending: false })
        .limit(3);
      setTransactions(data || []);
      setLoading(false);
    }; const timer = setTimeout(load, 500);
    return () => clearTimeout(timer);
  }, [itemCode]);

  if (!itemCode || itemCode.length < 2) return null;

  return (
    <div className="bg-stone-900 border-4 border-stone-950 p-4 mt-6">
      <h4 className="text-lime-400 font-bold mb-3 flex items-center gap-2 text-sm">
        <Package className="size-4" />
        거래소 최근 거래기록 (참고용)
      </h4>
      {loading ? (
        <p className="text-stone-500 text-xs text-center py-2">조회 중...</p>
      ) : transactions.length === 0 ? (
        <p className="text-stone-500 text-xs text-center py-2">최근 거래 내역이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center text-xs bg-stone-800 p-2 border border-stone-700">
              <div>
                <p className="text-white font-bold">{tx.item_info?.displayName || getItemName(tx.item_type)}</p>
                <p className="text-stone-500 flex items-center gap-1 mt-0.5">
                  <Clock className="size-3" />
                  {new Date(tx.transaction_date).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-amber-400 font-bold">{floorToHundreds(tx.price).toLocaleString()} 원</p>
                {tx.item_info?.amount > 1 && <p className="text-[10px] text-stone-500">x{tx.item_info.amount}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// unit_type 변환 함수 (items 테이블 -> proposals 테이블)
const convertUnitType = (unitType: string): 'piece' | 'stack_16' | 'stack_64' => {
  if (unitType === 'set') return 'stack_16';
  if (unitType === 'stack') return 'stack_64';
  return 'piece';
};

// 아이템 코드 검증
const validateItemCode = (code: string): string | null => {
  if (!code || code.length < 2 || code.length > 50) {
    return '아이템 코드는 2-50자여야 합니다.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(code)) {
    return '아이템 코드는 영문, 숫자, 언더스코어만 사용 가능합니다.';
  }
  return null;
};

// 아이템 이름 검증
const validateItemName = (name: string): string | null => {
  if (!name || name.length < 1 || name.length > 100) {
    return '아이템 이름은 1-100자여야 합니다.';
  }
  return null;
};

// 이미지 URL 검증
const validateImageUrl = (url: string): string | null => {
  if (!url) return null; // 빈 값 허용
  if (url.length > 500) {
    return '이미지 URL은 500자 이하여야 합니다.';
  }
  if (!url.startsWith('https://')) {
    return '이미지 URL은 https://로 시작해야 합니다.';
  }
  return null;
};

// 가치 검증
const validateValue = (value: number): string | null => {
  if (value < 1 || value > 999999999) {
    return '가치는 1 ~ 999,999,999 사이여야 합니다.';
  }
  return null;
};

// 닉네임 검증
const validateNickname = (name: string): string | null => {
  if (!name || name.length < 2 || name.length > 30) {
    return '닉네임은 2-30자여야 합니다.';
  }
  if (!/^[a-zA-Z0-9가-힣_]+$/.test(name)) {
    return '닉네임은 한글, 영문, 숫자, 언더스코어만 사용 가능합니다.';
  }
  return null;
};

export default function SubmitPage() {
  const [submitType, setSubmitType] = useState<'new' | 'update'>('new');
  const [items, setItems] = useState<Item[]>([]);

  // 새 아이템 폼
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [newSubmitter, setNewSubmitter] = useState('');
  const [newUnitType, setNewUnitType] = useState<'piece' | 'stack_16' | 'stack_64'>('piece');

  // 시세 변경 폼
  const [selectedItemId, setSelectedItemId] = useState('');
  const [updateValue, setUpdateValue] = useState('');
  const [updateSubmitter, setUpdateSubmitter] = useState('');

  // 직접 입력 (드롭다운 미선택 시)
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemCode, setManualItemCode] = useState('');

  // 검색 드롭다운
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 에러 상태
  const [errors, setErrors] = useState({
    code: '',
    name: '',
    image: '',
    value: '',
    submitter: '',
  });

  const [updateErrors, setUpdateErrors] = useState({
    value: '',
    submitter: '',
    manualName: '',
    manualCode: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsItemDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  const selectedItem = items.find(item => item.id === parseInt(selectedItemId));
  // 드롭다운에서 선택하지 않은 경우 직접 입력 사용
  const useManualInput = !selectedItem;

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'approved')
        .order('name');

      if (error) throw error;
      if (data) setItems(data);
    } catch (error) {
      console.error('아이템 로드 오류:', error);
    }
  };

  const handleNewItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 입력값 정제
    const sanitizedCode = sanitizeInput(newItemCode.trim());
    const sanitizedName = sanitizeInput(newItemName.trim());
    const sanitizedImage = sanitizeInput(newItemImage.trim());
    const sanitizedSubmitter = sanitizeInput(newSubmitter.trim());

    // 가치 검증 강화
    if (!newItemValue || newItemValue.trim() === '') {
      setErrors({ ...errors, value: '가치를 입력해주세요.' });
      alert('가치를 입력해주세요.');
      return;
    }

    const valueNum = parseInt(newItemValue.trim());

    if (isNaN(valueNum)) {
      setErrors({ ...errors, value: '올바른 숫자를 입력해주세요.' });
      alert('올바른 숫자를 입력해주세요.');
      return;
    }

    // 검증
    const newErrors = {
      code: validateItemCode(sanitizedCode) || '',
      name: validateItemName(sanitizedName) || '',
      image: validateImageUrl(sanitizedImage) || '',
      value: validateValue(valueNum) || '',
      submitter: validateNickname(sanitizedSubmitter) || '',
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some(error => error !== '')) {
      alert('입력 정보를 확인해주세요.');
      return;
    }

    try {

      // 이미지가 없으면 기본 이미지 사용
      const finalImage = '';

      const proposalData = {
        item_code: sanitizedCode,
        item_name: sanitizedName,
        item_image: finalImage,
        proposed_value: valueNum,
        current_votes: 0,
        negative_votes: 0,
        required_votes: 5,
        status: 'voting',
        submitted_by: sanitizedSubmitter,
        type: 'new',
        unit_type: newUnitType,
      };

      console.log('제출 데이터:', proposalData);

      const { error } = await supabase
        .from('proposals')
        .insert(proposalData);

      if (error) {
        console.error('Supabase 오류:', error);
        alert(`제출 실패: ${error.message}`);
        return;
      }

      alert('새 아이템이 제출되었습니다! 투표 페이지에서 확인하세요.');

      // 폼 초기화
      setNewItemCode('');
      setNewItemName('');
      setNewItemImage('');
      setNewItemValue('');
      setNewSubmitter('');
      setNewUnitType('piece');

      window.REACT_APP_NAVIGATE('/voting');
    } catch (error) {
      console.error('제출 오류:', error);
      alert('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedSubmitter = sanitizeInput(updateSubmitter.trim());

    // 가치 검증 강화
    if (!updateValue || updateValue.trim() === '') {
      setUpdateErrors({ ...updateErrors, value: '가치를 입력해주세요.' });
      alert('가치를 입력해주세요.');
      return;
    }

    const valueNum = parseInt(updateValue.trim());

    if (isNaN(valueNum)) {
      setUpdateErrors({ ...updateErrors, value: '올바른 숫자를 입력해주세요.' });
      alert('올바른 숫자를 입력해주세요.');
      return;
    }

    // 검증 — 직접 입력 시 이름/코드 필수, 드롭다운 선택 시 불필요
    const newErrors = {
      value: validateValue(valueNum) || '',
      submitter: validateNickname(sanitizedSubmitter) || '',
      manualName: useManualInput ? (validateItemName(manualItemName.trim()) || '') : '',
      manualCode: useManualInput ? (validateItemCode(manualItemCode.trim()) || '') : '',
    };

    setUpdateErrors(newErrors);

    if (Object.values(newErrors).some(error => error !== '')) {
      alert('입력 정보를 확인해주세요.');
      return;
    }

    try {
      // 드롭다운 선택 시: item_id 포함, 모든 정보 자동 입력
      // 직접 입력 시: item_id 없이 item_code/item_name만 전송
      const proposalData: Record<string, unknown> = {
        item_code: selectedItem ? selectedItem.code : sanitizeInput(manualItemCode.trim()),
        item_name: selectedItem ? selectedItem.name : sanitizeInput(manualItemName.trim()),
        item_image: selectedItem?.image || 'https://static.readdy.ai/image/17df2564a108ae0a0e22f6d4f873354f/e749d238aa2e6349f28b4e6c1e98a806.png',
        proposed_value: valueNum,
        current_votes: 0,
        negative_votes: 0,
        required_votes: 5,
        status: 'voting',
        submitted_by: sanitizedSubmitter,
        type: 'update',
        unit_type: selectedItem ? convertUnitType(selectedItem.unit_type) : 'piece',
      };

      // item_id와 current_value는 드롭다운 선택 시에만 포함
      if (selectedItem) {
        proposalData.item_id = selectedItem.id;
        proposalData.current_value = selectedItem.current_value;
      }

      console.log('제출 데이터:', proposalData);

      const { error } = await supabase
        .from('proposals')
        .insert(proposalData);

      if (error) {
        console.error('Supabase 오류:', error);
        alert(`제출 실패: ${error.message}`);
        return;
      }

      alert('시세 변경 제안이 제출되었습니다! 투표 페이지에서 확인하세요.');

      // 폼 초기화
      setSelectedItemId('');
      setItemSearchQuery('');
      setManualItemName('');
      setManualItemCode('');
      setUpdateValue('');
      setUpdateSubmitter('');

      window.REACT_APP_NAVIGATE('/voting');
    } catch (error) {
      console.error('제출 오류:', error);
      alert('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <>
      {/* Main Content */}
      <section className="py-10 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-lime-400 mb-3 md:mb-4 font-pixel">아이템 제출</h2>
            <p className="text-base md:text-xl text-stone-300">새로운 아이템을 등록하거나 기존 아이템의 시세 변경을 제안하세요.</p>
          </div>

          {/* Type Selector */}
          <div className="flex gap-2 mb-6 md:mb-8">
            <button
              onClick={() => setSubmitType('new')}
              className={`flex-1 px-4 md:px-6 py-3 md:py-4 font-bold transition-colors whitespace-nowrap cursor-pointer ${submitType === 'new'
                  ? 'bg-lime-600 text-white'
                  : 'bg-stone-900 text-stone-300 hover:bg-stone-700'
                }`}
            >
              새 아이템 등록
            </button>
            <button
              onClick={() => setSubmitType('update')}
              className={`flex-1 px-4 md:px-6 py-3 md:py-4 font-bold transition-colors whitespace-nowrap cursor-pointer ${submitType === 'update'
                  ? 'bg-lime-600 text-white'
                  : 'bg-stone-900 text-stone-300 hover:bg-stone-700'
                }`}
            >
              시세 변경 제안
            </button>
          </div>

          {/* New Item Form */}
          {submitType === 'new' && (
            <form onSubmit={handleNewItemSubmit} className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8">
              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    아이템 코드 *
                  </label>
                  <input
                    type="text"
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    placeholder="예: DIAMOND_SWORD"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                    required
                  />
                  {errors.code && <p className="text-red-400 text-xs md:text-sm mt-1">{errors.code}</p>}
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    아이템 이름 *
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="예: 다이아몬드 검"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                    required
                  />
                  {errors.name && <p className="text-red-400 text-xs md:text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    이미지 URL (선택)
                  </label>
                  <input
                    type="url"
                    value={newItemImage}
                    onChange={(e) => setNewItemImage(e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                  />
                  {errors.image && <p className="text-red-400 text-xs md:text-sm mt-1">{errors.image}</p>}
                  <p className="text-stone-500 text-xs mt-1">이미지가 없으면 기본 이미지가 사용됩니다.</p>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    단위 선택 *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewUnitType('piece')}
                      className={`flex-1 px-4 py-3 font-bold transition-colors whitespace-nowrap cursor-pointer ${newUnitType === 'piece'
                          ? 'bg-teal-600 text-white'
                          : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                        }`}
                    >
                      개당
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUnitType('stack_16')}
                      className={`flex-1 px-4 py-3 font-bold transition-colors whitespace-nowrap cursor-pointer ${newUnitType === 'stack_16'
                          ? 'bg-orange-600 text-white'
                          : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                        }`}
                    >
                      16개
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUnitType('stack_64')}
                      className={`flex-1 px-4 py-3 font-bold transition-colors whitespace-nowrap cursor-pointer ${newUnitType === 'stack_64'
                          ? 'bg-purple-600 text-white'
                          : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                        }`}
                    >
                      64개
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    제안 가치 *
                  </label>
                  <input
                    type="number"
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value)}
                    placeholder="예: 1000"
                    min="1"
                    max="999999999"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                    required
                  />
                  {errors.value && <p className="text-red-400 text-xs md:text-sm mt-1">{errors.value}</p>}
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    제출자 닉네임 *
                  </label>
                  <input
                    type="text"
                    value={newSubmitter}
                    onChange={(e) => setNewSubmitter(e.target.value)}
                    placeholder="예: antiYoon_"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                    required
                  />
                  {errors.submitter && <p className="text-red-400 text-xs md:text-sm mt-1">{errors.submitter}</p>}
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 md:py-4 bg-lime-600 text-white font-bold hover:bg-lime-500 transition-colors whitespace-nowrap cursor-pointer text-sm md:text-base"
                >
                  제출하기
                </button>
              </div>
              <MiniAuctionReference itemCode={newItemCode} />
            </form>
          )}

          {/* Update Item Form */}
          {submitType === 'update' && (
            <form onSubmit={handleUpdateSubmit} className="bg-stone-900 border-4 border-stone-950 p-6 md:p-8">
              <div className="space-y-4 md:space-y-6">

                {/* 아이템 드롭다운 — 선택사항 */}
                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    아이템 선택 <span className="text-stone-400 font-normal text-xs">(선택사항 — 목록에 없으면 아래에 직접 입력)</span>
                  </label>
                  <div ref={dropdownRef} className="relative">
                    <div
                      onClick={() => setIsItemDropdownOpen(!isItemDropdownOpen)}
                      className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600 cursor-pointer flex items-center justify-between"
                    >
                      <span className={selectedItem ? 'text-white' : 'text-stone-400'}>
                        {selectedItem
                          ? `${selectedItem.name} (현재 가치: ${selectedItem.current_value})`
                          : '아이템을 선택하세요 (선택사항)'}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemId('');
                              setItemSearchQuery('');
                            }}
                            className="text-stone-400 hover:text-white text-xs px-2 py-0.5 bg-stone-700 hover:bg-stone-600"
                          >
                            ✕
                          </button>
                        )}
                        <svg className={`w-4 h-4 text-stone-400 transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {isItemDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-stone-800 border-2 border-stone-700 max-h-64 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-stone-700">
                          <input
                            type="text"
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                            placeholder="아이템 검색..."
                            className="w-full px-3 py-2 bg-stone-900 border border-stone-600 text-white text-sm focus:outline-none focus:border-lime-600"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {filteredItems.length === 0 ? (
                            <div className="px-4 py-3 text-stone-400 text-sm">검색 결과가 없습니다.</div>
                          ) : (
                            filteredItems.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setSelectedItemId(String(item.id));
                                  setIsItemDropdownOpen(false);
                                  setItemSearchQuery('');
                                }}
                                className={`px-4 py-3 cursor-pointer text-sm md:text-base transition-colors ${String(item.id) === selectedItemId
                                    ? 'bg-lime-600 text-white'
                                    : 'text-white hover:bg-stone-700'
                                  }`}
                              >
                                {item.name} (현재 가치: {item.current_value})
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 직접 입력 영역 — 드롭다운 미선택 시에만 표시 */}
                {useManualInput && (
                  <div className="border-2 border-stone-700 p-4 md:p-5 space-y-4">
                    <p className="text-stone-400 text-xs">
                      목록에서 아이템을 선택하지 않은 경우 아이템 정보를 직접 입력해주세요.
                    </p>
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                        아이템 이름 *
                      </label>
                      <input
                        type="text"
                        value={manualItemName}
                        onChange={(e) => setManualItemName(e.target.value)}
                        placeholder="예: 다이아몬드 검"
                        className={`w-full px-4 py-3 bg-stone-800 border-2 text-white text-sm md:text-base focus:outline-none focus:border-lime-600 ${updateErrors.manualName ? 'border-red-500' : 'border-stone-700'
                          }`}
                      />
                      {updateErrors.manualName && <p className="text-red-400 text-xs md:text-sm mt-1">{updateErrors.manualName}</p>}
                    </div>
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                        아이템 코드 *
                      </label>
                      <input
                        type="text"
                        value={manualItemCode}
                        onChange={(e) => setManualItemCode(e.target.value)}
                        placeholder="예: DIAMOND_SWORD"
                        className={`w-full px-4 py-3 bg-stone-800 border-2 text-white text-sm md:text-base focus:outline-none focus:border-lime-600 ${updateErrors.manualCode ? 'border-red-500' : 'border-stone-700'
                          }`}
                      />
                      {updateErrors.manualCode && <p className="text-red-400 text-xs md:text-sm mt-1">{updateErrors.manualCode}</p>}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    새로운 가치 *
                  </label>
                  <input
                    type="number"
                    value={updateValue}
                    onChange={(e) => setUpdateValue(e.target.value)}
                    placeholder="예: 1500"
                    min="1"
                    max="999999999"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                    required
                  />
                  {updateErrors.value && <p className="text-red-400 text-xs md:text-sm mt-1">{updateErrors.value}</p>}
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">
                    제출자 닉네임 *
                  </label>
                  <input
                    type="text"
                    value={updateSubmitter}
                    onChange={(e) => setUpdateSubmitter(e.target.value)}
                    placeholder="예: antiYoon_"
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-stone-700 text-white text-sm md:text-base focus:outline-none focus:border-lime-600"
                    required
                  />
                  {updateErrors.submitter && <p className="text-red-400 text-xs md:text-sm mt-1">{updateErrors.submitter}</p>}
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 md:py-4 bg-lime-600 text-white font-bold hover:bg-lime-500 transition-colors whitespace-nowrap cursor-pointer text-sm md:text-base"
                >
                  제출하기
                </button>
              </div>
            </form>
          )}

          {/* Info Box */}
          <div className="mt-6 md:mt-8 bg-stone-900 border-4 border-stone-950 p-4 md:p-6">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-information-line text-xl md:text-2xl text-white"></i>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2 text-sm md:text-base">제출 안내</h3>
                <ul className="text-stone-300 space-y-1 text-xs md:text-sm">
                  <li>• 제출된 아이템은 투표를 거쳐 승인됩니다.</li>
                  <li>• 5표 이상 획득 시 자동으로 승인됩니다.</li>
                  <li>• 허위 정보나 부적절한 내용은 관리자에 의해 삭제될 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
