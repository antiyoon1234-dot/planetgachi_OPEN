import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, Package, Search, Menu, X, ChevronDown, ChevronRight, Globe, Plus, Lock, Loader2 } from "lucide-react";
import { getShops, getItemEmoji, CONTINENTS, addShop } from "@/mocks/shops";
import type { Shop } from "@/types/shop";

type ContinentName = keyof typeof CONTINENTS;

const allHarbors = (Object.entries(CONTINENTS) as [ContinentName, readonly string[]][]).flatMap(
  ([continent, harbors]) => harbors.map((h) => ({ name: h, continent }))
);

export default function ShopPage() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHarbor, setSelectedHarbor] = useState<string>("전체");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedContinents, setExpandedContinents] = useState<Set<string>>(
    new Set(Object.keys(CONTINENTS))
  );
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadShops = async () => {
    setLoading(true);
    const data = await getShops();
    setShops(data);
    setLoading(false);
  };

  useEffect(() => {
    loadShops();
  }, []);

  const toggleContinent = (continent: string) => {
    const newExpanded = new Set(expandedContinents);
    if (newExpanded.has(continent)) {
      newExpanded.delete(continent);
    } else {
      newExpanded.add(continent);
    }
    setExpandedContinents(newExpanded);
  };

  const filteredShops = shops.filter((shop) => {
    const matchesSearch =
      !searchQuery.trim() ||
      shop.ownerNickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.items.some((item) =>
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesHarbor =
      selectedHarbor === "전체" || shop.harborName === selectedHarbor;
    return matchesSearch && matchesHarbor;
  });

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleAddShop = async (data: { harborName: string; ownerNickname: string; description: string; coordinates: string; password: string }) => {
    const result = await addShop(
      {
        harborName: data.harborName,
        ownerNickname: data.ownerNickname,
        description: data.description,
        coordinates: data.coordinates,
      },
      data.password
    );
    if (!result) {
      throw new Error("상점 등록에 실패했습니다");
    }
    await loadShops();
    setAddModalOpen(false);
  };


  return (
    <div className="legacy-shop flex min-h-[calc(100vh-70px)]">
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`legacy-shop-sidebar fixed top-[70px] left-0 h-[calc(100vh-70px)] bg-stone-900 border-r-4 border-stone-950 w-64 z-50 transition-transform flex flex-col shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b-2 border-stone-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Store className="size-5 text-lime-400" />
            <div>
              <div className="text-white text-sm font-bold">체스트샵</div>
              <div className="text-xs text-stone-400">항구별 상점 목록</div>
            </div>
          </div>
          <button
            className="text-stone-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Harbor Filters */}
        <div className="flex-1 overflow-y-auto">
          {/* 전체 보기 */}
          <div className="p-3 border-b-2 border-stone-950">
            <button
              onClick={() => {
                setSelectedHarbor("전체");
                setSidebarOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-sm text-left transition-colors flex items-center justify-between ${
                selectedHarbor === "전체"
                  ? "bg-lime-600 text-white font-bold"
                  : "text-stone-300 hover:bg-stone-800"
              }`}
            >
              <span className="flex items-center gap-2">
                <Globe className="size-4" />
                전체 항구
              </span>
              <span
                className={`text-xs px-2 py-0.5 ${
                  selectedHarbor === "전체"
                    ? "bg-lime-700 text-white"
                    : "bg-stone-800 text-stone-400"
                }`}
              >
                {shops.length}
              </span>
            </button>
          </div>

          {/* 대륙별 항구 */}
          <div className="p-3">
            <h3 className="text-xs font-bold text-stone-500 mb-2 uppercase tracking-wider px-1">
              대륙별 항구
            </h3>
            <div className="space-y-1">
              {(Object.keys(CONTINENTS) as ContinentName[]).map((continent) => {
                const isExpanded = expandedContinents.has(continent);
                const harbors = CONTINENTS[continent];
                const continentShopCount = shops.filter((s) =>
                  (harbors as readonly string[]).includes(s.harborName)
                ).length;

                return (
                  <div key={continent}>
                    <button
                      onClick={() => toggleContinent(continent)}
                      className="w-full px-2 py-2 text-sm text-left text-stone-300 hover:bg-stone-800 transition-colors flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 text-stone-500" />
                        ) : (
                          <ChevronRight className="size-3.5 text-stone-500" />
                        )}
                        <span className="font-bold">{continent}</span>
                      </span>
                      <span className="bg-stone-800 text-stone-400 text-xs px-2 py-0.5">
                        {continentShopCount}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {harbors.map((harbor) => {
                          const harborShopCount = shops.filter(
                            (s) => s.harborName === harbor
                          ).length;

                          return (
                            <button
                              key={harbor}
                              onClick={() => {
                                setSelectedHarbor(harbor);
                                setSidebarOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-sm text-left transition-colors flex items-center justify-between ${
                                selectedHarbor === harbor
                                  ? "bg-lime-600 text-white font-bold"
                                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-300"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <MapPin className="size-3.5" />
                                <span className="text-xs">{harbor}</span>
                              </span>
                              {harborShopCount > 0 && (
                                <span
                                  className={`text-xs px-2 py-0.5 ${
                                    selectedHarbor === harbor
                                      ? "bg-lime-700 text-white"
                                      : "bg-stone-800 text-stone-500"
                                  }`}
                                >
                                  {harborShopCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t-2 border-stone-950 bg-stone-900 shrink-0">
          <div className="text-xs text-stone-500 text-center">
            총 {shops.length}개 상점 등록
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="legacy-shop-frame flex-1 flex flex-col min-w-0 mx-auto w-full max-w-5xl">
        {/* Top Bar */}
        <div className="legacy-shop-topbar bg-stone-900 border-b-4 border-stone-950">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                className="text-white p-2 -ml-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </button>

              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl text-lime-400 font-bold font-pixel truncate">
                  체스트샵
                </h1>
                <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
                  {selectedHarbor === "전체" ? "모든 항구" : selectedHarbor} · {filteredShops.length}개 상점
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors shrink-0"
                >
                  <Plus className="size-4" />
                  상점 추가
                </button>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="상점/아이템 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-stone-800 border-2 border-stone-700 text-white placeholder:text-stone-500 text-sm focus:outline-none focus:border-lime-600"
                  />
                </div>
              </div>
            </div>

            {/* Mobile Search + Add Button */}
            <div className="sm:hidden mt-3 flex gap-2">
              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-1 px-3 py-2 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors shrink-0"
              >
                <Plus className="size-4" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-500" />
                <input
                  type="text"
                  placeholder="상점/아이템 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-stone-800 border-2 border-stone-700 text-white placeholder:text-stone-500 text-sm focus:outline-none focus:border-lime-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Shop Grid */}
        <main className="legacy-shop-content flex-1 overflow-auto bg-stone-800">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 text-lime-400 animate-spin" />
              </div>
            ) : filteredShops.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredShops.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} formatDate={formatDate} onClick={() => navigate(`/shop/${shop.id}`)} />
                ))}
              </div>
            ) : (
              <div className="bg-stone-900 border-4 border-stone-950 p-12 text-center">
                <Package className="size-12 text-stone-600 mx-auto mb-4" />
                <h3 className="text-xl text-white font-bold mb-2">상점이 없습니다</h3>
                <p className="text-stone-400">
                  검색 조건에 맞는 상점이 없습니다
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Shop Modal */}
      {addModalOpen && (
        <AddShopModal
          onClose={() => setAddModalOpen(false)}
          onSubmit={handleAddShop}
        />
      )}

    </div>
  );
}

/* ───────────────────── Add Shop Modal ───────────────────── */

function AddShopModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { harborName: string; ownerNickname: string; description: string; coordinates: string; password: string }) => Promise<void>;
}) {
  const [harborName, setHarborName] = useState("");
  const [harborSearch, setHarborSearch] = useState("");
  const [harborDropdownOpen, setHarborDropdownOpen] = useState(false);
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHarborDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredHarbors = allHarbors.filter((h) =>
    !harborSearch.trim() || h.name.includes(harborSearch) || h.continent.includes(harborSearch)
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!harborName) newErrors.harbor = "항구를 선택해주세요";
    if (!shopName.trim()) newErrors.shopName = "상점 이름을 입력해주세요";
    if (!coordinates.trim()) newErrors.coordinates = "좌표를 입력해주세요 (예: X: 100, Z: 200)";
    if (!password.trim()) newErrors.password = "비밀번호를 입력해주세요";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        harborName,
        ownerNickname: shopName,
        description,
        coordinates,
        password,
      });
    } catch {
      setErrors({ submit: "상점 등록에 실패했습니다. 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-stone-900 border-4 border-stone-950 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-stone-950">
          <h2 className="text-lg text-lime-400 font-bold">상점 추가</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* 항구 위치 */}
          <div>
            <label className="block text-sm text-stone-300 font-bold mb-1.5">
              <MapPin className="size-3.5 inline mr-1 text-lime-400" />
              항구 위치
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setHarborDropdownOpen(!harborDropdownOpen)}
                className={`w-full px-3 py-2.5 bg-stone-800 border-2 text-sm text-left flex items-center justify-between ${
                  errors.harbor ? "border-red-500" : "border-stone-700 focus:border-lime-600"
                }`}
              >
                <span className={harborName ? "text-white" : "text-stone-500"}>
                  {harborName || "항구를 선택하세요"}
                </span>
                <ChevronDown className="size-4 text-stone-500" />
              </button>

              {harborDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-stone-800 border-2 border-stone-700 max-h-60 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-stone-700">
                    <input
                      type="text"
                      placeholder="항구 검색..."
                      value={harborSearch}
                      onChange={(e) => setHarborSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-600 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    {filteredHarbors.length > 0 ? (
                      filteredHarbors.map((h) => (
                        <button
                          key={h.name}
                          onClick={() => {
                            setHarborName(h.name);
                            setHarborDropdownOpen(false);
                            setHarborSearch("");
                            setErrors((prev) => { const n = { ...prev }; delete n.harbor; return n; });
                          }}
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-stone-700 transition-colors flex items-center justify-between ${
                            harborName === h.name ? "bg-lime-600/20 text-lime-400" : "text-white"
                          }`}
                        >
                          <span>{h.name}</span>
                          <span className="text-xs text-stone-500">{h.continent}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-stone-500 text-center">
                        검색 결과가 없습니다
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {errors.harbor && <p className="text-red-400 text-xs mt-1">{errors.harbor}</p>}
          </div>

          {/* 좌표 */}
          <div>
            <label className="block text-sm text-stone-300 font-bold mb-1.5">
              <Globe className="size-3.5 inline mr-1 text-lime-400" />
              좌표
            </label>
            <input
              type="text"
              placeholder="예: X: 1580, Z: 200"
              value={coordinates}
              onChange={(e) => {
                setCoordinates(e.target.value);
                if (errors.coordinates) setErrors((prev) => { const n = { ...prev }; delete n.coordinates; return n; });
              }}
              className={`w-full px-3 py-2.5 bg-stone-800 border-2 text-white text-sm placeholder:text-stone-500 focus:outline-none ${
                errors.coordinates ? "border-red-500" : "border-stone-700 focus:border-lime-600"
              }`}
            />
            {errors.coordinates && <p className="text-red-400 text-xs mt-1">{errors.coordinates}</p>}
          </div>

          {/* 상점 이름 */}
          <div>
            <label className="block text-sm text-stone-300 font-bold mb-1.5">
              <Store className="size-3.5 inline mr-1 text-lime-400" />
              상점 이름
            </label>
            <input
              type="text"
              placeholder="상점 이름을 입력하세요"
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value);
                if (errors.shopName) setErrors((prev) => { const n = { ...prev }; delete n.shopName; return n; });
              }}
              className={`w-full px-3 py-2.5 bg-stone-800 border-2 text-white text-sm placeholder:text-stone-500 focus:outline-none ${
                errors.shopName ? "border-red-500" : "border-stone-700 focus:border-lime-600"
              }`}
            />
            {errors.shopName && <p className="text-red-400 text-xs mt-1">{errors.shopName}</p>}
          </div>

          {/* 상점 설명 */}
          <div>
            <label className="block text-sm text-stone-300 font-bold mb-1.5">
              상점 설명
            </label>
            <textarea
              placeholder="상점에 대한 설명을 입력하세요 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600 resize-none"
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm text-stone-300 font-bold mb-1.5">
              <Lock className="size-3.5 inline mr-1 text-lime-400" />
              상점 비밀번호
            </label>
            <input
              type="password"
              placeholder="상점 관리용 비밀번호"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => { const n = { ...prev }; delete n.password; return n; });
              }}
              className={`w-full px-3 py-2.5 bg-stone-800 border-2 text-white text-sm placeholder:text-stone-500 focus:outline-none ${
                errors.password ? "border-red-500" : "border-stone-700 focus:border-lime-600"
              }`}
            />
            <p className="text-xs text-stone-500 mt-1">나중에 상점 수정/삭제 시 필요합니다</p>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>
        </div>

        {/* Footer */}
        {errors.submit && (
          <div className="px-5 pb-2">
            <p className="text-red-400 text-sm text-center">{errors.submit}</p>
          </div>
        )}
        <div className="p-5 border-t-2 border-stone-950 flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-bold transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            상점 등록
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Store Icon ───────────────────── */

function Store(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </svg>
  );
}

/* ───────────────────── Shop Card ───────────────────── */

function ShopCard({
  shop,
  formatDate,
  onClick,
}: {
  shop: Shop;
  formatDate: (d: Date) => string;
  onClick: () => void;
}) {
  return (
    <div className="bg-stone-900 border-4 border-stone-950 overflow-hidden hover:border-stone-700 transition-colors cursor-pointer" onClick={onClick}>
      <div className="shop-card-title">
        <div>
          <span>CHEST SHOP</span>
          <h3>{shop.ownerNickname}</h3>
        </div>
        <b>{shop.items.length}개 품목</b>
      </div>

      {/* Shop information */}
      <div className="p-5 pb-4">
        <div className="mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 text-sm text-stone-400 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-lime-400" />
                <span className="truncate">{shop.harborName}</span>
              </span>
              <span className="text-stone-600">{shop.coordinates}</span>
            </div>
          </div>
        </div>
        {shop.description && (
          <p className="text-sm text-stone-400 mb-3">{shop.description}</p>
        )}
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Clock className="size-3" />
          업데이트 {formatDate(shop.updatedAt)}
        </div>
      </div>

      {/* Items table */}
      {shop.items.length > 0 && (
        <div className="border-t-2 border-stone-950">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-stone-950 bg-stone-950/50">
                <th className="px-5 py-2.5 text-left text-xs text-stone-500 font-bold">
                  아이템
                </th>
                <th className="px-5 py-2.5 text-right text-xs text-stone-500 font-bold">
                  판매가
                </th>
                <th className="px-5 py-2.5 text-right text-xs text-stone-500 font-bold">
                  매입가
                </th>
                <th className="px-5 py-2.5 text-right text-xs text-stone-500 font-bold">
                  재고
                </th>
              </tr>
            </thead>
            <tbody>
              {shop.items.map((item) => (
                <tr
                  key={item.itemName}
                  className="border-b-2 border-stone-950 last:border-b-0 hover:bg-stone-800/50 transition-colors"
                >
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-white">
                      <ShopItemImage itemName={item.itemName} itemImage={item.itemImage} />
                      {item.itemName}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm text-lime-400 font-bold">
                    {item.sellPrice !== null && item.sellPrice !== undefined ? `${item.sellPrice.toLocaleString()}원` : "-"}
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm text-amber-400 font-bold">
                    {item.buyPrice !== null && item.buyPrice !== undefined ? `${item.buyPrice.toLocaleString()}원` : "-"}
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm text-stone-400">
                    {item.quantity}개
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Shop Item Image ───────────────────── */

function ShopItemImage({ itemName, itemImage }: { itemName: string; itemImage?: string }) {
  const [failed, setFailed] = useState(false);

  if (!itemImage || failed) {
    return <span>{getItemEmoji(itemName)}</span>;
  }

  return (
    <img
      src={itemImage}
      alt={itemName}
      className="size-5 object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
