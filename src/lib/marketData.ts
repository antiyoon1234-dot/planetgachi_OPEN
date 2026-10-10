export type MarketItem = {
  id: string;
  name: string;
  category: string;
  icon: string;
  transactions: {
    price: number;
    at: string;
    seller: string;
    itemName?: string;
    itemCode?: string;
  }[];
  publishedSummary?: {
    average: number;
    price: number;
    sitePrice?: number;
    anomalyCount: number;
    sampleSize: number;
    cap?: number;
  };
};

export type PriceRule = {
  cap?: number;
  includeAnomalies: boolean;
};

export type MarketSettings = {
  rules: Record<string, PriceRule>;
  anomalyRate: number;
  minimumSamples: number;
  banners: MarketBanner[];
};

export type MarketBanner = {
  id: number;
  title: string;
  description: string;
  image?: string;
  link?: string;
  active: boolean;
};

export const defaultBanners: MarketBanner[] = [
  {
    id: 1,
    title: "플래닛어스 경제를\n한눈에.",
    description:
      "플래닛어스 서버 거래소와 유저분들 참여를 바탕으로 만든 시세 안내소입니다. 유저수정 가격과 실제 거래소 평균가를 분리해 보여드려요.",
    active: true,
  },
  {
    id: 2,
    title: "거래소 평균가와\n사이트 가격을 비교하세요.",
    description:
      "이상 거래는 분리하고, 관리자가 설정한 상한가는 사이트 적용가에만 반영합니다.",
    active: true,
  },
  {
    id: 3,
    title: "유저와 함께 만드는\n더 정확한 시세.",
    description:
      "최근 거래 기록과 유저 참여를 바탕으로 플래닛어스 경제 정보를 투명하게 안내합니다.",
    active: true,
  },
];

export const demoItems: MarketItem[] = [
  {
    id: "diamond",
    name: "다이아몬드",
    category: "광물",
    icon: "◆",
    transactions: [
      { price: 1010, at: "10:42", seller: "minsu" },
      { price: 980, at: "10:28", seller: "crafty" },
      { price: 1000, at: "09:51", seller: "stone" },
      { price: 990, at: "09:12", seller: "hera" },
      { price: 2800, at: "08:33", seller: "suspicious" },
    ],
  },
  {
    id: "netherite_ingot",
    name: "네더라이트 주괴",
    category: "광물",
    icon: "✦",
    transactions: [
      { price: 12600, at: "10:35", seller: "minsu" },
      { price: 12100, at: "10:11", seller: "nova" },
      { price: 12400, at: "09:42", seller: "crafty" },
      { price: 12000, at: "09:05", seller: "gear" },
    ],
  },
  {
    id: "ender_pearl",
    name: "엔더 진주",
    category: "전리품",
    icon: "●",
    transactions: [
      { price: 520, at: "10:30", seller: "hera" },
      { price: 500, at: "10:03", seller: "stone" },
      { price: 510, at: "09:39", seller: "minsu" },
      { price: 495, at: "09:14", seller: "nova" },
    ],
  },
  {
    id: "elytra",
    name: "겉날개",
    category: "장비",
    icon: "⌁",
    transactions: [
      { price: 44000, at: "10:18", seller: "sky" },
      { price: 42000, at: "09:45", seller: "crafty" },
      { price: 43000, at: "09:09", seller: "minsu" },
      { price: 90000, at: "08:11", seller: "suspicious" },
    ],
  },
  {
    id: "enchanted_golden_apple",
    name: "마법이 부여된 황금 사과",
    category: "소비품",
    icon: "✹",
    transactions: [
      { price: 7800, at: "10:08", seller: "gold" },
      { price: 7600, at: "09:24", seller: "hera" },
      { price: 7700, at: "08:58", seller: "stone" },
    ],
  },
  {
    id: "shulker_box",
    name: "셜커 상자",
    category: "보관함",
    icon: "▣",
    transactions: [
      { price: 3400, at: "10:01", seller: "boxer" },
      { price: 3300, at: "09:50", seller: "nova" },
      { price: 3350, at: "09:22", seller: "minsu" },
      { price: 3400, at: "08:45", seller: "crafty" },
    ],
  },
];

export const defaultSettings: MarketSettings = {
  rules: {
    diamond: { cap: 960, includeAnomalies: false },
    elytra: { cap: 43000, includeAnomalies: false },
  },
  anomalyRate: 50,
  minimumSamples: 3,
  banners: defaultBanners,
};

const storageKey = "planetgachi-market-settings";

export function loadSettings(): MarketSettings {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved
      ? {
          ...defaultSettings,
          ...JSON.parse(saved),
          rules: { ...defaultSettings.rules, ...JSON.parse(saved).rules },
          banners: JSON.parse(saved).banners ?? defaultBanners,
        }
      : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: MarketSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
  window.dispatchEvent(new Event("market-settings-updated"));
}

export function getMarketSummary(item: MarketItem, settings: MarketSettings) {
  if (item.publishedSummary) {
    return {
      ...item.publishedSummary,
      hasEnoughSamples:
        item.publishedSummary.sampleSize >= settings.minimumSamples,
      hasSitePrice: Number.isFinite(item.publishedSummary.sitePrice),
    };
  }
  const rule = settings.rules[item.id] ?? { includeAnomalies: false };
  if (!item.transactions.length) {
    return {
      average: 0,
      price: 0,
      cap: rule.cap,
      anomalyCount: 0,
      sampleSize: 0,
      hasEnoughSamples: false,
      hasSitePrice: false,
    };
  }
  const rawMean =
    item.transactions.reduce((sum, tx) => sum + tx.price, 0) /
    item.transactions.length;
  const deviation = settings.anomalyRate / 100;
  const normalTransactions = item.transactions.filter(
    (tx) => Math.abs(tx.price - rawMean) / rawMean <= deviation,
  );
  const included = rule.includeAnomalies
    ? item.transactions
    : normalTransactions;
  const average =
    included.reduce((sum, tx) => sum + tx.price, 0) / included.length;
  const anomalyCount = item.transactions.length - normalTransactions.length;
  const cappedPrice = rule.cap
    ? Math.min(Math.round(average), rule.cap)
    : Math.round(average);
  return {
    average: Math.round(average),
    price: cappedPrice,
    sitePrice: cappedPrice,
    cap: rule.cap,
    anomalyCount,
    sampleSize: included.length,
    hasEnoughSamples: included.length >= settings.minimumSamples,
    hasSitePrice: true,
  };
}
