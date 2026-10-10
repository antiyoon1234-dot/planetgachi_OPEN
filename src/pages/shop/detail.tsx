import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Clock, Package, ArrowLeft, Plus, Lock, X, Search, Trash2, Pencil, Globe, Check, Loader2 } from "lucide-react";
import {
  getShopById,
  getItemEmoji,
  verifyShopPassword,
  addItemToShop,
  removeItemFromShop,
  updateShop,
  deleteShop,
  CONTINENTS,
} from "@/mocks/shops";
import { supabase, type Item } from "@/lib/supabase";
import type { Shop, ShopItem, UnitType } from "@/types/shop";
import { UNIT_LABELS } from "@/types/shop";

type ContinentName = keyof typeof CONTINENTS;

const allHarbors = (Object.entries(CONTINENTS) as [ContinentName, readonly string[]][]).flatMap(
  ([continent, harbors]) => harbors.map((h) => ({ name: h, continent }))
);

export default function ShopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // DB items
  const [dbItems, setDbItems] = useState<Item[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Add/Edit item form
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [selectedItemImage, setSelectedItemImage] = useState("");
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("piece");
  const [itemError, setItemError] = useState("");
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Shop edit
  const [editingShop, setEditingShop] = useState(false);
  const [editShopName, setEditShopName] = useState("");
  const [editShopDesc, setEditShopDesc] = useState("");
  const [editShopCoords, setEditShopCoords] = useState("");
  const [editShopHarbor, setEditShopHarbor] = useState("");
  const [harborSearch, setHarborSearch] = useState("");
  const [harborDropdownOpen, setHarborDropdownOpen] = useState(false);
  const harborDropdownRef = useRef<HTMLDivElement>(null);

  // Shop delete
  const [confirmShopDelete, setConfirmShopDelete] = useState(false);

  const loadShop = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await getShopById(id);
    setShop(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  // Load DB items
  useEffect(() => {
    const loadItems = async () => {
      setDbLoading(true);
      try {
        const { data, error } = await supabase
          .from("items")
          .select("*")
          .eq("status", "approved")
          .order("name");
        if (!error && data) setDbItems(data);
      } catch {
        // fallback: no DB items
      } finally {
        setDbLoading(false);
      }
    };
    loadItems();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setItemDropdownOpen(false);
      }
      if (harborDropdownRef.current && !harborDropdownRef.current.contains(e.target as Node)) {
        setHarborDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-stone-800 flex items-center justify-center">
        <Loader2 className="size-8 text-lime-400 animate-spin" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-stone-800 flex items-center justify-center">
        <div className="text-center">
          <Package className="size-12 text-stone-600 mx-auto mb-4" />
          <h2 className="text-xl text-white font-bold mb-2">상점을 찾을 수 없습니다</h2>
          <button
            onClick={() => navigate("/shop")}
            className="mt-4 px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors"
          >
            상점 목록으로
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const handleUnlock = async () => {
    const ok = await verifyShopPassword(shop.id, password);
    if (ok) {
      setUnlocked(true);
      setPasswordError("");
    } else {
      setPasswordError("비밀번호가 일치하지 않습니다");
    }
  };

  // Filter DB items by search query
  const filteredDbItems = dbItems.filter((item) =>
    !itemSearch.trim() ||
    item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const handleSelectDbItem = (item: Item) => {
    setSelectedItemName(item.name);
    setSelectedItemImage(item.image);
    setItemSearch(item.name);
    setIsCustomItem(false);
    setItemDropdownOpen(false);
    setItemError("");
  };

  const handleCustomItem = () => {
    setSelectedItemName(itemSearch.trim());
    setSelectedItemImage("");
    setIsCustomItem(true);
    setItemDropdownOpen(false);
    setItemError("");
  };

  const handleAddItem = async () => {
    const name = selectedItemName || itemSearch.trim();
    if (!name) {
      setItemError("아이템을 선택하거나 이름을 입력해주세요");
      return;
    }
    if (!sellPrice && !buyPrice) {
      setItemError("판매가 또는 매입가를 입력해주세요");
      return;
    }

    const newItem: ShopItem = {
      itemName: name,
      itemImage: selectedItemImage || undefined,
      sellPrice: sellPrice ? Number(sellPrice) : null,
      buyPrice: buyPrice ? Number(buyPrice) : null,
      quantity: quantity ? Number(quantity) : 0,
      unitType,
    };

    setSaving(true);
    const success = await addItemToShop(shop.id, newItem);
    if (success) {
      await loadShop();
      resetItemForm();
    } else {
      setItemError("아이템 추가에 실패했습니다. 콘솔을 확인해주세요.");
    }
    setSaving(false);
  };

  const startEditItem = (item: ShopItem) => {
    setEditingItem(item);
    setAddingItem(true);
    setItemSearch(item.itemName);
    setSelectedItemName(item.itemName);
    setSelectedItemImage(item.itemImage || "");
    setIsCustomItem(!item.itemImage);
    setSellPrice(item.sellPrice !== null ? String(item.sellPrice) : "");
    setBuyPrice(item.buyPrice !== null ? String(item.buyPrice) : "");
    setQuantity(item.quantity !== 0 ? String(item.quantity) : "");
    setUnitType(item.unitType || "piece");
    setItemError("");
  };

  const handleRemoveItem = (itemName: string) => {
    setConfirmDelete(itemName);
  };

  const confirmRemoveItem = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    await removeItemFromShop(shop.id, confirmDelete);
    setShop((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((i) => i.itemName !== confirmDelete),
        updatedAt: new Date(),
      };
    });
    setConfirmDelete(null);
    setSaving(false);
  };

  const resetItemForm = () => {
    setItemSearch("");
    setSelectedItemName("");
    setSelectedItemImage("");
    setIsCustomItem(false);
    setSellPrice("");
    setBuyPrice("");
    setQuantity("");
    setUnitType("piece");
    setItemError("");
    setAddingItem(false);
    setEditingItem(null);
  };

  const formatPrice = (price: number | null, unit: UnitType) => {
    if (price === null || price === undefined) return "-";
    return `${price.toLocaleString()}원/${UNIT_LABELS[unit]}`;
  };

  // Shop edit handlers
  const startEditShop = () => {
    setEditShopName(shop.ownerNickname);
    setEditShopDesc(shop.description);
    setEditShopCoords(shop.coordinates);
    setEditShopHarbor(shop.harborName);
    setHarborSearch("");
    setEditingShop(true);
  };

  const handleSaveShop = async () => {
    if (!editShopName.trim()) return;
    if (!editShopCoords.trim()) return;
    if (!editShopHarbor) return;
    setSaving(true);
    const success = await updateShop(shop.id, {
      ownerNickname: editShopName.trim(),
      description: editShopDesc.trim(),
      coordinates: editShopCoords.trim(),
      harborName: editShopHarbor,
    });
    if (success) {
      await loadShop();
      setEditingShop(false);
    }
    setSaving(false);
  };

  const handleDeleteShop = async () => {
    setSaving(true);
    const success = await deleteShop(shop.id);
    if (success) {
      navigate("/shop");
    } else {
      setConfirmShopDelete(false);
      setSaving(false);
    }
  };

  const filteredHarbors = allHarbors.filter((h) =>
    !harborSearch.trim() || h.name.includes(harborSearch) || h.continent.includes(harborSearch)
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-stone-800">
      <div className="max-w-4xl mx-auto">
        {/* Top Navigation */}
        <div className="bg-stone-900 border-b-4 border-stone-950 sticky top-[80px] z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate("/shop")}
              className="text-stone-400 hover:text-white transition-colors p-1"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl text-lime-400 font-bold font-pixel truncate">
                {shop.ownerNickname}
              </h1>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-lime-400" />
                  {shop.harborName}
                </span>
                <span className="text-stone-600">{shop.coordinates}</span>
              </div>
            </div>
            {!unlocked && (
              <div className="shrink-0">
                <Lock className="size-4 text-stone-500" />
              </div>
            )}
            {unlocked && (
              <span className="text-xs bg-lime-600/20 text-lime-400 px-2 py-1 font-bold shrink-0">
                관리 모드
              </span>
            )}
          </div>
        </div>

        {/* Shop Info */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Description Card */}
          <div className="bg-stone-900 border-4 border-stone-950 p-5 mb-6">
            {shop.description && (
              <p className="text-sm text-stone-300 mb-3">{shop.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-stone-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                생성: {formatDate(shop.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                업데이트: {formatDate(shop.updatedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Package className="size-3" />
                {shop.items.length}개 아이템
              </span>
            </div>
            {unlocked && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={startEditShop}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-colors"
                >
                  <Pencil className="size-3.5" />
                  상점 수정
                </button>
                <button
                  onClick={() => setConfirmShopDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  상점 삭제
                </button>
              </div>
            )}
          </div>

          {/* Password Section */}
          {!unlocked && (
            <div className="bg-stone-900 border-4 border-stone-950 p-5 mb-6">
              <label className="block text-sm text-stone-300 font-bold mb-2">
                <Lock className="size-3.5 inline mr-1.5 text-lime-400" />
                비밀번호를 입력하면 아이템을 관리할 수 있습니다
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="상점 비밀번호"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  className={`flex-1 px-3 py-2.5 bg-stone-800 border-2 text-white text-sm placeholder:text-stone-500 focus:outline-none ${
                    passwordError ? "border-red-500" : "border-stone-700 focus:border-lime-600"
                  }`}
                />
                <button
                  onClick={handleUnlock}
                  className="px-5 py-2.5 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors"
                >
                  확인
                </button>
              </div>
              {passwordError && <p className="text-red-400 text-xs mt-1.5">{passwordError}</p>}
            </div>
          )}

          {/* Items Section */}
          <div className="bg-stone-900 border-4 border-stone-950 overflow-hidden">
            {/* Items Header */}
            <div className="px-5 py-4 border-b-2 border-stone-950 flex items-center justify-between">
              <h2 className="text-white font-bold">판매 아이템</h2>
              {unlocked && !addingItem && (
                <button
                  onClick={() => setAddingItem(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold transition-colors"
                >
                  <Plus className="size-3.5" />
                  아이템 추가
                </button>
              )}
            </div>

            {/* Add/Edit Item Form */}
            {unlocked && addingItem && (
              <div className="px-5 py-4 bg-stone-950/30 border-b-2 border-stone-950">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm text-lime-400 font-bold">
                    {editingItem ? "아이템 수정" : "아이템 추가"}
                  </h3>
                  <button onClick={resetItemForm} className="text-stone-400 hover:text-white">
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Item Search - DB based */}
                  <div ref={dropdownRef} className="relative">
                    <label className="block text-xs text-stone-400 mb-1">아이템 선택 *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-500" />
                      <input
                        type="text"
                        placeholder="아이템 검색..."
                        value={itemSearch}
                        onChange={(e) => {
                          setItemSearch(e.target.value);
                          setSelectedItemName("");
                          setSelectedItemImage("");
                          setIsCustomItem(false);
                          setItemDropdownOpen(true);
                          setItemError("");
                        }}
                        onFocus={() => setItemDropdownOpen(true)}
                        disabled={!!editingItem}
                        className={`w-full pl-10 pr-24 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600 ${editingItem ? "opacity-60 cursor-not-allowed" : ""}`}
                      />
                      {selectedItemName && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-lime-400 bg-lime-600/20 px-2 py-0.5">
                          {isCustomItem ? "직접 입력" : "선택됨"}
                        </span>
                      )}
                    </div>

                    {itemDropdownOpen && !editingItem && (
                      <div className="absolute z-10 w-full mt-1 bg-stone-800 border-2 border-stone-700 max-h-56 overflow-hidden flex flex-col">
                        <div className="overflow-y-auto">
                          {dbLoading ? (
                            <div className="px-3 py-4 text-sm text-stone-500 text-center">
                              로딩 중...
                            </div>
                          ) : filteredDbItems.length > 0 ? (
                            filteredDbItems.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => handleSelectDbItem(item)}
                                className={`w-full px-3 py-2.5 text-sm text-left hover:bg-stone-700 transition-colors flex items-center gap-3 ${
                                  selectedItemName === item.name ? "bg-lime-600/20" : ""
                                }`}
                              >
                                <ItemImage itemName={item.name} itemImage={item.image} />
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium truncate ${selectedItemName === item.name ? "text-lime-400" : "text-white"}`}>
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-stone-500">
                                    현재 가치: {item.current_value.toLocaleString()}원
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : itemSearch.trim() ? null : (
                            <div className="px-3 py-4 text-sm text-stone-500 text-center">
                              등록된 아이템이 없습니다
                            </div>
                          )}

                          {/* Custom input option */}
                          {itemSearch.trim() && (
                            <button
                              onClick={handleCustomItem}
                              className="w-full px-3 py-2.5 text-sm text-left hover:bg-stone-700 transition-colors flex items-center gap-2 border-t border-stone-700 text-amber-400 sticky bottom-0 bg-stone-800"
                            >
                              <Plus className="size-4 shrink-0" />
                              <span>"{itemSearch.trim()}" 직접 추가</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Unit Type Selector */}
                  <div>
                    <label className="block text-xs text-stone-400 mb-1.5">판매 단위</label>
                    <div className="flex gap-2">
                      {(Object.keys(UNIT_LABELS) as UnitType[]).map((ut) => (
                        <button
                          key={ut}
                          onClick={() => setUnitType(ut)}
                          className={`flex-1 px-3 py-2 text-sm font-bold transition-colors ${
                            unitType === ut
                              ? "bg-lime-600 text-white"
                              : "bg-stone-800 text-stone-400 border-2 border-stone-700 hover:border-stone-600"
                          }`}
                        >
                          {UNIT_LABELS[ut]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price & Quantity */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">판매가</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">매입가</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={buyPrice}
                        onChange={(e) => setBuyPrice(e.target.value)}
                        className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">재고</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600"
                      />
                    </div>
                  </div>

                  {itemError && <p className="text-red-400 text-xs">{itemError}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={resetItemForm}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-bold transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAddItem}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      {editingItem ? "저장" : "추가"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            {shop.items.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-stone-950 bg-stone-950/50">
                    <th className="px-5 py-3 text-left text-xs text-stone-500 font-bold">아이템</th>
                    <th className="px-5 py-3 text-right text-xs text-stone-500 font-bold">판매가</th>
                    <th className="px-5 py-3 text-right text-xs text-stone-500 font-bold">매입가</th>
                    <th className="px-5 py-3 text-right text-xs text-stone-500 font-bold">재고</th>
                    {unlocked && <th className="px-3 py-3 w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {shop.items.map((item) => (
                    <tr
                      key={item.itemName}
                      className="border-b-2 border-stone-950 last:border-b-0 hover:bg-stone-800/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5 text-sm text-white">
                          <ItemImage itemName={item.itemName} itemImage={item.itemImage} />
                          <span className="font-medium">{item.itemName}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm text-lime-400 font-bold">
                          {formatPrice(item.sellPrice, item.unitType || "piece")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm text-amber-400 font-bold">
                          {formatPrice(item.buyPrice, item.unitType || "piece")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-stone-400">
                        {item.quantity}개
                      </td>
                      {unlocked && (
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEditItem(item)}
                              className="text-stone-500 hover:text-lime-400 transition-colors p-1"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.itemName)}
                              className="text-red-400/60 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Package className="size-10 text-stone-600 mx-auto mb-3" />
                <p className="text-stone-500 text-sm">등록된 아이템이 없습니다</p>
                {unlocked && (
                  <button
                    onClick={() => setAddingItem(true)}
                    className="mt-3 px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    첫 아이템 추가하기
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Item Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-stone-900 border-4 border-stone-950 w-full max-w-sm mx-4 p-6 text-center">
            <Trash2 className="size-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-bold mb-1">아이템 삭제</h3>
            <p className="text-sm text-stone-400 mb-5">
              <span className="text-white font-medium">{confirmDelete}</span>을(를) 정말 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-bold transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmRemoveItem}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shop Edit Modal */}
      {editingShop && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditingShop(false)} />
          <div className="relative bg-stone-900 border-4 border-stone-950 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-stone-950">
              <h2 className="text-lg text-lime-400 font-bold">상점 수정</h2>
              <button onClick={() => setEditingShop(false)} className="text-stone-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 항구 위치 */}
              <div>
                <label className="block text-sm text-stone-300 font-bold mb-1.5">
                  <MapPin className="size-3.5 inline mr-1 text-lime-400" />
                  항구 위치
                </label>
                <div ref={harborDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setHarborDropdownOpen(!harborDropdownOpen)}
                    className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-sm text-left flex items-center justify-between"
                  >
                    <span className={editShopHarbor ? "text-white" : "text-stone-500"}>
                      {editShopHarbor || "항구를 선택하세요"}
                    </span>
                    <Globe className="size-4 text-stone-500" />
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
                        {filteredHarbors.map((h) => (
                          <button
                            key={h.name}
                            onClick={() => {
                              setEditShopHarbor(h.name);
                              setHarborDropdownOpen(false);
                              setHarborSearch("");
                            }}
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-stone-700 transition-colors flex items-center justify-between ${
                              editShopHarbor === h.name ? "bg-lime-600/20 text-lime-400" : "text-white"
                            }`}
                          >
                            <span>{h.name}</span>
                            <span className="text-xs text-stone-500">{h.continent}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                  value={editShopCoords}
                  onChange={(e) => setEditShopCoords(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600"
                />
              </div>

              {/* 상점 이름 */}
              <div>
                <label className="block text-sm text-stone-300 font-bold mb-1.5">
                  상점 이름
                </label>
                <input
                  type="text"
                  placeholder="상점 이름을 입력하세요"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600"
                />
              </div>

              {/* 상점 설명 */}
              <div>
                <label className="block text-sm text-stone-300 font-bold mb-1.5">
                  상점 설명
                </label>
                <textarea
                  placeholder="상점에 대한 설명을 입력하세요 (선택)"
                  value={editShopDesc}
                  onChange={(e) => setEditShopDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-stone-800 border-2 border-stone-700 text-white text-sm placeholder:text-stone-500 focus:outline-none focus:border-lime-600 resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t-2 border-stone-950 flex gap-2">
              <button
                onClick={() => setEditingShop(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-bold transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveShop}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-lime-600 hover:bg-lime-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shop Delete Confirm Modal */}
      {confirmShopDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmShopDelete(false)} />
          <div className="relative bg-stone-900 border-4 border-stone-950 w-full max-w-sm mx-4 p-6 text-center">
            <Trash2 className="size-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-bold mb-1">상점 삭제</h3>
            <p className="text-sm text-stone-400 mb-2">
              <span className="text-white font-medium">{shop.ownerNickname}</span> 상점을 정말 삭제하시겠습니까?
            </p>
            <p className="text-xs text-red-400 mb-5">
              삭제된 상점은 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmShopDelete(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-bold transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteShop}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemImage({ itemName, itemImage }: { itemName: string; itemImage?: string }) {
  const [failed, setFailed] = useState(false);

  if (!itemImage || failed) {
    return <span className="text-base">{getItemEmoji(itemName)}</span>;
  }

  return (
    <img
      src={itemImage}
      alt={itemName}
      className="size-6 object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
