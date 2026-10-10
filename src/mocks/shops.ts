import { supabase } from "@/lib/supabase";
import type { Shop, ShopItem, UnitType } from "@/types/shop";

export const CONTINENTS = {
  아시아: [
    "뭄바이 항구",
    "싱가포르 항구",
    "치타공 항구",
    "마가단 항구",
    "가고시마 항구",
    "칭따오 항구",
    "다바오 항구",
    "바스라 항구",
    "홍콩 항구",
    "블라디보스토크 항구",
  ],
  유럽: [
    "안탈리아 항구",
    "리스본 항구",
    "암스테르담 항구",
    "오울루 항구",
    "아르한겔스크 항구",
    "살레하르트 항구",
  ],
  아프리카: [
    "지부티 항구",
    "케이프타운 항구",
    "세콘디타코라디 항구",
    "잔지바르 항구",
    "루안다 항구",
    "카탄가 항구",
  ],
  북아메리카: [
    "누나부트 항구",
    "누크 항구",
    "로스엔젤레스 항구",
    "루이지애나 항구",
    "앵커리지 항구",
    "퀘백 항구",
    "처칠 항구",
    "뉴펀들랜드 항구",
    "마사틀란 항구",
  ],
  중남미: [
    "수리남 항구",
    "리몬 항구",
    "부에노스아이레스 항구",
    "리우데자네이루 항구",
    "리마 항구",
    "푸에르토몬트 항구",
  ],
  오세아니아: [
    "다윈 항구",
    "포트모르즈비 항구",
    "브리즈번 항구",
    "오클랜즈 제도 기지",
  ],
  남극: [
    "케이시 남극기지",
    "킹 조지섬 남극기지",
  ],
  북극: [
    "아나디르 기지",
    "이토코르토르미트 기지",
  ],
} as const;

// DB row → Shop 변환 헬퍼
interface DbShopRow {
  id: number;
  owner_nickname: string;
  port_location_id: number | null;
  description: string;
  coordinates: string;
  harbor_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  port_locations?: { name: string } | null;
}

interface DbListingRow {
  id: number;
  shop_id: number;
  item_name: string;
  item_image: string | null;
  sell_price: number | null;
  buy_price: number | null;
  quantity: number;
  unit_type: string;
}

function dbRowToShop(row: DbShopRow, listings: DbListingRow[] = []): Shop {
  const harborName = row.harbor_name || (row.port_locations as { name: string } | null)?.name || "";
  return {
    id: String(row.id),
    harborName,
    coordinates: row.coordinates || "",
    ownerNickname: row.owner_nickname,
    description: row.description || "",
    items: listings.map((l) => ({
      itemName: l.item_name,
      itemImage: l.item_image || undefined,
      sellPrice: l.sell_price,
      buyPrice: l.buy_price,
      quantity: l.quantity || 0,
      unitType: (l.unit_type || "piece") as UnitType,
    })),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ── 상점 목록 조회 ──
export const getShops = async (): Promise<Shop[]> => {
  const { data: shops, error } = await supabase
    .from("chest_shops")
    .select("*, port_locations(name)")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error || !shops) return [];

  const shopIds = shops.map((s: DbShopRow) => s.id);
  const { data: listings } = await supabase
    .from("chest_shop_listings")
    .select("*")
    .in("shop_id", shopIds);

  const listingsByShop = new Map<number, DbListingRow[]>();
  (listings || []).forEach((l: DbListingRow) => {
    const arr = listingsByShop.get(l.shop_id) || [];
    arr.push(l);
    listingsByShop.set(l.shop_id, arr);
  });

  return shops.map((s: DbShopRow) => dbRowToShop(s, listingsByShop.get(s.id) || []));
};

// ── 상점 상세 조회 ──
export const getShopById = async (id: string): Promise<Shop | undefined> => {
  const { data: shop, error } = await supabase
    .from("chest_shops")
    .select("*, port_locations(name)")
    .eq("id", Number(id))
    .single();

  if (error || !shop) return undefined;

  const { data: listings } = await supabase
    .from("chest_shop_listings")
    .select("*")
    .eq("shop_id", shop.id);

  return dbRowToShop(shop as DbShopRow, (listings || []) as DbListingRow[]);
};

// ── port_location_id 조회 ──
async function getPortLocationId(harborName: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("port_locations")
    .select("id")
    .eq("name", harborName)
    .maybeSingle();
  if (error) console.error("getPortLocationId error:", error);
  return data?.id ?? null;
}

// ── 상점 추가 (RPC로 비밀번호 해싱) ──
export const addShop = async (
  shop: Omit<Shop, "id" | "items" | "createdAt" | "updatedAt">,
  password: string
): Promise<Shop | null> => {
  const portLocationId = await getPortLocationId(shop.harborName);

  if (!portLocationId) {
    console.error("addShop error: port_location not found for", shop.harborName);
    return null;
  }

  const { data: newId, error } = await supabase.rpc("create_chest_shop", {
    p_owner_nickname: shop.ownerNickname,
    p_harbor_name: shop.harborName,
    p_description: shop.description || "",
    p_coordinates: shop.coordinates,
    p_password: password,
    p_port_location_id: portLocationId,
  });

  if (error || !newId) {
    console.error("addShop error:", error);
    return null;
  }

  return getShopById(String(newId)) ?? null;
};

// ── 비밀번호 확인 (RPC로 서버 측 검증) ──
export const verifyShopPassword = async (shopId: string, password: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("verify_chest_shop_password", {
    p_shop_id: Number(shopId),
    p_password: password,
  });

  if (error) {
    console.error("verifyShopPassword error:", error);
    return false;
  }
  return data === true;
};

// ── 상점 수정 ──
export const updateShop = async (
  shopId: string,
  updates: Partial<Pick<Shop, "ownerNickname" | "description" | "coordinates" | "harborName">>
): Promise<boolean> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.ownerNickname !== undefined) updateData.owner_nickname = updates.ownerNickname;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.coordinates !== undefined) updateData.coordinates = updates.coordinates;
  if (updates.harborName !== undefined) {
    updateData.harbor_name = updates.harborName;
    const portId = await getPortLocationId(updates.harborName);
    if (portId) updateData.port_location_id = portId;
  }

  const { error } = await supabase
    .from("chest_shops")
    .update(updateData)
    .eq("id", Number(shopId));

  return !error;
};

