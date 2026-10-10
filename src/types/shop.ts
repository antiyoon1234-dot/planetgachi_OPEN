export type UnitType = "piece" | "stack_32" | "stack_64";

export const UNIT_LABELS: Record<UnitType, string> = {
  piece: "개당",
  stack_32: "32개당",
  stack_64: "64개당",
};

export interface ShopItem {
  itemName: string;
  itemImage?: string;
  buyPrice: number | null;
  sellPrice: number | null;
  quantity: number;
  unitType: UnitType;
}

export interface Shop {
  id: string;
  harborName: string;
  coordinates: string;
  ownerNickname: string;
  description: string;
  items: ShopItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  shop: Shop;
  item: ShopItem;
}
