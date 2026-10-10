export type MarketUnitType = "piece" | "set" | "stack" | null | undefined;

export function getUnitAmount(unitType: MarketUnitType) {
  if (unitType === "stack") return 64;
  if (unitType === "set") return 16;
  return 1;
}

export function getUnitLabel(unitType: MarketUnitType) {
  if (unitType === "stack") return "64개 단위";
  if (unitType === "set") return "16개 단위";
  return "개별 1개";
}

export function floorToHundreds(value: number) {
  return Math.floor(Number(value) / 100) * 100;
}

// Auction records may be sold in arbitrary stack sizes. Normalize every
// auction price to the catalog unit before comparing it with a site price.
export function toCatalogUnitPrice(
  auctionPrice: number,
  auctionAmount: number | null | undefined,
  unitType: MarketUnitType,
) {
  const amount = Math.max(1, Number(auctionAmount ?? 1));
  return floorToHundreds((Number(auctionPrice) / amount) * getUnitAmount(unitType));
}