// ── 상점 삭제 ──
export const deleteShop = async (shopId: string): Promise<boolean> => {
  // listings 먼저 삭제
  await supabase
    .from("chest_shop_listings")
    .delete()
    .eq("shop_id", Number(shopId));

  const { error } = await supabase
    .from("chest_shops")
    .delete()
    .eq("id", Number(shopId));

  if (error) console.error("deleteShop error:", error);
  return !error;
};

// ── 아이템 추가/수정 ──
export const addItemToShop = async (shopId: string, item: ShopItem): Promise<boolean> => {
  // 기존 아이템 확인 (같은 이름이면 수정)
  const { data: existing } = await supabase
    .from("chest_shop_listings")
    .select("id")
    .eq("shop_id", Number(shopId))
    .eq("item_name", item.itemName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("chest_shop_listings")
      .update({
        item_image: item.itemImage || null,
        sell_price: item.sellPrice,
        buy_price: item.buyPrice,
        quantity: item.quantity,
        unit_type: item.unitType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (!error) {
      await supabase.from("chest_shops").update({ updated_at: new Date().toISOString() }).eq("id", Number(shopId));
    }
    return !error;
  } else {
    // items 테이블에서 item_id 조회
    const { data: itemRow } = await supabase
      .from("items")
      .select("id")
      .eq("name", item.itemName)
      .maybeSingle();

    const insertPayload: Record<string, unknown> = {
      shop_id: Number(shopId),
      item_name: item.itemName,
      item_image: item.itemImage || null,
      sell_price: item.sellPrice,
      buy_price: item.buyPrice,
      quantity: item.quantity,
      unit_type: item.unitType,
    };
    if (itemRow?.id) insertPayload.item_id = itemRow.id;

    const { error } = await supabase
      .from("chest_shop_listings")
      .insert(insertPayload);

    if (error) {
      console.error("addItemToShop insert error:", error);
    } else {
      await supabase.from("chest_shops").update({ updated_at: new Date().toISOString() }).eq("id", Number(shopId));
    }
    return !error;
  }
};

// ── 아이템 삭제 ──
export const removeItemFromShop = async (shopId: string, itemName: string): Promise<boolean> => {
  const { error } = await supabase
    .from("chest_shop_listings")
    .delete()
    .eq("shop_id", Number(shopId))
    .eq("item_name", itemName);

  if (!error) {
    await supabase.from("chest_shops").update({ updated_at: new Date().toISOString() }).eq("id", Number(shopId));
  }
  return !error;
};

// 아이템 카탈로그 (이모지 폴백용)
export const ITEM_CATALOG = [
  { name: "다이아몬드", emoji: "💎" },
  { name: "철괴", emoji: "🪨" },
  { name: "금괴", emoji: "🥇" },
  { name: "에메랄드", emoji: "💚" },
  { name: "네더라이트 주괴", emoji: "🔥" },
  { name: "엔더 진주", emoji: "🟣" },
  { name: "레드스톤", emoji: "🔴" },
  { name: "청금석", emoji: "🔵" },
  { name: "석탄", emoji: "⚫" },
  { name: "다이아몬드 검", emoji: "⚔️" },
  { name: "네더라이트 곡괭이", emoji: "⛏️" },
  { name: "마법이 부여된 황금 사과", emoji: "🍎" },
  { name: "겉날개", emoji: "🪽" },
  { name: "불사의 토템", emoji: "🗿" },
  { name: "셜커 상자", emoji: "📦" },
  { name: "신호기", emoji: "💡" },
  { name: "철 곡괭이", emoji: "⛏️" },
  { name: "다이아몬드 곡괭이", emoji: "⛏️" },
  { name: "오크 원목", emoji: "🪵" },
  { name: "조약돌", emoji: "🪨" },
  { name: "TNT", emoji: "🧨" },
  { name: "활", emoji: "🏹" },
  { name: "화살", emoji: "➡️" },
  { name: "가죽", emoji: "🟤" },
  { name: "뼛가루", emoji: "🦴" },
  { name: "사탕수수", emoji: "🌿" },
  { name: "밀", emoji: "🌾" },
  { name: "감자", emoji: "🥔" },
  { name: "당근", emoji: "🥕" },
  { name: "구리 주괴", emoji: "🟠" },
] as const;

export const getItemEmoji = (itemName: string): string => {
  const found = ITEM_CATALOG.find((i) => i.name === itemName);
  return found?.emoji || "📦";
};
