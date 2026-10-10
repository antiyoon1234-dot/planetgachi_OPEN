import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Coins,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
} from "lucide-react";
import { getItemName } from "../../lib/itemNames";
import {
  demoItems,
  getMarketSummary,
  loadSettings,
  type MarketBanner,
  type MarketItem,
  type MarketSettings,
} from "../../lib/marketData";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";
import {
  floorToHundreds,
  getUnitAmount,
  getUnitLabel,
  toCatalogUnitPrice,
} from "../../lib/marketUnits";

const won = new Intl.NumberFormat("ko-KR");

function getUsableBannerImage(image?: string) {
  const value = image?.trim();
  if (!value || ["text-only", "none", "null", "undefined"].includes(value.toLowerCase())) {
    return undefined;
  }
  return value;
}

type PriceRow = {
  item_key: string;
  item_type: string;
  display_name: string;
  auction_average_price: number | null;
  display_price: number | null;
  transaction_count: number;
  excluded_anomaly_count: number;
  price_cap: number | null;
};

type TransactionRow = {
  item_type: string;
  price: number;
  transaction_date: string;
  item_info: { amount?: number; displayName?: string | null } | null;
};

type ProposalPriceRow = {
  item_code: string;
  item_name: string;
  proposed_value: number;
  submitted_at: string;
};

type CatalogItemRow = {
  id: number;
  code: string;
  name: string;
  current_value: number | null;
  unit_type: "piece" | "set" | "stack" | null;
};

type CalculatedAuctionSummary = {
  average: number;
  sampleSize: number;
  anomalyCount: number;
};

function calculateAuctionSummary(
  transactions: TransactionRow[],
  unitType: CatalogItemRow["unit_type"],
  anomalyRate: number,
): CalculatedAuctionSummary {
  const normalizedPrices = transactions
    .map((transaction) => {
      const amount = Math.max(1, Number(transaction.item_info?.amount ?? 1));
      return (Number(transaction.price) / amount) * getUnitAmount(unitType);
    })
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (!normalizedPrices.length) {
    return { average: 0, sampleSize: 0, anomalyCount: 0 };
  }

  // A simple average can be pulled far away from the real market price by a
  // single accidental listing. Use the median as the stable baseline, then
  // calculate the displayed average only from prices within the admin range.
  const orderedPrices = [...normalizedPrices].sort((a, b) => a - b);
  const midpoint = Math.floor(orderedPrices.length / 2);
  const median =
    orderedPrices.length % 2
      ? orderedPrices[midpoint]
      : (orderedPrices[midpoint - 1] + orderedPrices[midpoint]) / 2;
  const allowedDeviation = Math.max(0, anomalyRate) / 100;
  const normalPrices = normalizedPrices.filter(
    (price) =>
      median === 0 ||
      Math.abs(price - median) / median <= allowedDeviation,
  );
  const includedPrices = normalPrices.length ? normalPrices : normalizedPrices;

  return {
    average: floorToHundreds(
      includedPrices.reduce((sum, price) => sum + price, 0) /
        includedPrices.length,
    ),
    sampleSize: includedPrices.length,
    anomalyCount: normalizedPrices.length - normalPrices.length,
  };
}

async function loadAuctionTransactions(since?: string) {
  const pageSize = 1000;
  const transactions: TransactionRow[] = [];

  for (let from = 0; from < 50_000; from += pageSize) {
    let query = supabase
      .from("auction_transactions")
      .select("item_type,price,transaction_date,item_info")
      .order("transaction_date", { ascending: false });
    if (since) query = query.gte("transaction_date", since);
    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error || !data?.length) break;
    transactions.push(...(data as TransactionRow[]));
    if (data.length < pageSize) break;
  }

  return transactions;
}

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function proposalKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function marketItemNameKey(value: string) {
  return proposalKey(value).replaceAll("블럭", "블록");
}

function itemCodeKey(value: string) {
  return value
    .toLowerCase()
    .replace("minecraft:", "")
    .replace(/[^a-z0-9가-힣]/g, "");
}

export default function MarketPage() {
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<MarketSettings>(loadSettings());
  const [selected, setSelected] = useState(demoItems[0].id);
  const [liveItems, setLiveItems] = useState<MarketItem[] | null>(null);
  const [remoteBanners, setRemoteBanners] = useState<MarketBanner[] | null>(
    null,
  );
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    const refresh = () => setSettings(loadSettings());
    window.addEventListener("market-settings-updated", refresh);
    return () => window.removeEventListener("market-settings-updated", refresh);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let cancelled = false;

    async function loadLiveMarket() {
      const [
        { data: marketConfig },
        priceQuery,
        { data: approvedProposals },
        { data: siteItems },
      ] = await Promise.all([
        supabase
          .from("market_settings")
          .select("setting_value")
          .eq("setting_key", "market_ui")
          .maybeSingle(),
        supabase
          .from("auction_market_prices")
          .select("*")
          .order("display_name"),
        supabase
          .from("proposals")
          .select("item_code,item_name,proposed_value,submitted_at")
          .eq("status", "approved")
          .order("submitted_at", { ascending: false }),
        supabase
          .from("items")
          .select("id,code,name,current_value,unit_type")
          .eq("status", "approved")
          .order("name"),
      ]);

      if (cancelled) return;
      if (
        marketConfig?.setting_value &&
        typeof marketConfig.setting_value === "object"
      ) {
        const saved = marketConfig.setting_value as Partial<MarketSettings>;
        setSettings((current) => ({
          ...current,
          ...saved,
          rules: { ...current.rules, ...(saved.rules ?? {}) },
          banners: saved.banners ?? current.banners,
        }));
      }

      const rows = ((priceQuery.data ?? []) as PriceRow[]).map((row) => ({
        ...row,
        auction_average_price: row.auction_average_price === null ? null : floorToHundreds(row.auction_average_price),
        display_price: row.display_price === null ? null : floorToHundreds(row.display_price),
      }));
      const catalog = (siteItems ?? []) as CatalogItemRow[];
      if (!catalog.length) return;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const allTransactionRows = await loadAuctionTransactions(
        sevenDaysAgo.toISOString(),
      );
      const transactionRows = allTransactionRows;
      if (cancelled) return;

      const transactionsByType = new Map<string, TransactionRow[]>();
      const transactionsByName = new Map<string, TransactionRow[]>();
      allTransactionRows.forEach((transaction) => {
        const typeKey = itemCodeKey(transaction.item_type);
        const displayName = transaction.item_info?.displayName?.trim();
        const standardName = getItemName(transaction.item_type);
        if (!displayName || marketItemNameKey(displayName) === marketItemNameKey(standardName)) {
          const existing = transactionsByType.get(typeKey) ?? [];
          existing.push(transaction);
          transactionsByType.set(typeKey, existing);
        }
        const nameKey = marketItemNameKey(displayName || standardName);
        const nameMatches = transactionsByName.get(nameKey) ?? [];
        nameMatches.push(transaction);
        transactionsByName.set(nameKey, nameMatches);
      });
      const recentTransactionsByType = new Map<string, TransactionRow[]>();
      const recentTransactionsByName = new Map<string, TransactionRow[]>();
      transactionRows.forEach((transaction) => {
        const typeKey = itemCodeKey(transaction.item_type);
        const displayName = transaction.item_info?.displayName?.trim();
        const standardName = getItemName(transaction.item_type);
        if (!displayName || marketItemNameKey(displayName) === marketItemNameKey(standardName)) {
          const existing = recentTransactionsByType.get(typeKey) ?? [];
          existing.push(transaction);
          recentTransactionsByType.set(typeKey, existing);
        }
        const nameKey = marketItemNameKey(displayName || standardName);
        const nameMatches = recentTransactionsByName.get(nameKey) ?? [];
        nameMatches.push(transaction);
        recentTransactionsByName.set(nameKey, nameMatches);
      });
      const sitePriceByName = new Map<string, number>();
      const sitePriceByCode = new Map<string, number>();
      ((approvedProposals ?? []) as ProposalPriceRow[]).forEach((proposal) => {
        const nameKey = proposalKey(proposal.item_name);
        const codeKey = itemCodeKey(proposal.item_code);
        const price = Number(proposal.proposed_value);
        if (
          nameKey &&
          Number.isFinite(price) &&
          price > 0 &&
          !sitePriceByName.has(nameKey)
        )
          sitePriceByName.set(nameKey, price);
        if (
          codeKey &&
          Number.isFinite(price) &&
          price > 0 &&
          !sitePriceByCode.has(codeKey)
        )
          sitePriceByCode.set(codeKey, price);
      });
      setLiveItems(
        catalog.map((item) => {
          const unitType = item.unit_type ?? "piece";
          const codeKey = itemCodeKey(item.code);
          const nameKey = proposalKey(item.name);
          const marketNameKey = marketItemNameKey(item.name);
          const row = rows
            .filter(
              (price) =>
                itemCodeKey(price.item_type) === codeKey ||
                proposalKey(price.display_name) === nameKey,
            )
            .sort(
              (a, b) =>
                Number(b.transaction_count) - Number(a.transaction_count),
            )[0];
          const itemTransactions =
            transactionsByName.get(marketNameKey) ??
            transactionsByType.get(itemCodeKey(row?.item_type ?? item.code)) ??
            [];
          const recentItemTransactions =
            recentTransactionsByName.get(marketNameKey) ??
            recentTransactionsByType.get(
              itemCodeKey(row?.item_type ?? item.code),
            ) ?? [];
          const calculatedSummary = calculateAuctionSummary(
            itemTransactions,
            unitType,
            settings.anomalyRate,
          );
          const storedAverage = Number(row?.auction_average_price);
          const hasStoredAggregate =
            Number.isFinite(storedAverage) && storedAverage >= 0;
          const fallbackSitePrice = Number(item.current_value ?? 0);
          const sitePrice =
            sitePriceByName.get(proposalKey(item.name)) ??
            sitePriceByCode.get(codeKey) ??
            (fallbackSitePrice > 0 ? fallbackSitePrice : undefined);
          return {
            id: `site-${item.id}`,
            name: item.name,
            category: getUnitLabel(unitType),
            icon: "",
            transactions: recentItemTransactions.slice(0, 8).map((transaction) => ({
              price: toCatalogUnitPrice(
                Number(transaction.price),
                transaction.item_info?.amount,
                unitType,
              ),
              at: displayTime(transaction.transaction_date),
              seller: "거래소",
              itemName: item.name,
              itemCode: item.code,
            })),
            publishedSummary: {
              average: hasStoredAggregate
                ? toCatalogUnitPrice(storedAverage, 1, unitType)
                : calculatedSummary.average,
              price: sitePrice ?? 0,
              sitePrice,
              anomalyCount: hasStoredAggregate
                ? Number(row?.excluded_anomaly_count ?? 0)
                : calculatedSummary.anomalyCount,
              sampleSize: hasStoredAggregate
                ? Number(row?.transaction_count ?? 0)
                : calculatedSummary.sampleSize,
              cap: row?.price_cap ?? undefined,
            },
          };
        }),
      );
    }

    const refreshMarketItems = () => void loadLiveMarket();
    window.addEventListener("market-items-updated", refreshMarketItems);
    void loadLiveMarket();
    return () => {
      cancelled = true;
      window.removeEventListener("market-items-updated", refreshMarketItems);
    };
  }, [settings.anomalyRate]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    supabase
      .from("banners")
      .select("id,title,image,link")
      .eq("active", true)
      .order("id")
      .then(({ data, error }) => {
        if (!error && data?.length) {
          setRemoteBanners(
            data.map((banner) => ({
              id: banner.id,
              title: banner.title,
              description: "플래닛어스 서버의 새 소식과 안내를 확인하세요.",
              image: banner.image,
              link: banner.link,
              active: true,
            })),
          );
        }
      });
  }, []);

  const banners = useMemo(() => {
    // The legacy market-ui settings and the banners table use different IDs.
    // Keep each title and image together by treating active admin banners as
    // the source of truth whenever at least one has been registered.
    if (remoteBanners?.length) return remoteBanners;
    return settings.banners.filter((banner) => banner.active);
  }, [remoteBanners, settings.banners]);
  const sourceItems = liveItems?.length ? liveItems : demoItems;

  useEffect(() => {
    if (!sourceItems.some((item) => item.id === selected))
      setSelected(sourceItems[0].id);
  }, [selected, sourceItems]);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(
      () => setActiveBanner((current) => (current + 1) % banners.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const items = useMemo(
    () =>
      sourceItems.filter(
        (item) => item.name.includes(query) || item.category.includes(query),
      ),
    [query, sourceItems],
  );
  const selectedItem =
    sourceItems.find((item) => item.id === selected) ?? sourceItems[0];
  const summary = getMarketSummary(selectedItem, settings);
  const anomalyTotal = sourceItems.reduce(
    (count, item) => count + getMarketSummary(item, settings).anomalyCount,
    0,
  );
  return (
    <MarketBoard
      banners={banners}
      activeBanner={activeBanner}
      setActiveBanner={setActiveBanner}
      sourceItems={sourceItems}
      anomalyTotal={anomalyTotal}
      query={query}
      setQuery={setQuery}
      items={items}
      selected={selected}
      setSelected={setSelected}
      selectedItem={selectedItem}
      summary={summary}
      settings={settings}
    />
  );
  /* Previous market layout retained temporarily for reference.
  return (
    <main className="market-page">
      <section className="market-hero">
        <div className="hero-carousel">
          {banners.map((banner, index) => (
            <a
              key={banner.id}
              href={banner.link || undefined}
              className={`hero-slide ${index === activeBanner ? "active" : ""} ${banner.image ? "has-image" : ""}`}
              style={{
                backgroundImage: banner.image
                  ? `url(${banner.image})`
                  : undefined,
              }}
            >
              <div className="hero-copy">
                <span className="eyebrow">
                  <Store size={15} /> PLANETGACHI MARKET
                </span>
                <h1>
                  {banner.title.split("\n").map((line, lineIndex) => (
                    <span key={line}>
                      {lineIndex === 1 ? <em>{line}</em> : line}
                      {lineIndex === 0 && <br />}
                    </span>
                  ))}
                </h1>
                <p>{banner.description}</p>
                <div className="hero-status">
                  <span /> {syncMessage}
                </div>
              </div>
              {!banner.image && (
                <div className="hero-blocks" aria-hidden="true">
                  <div className="cloud c1" />
                  <div className="cloud c2" />
                  <div className="sun" />
                  <div className="hill h1" />
                  <div className="hill h2" />
                  <div className="tree t1" />
                  <div className="tree t2" />
                </div>
              )}
            </a>
          ))}
        </div>
        <div className="banner-dots" aria-label="배너 선택">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              className={index === activeBanner ? "active" : ""}
              onClick={() => setActiveBanner(index)}
              aria-label={`${index + 1}번 배너`}
            />
          ))}
        </div>
      </section>

      <section className="market-stats">
        <div>
          <Coins />
          <p>
            추적 중인 아이템<strong>{sourceItems.length}종</strong>
          </p>
        </div>
        <div>
          <TrendingUp />
          <p>
            오늘의 거래 기록
            <strong>{liveItems?.length ? "실시간 집계" : "2,481건"}</strong>
          </p>
        </div>
        <div>
          <AlertTriangle />
          <p>
            검토 대기 이상 거래<strong>{anomalyTotal}건</strong>
          </p>
        </div>
        <div>
          <ShieldCheck />
          <p>
            평균 산정 기준<strong>최근 7일</strong>
          </p>
        </div>
      </section>

      <section className="market-shell">
        <aside className="market-list panel-block">
          <div className="panel-title">
            <div>
              <span>거래소 시세</span>
              <h2>아이템 목록</h2>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="아이템 검색"
              />
            </div>
          </div>
          <div className="item-grid">
            {items.map((item) => {
              const data = getMarketSummary(item, settings);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={`item-card ${selected === item.id ? "selected" : ""}`}
                >
                  <span className="item-name">
                    {item.name}
                    <small>{item.category}</small>
                  </span>
                  <strong>
                    {data.hasEnoughSamples
                      ? `${won.format(data.price)} G`
                      : "데이터 부족"}
                  </strong>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="price-detail panel-block">
          <div className="detail-header">
            <div>
              <span>{selectedItem.category}</span>
              <h2>{selectedItem.name}</h2>
              <p>최근 {summary.sampleSize}건의 정상 거래를 기준으로 계산</p>
            </div>
            <a href="/admin">
              관리 설정 <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="price-pair">
            <article className="official-price">
              <span>
                가격 <small>사이트 적용가</small>
              </span>
              <strong>
                {summary.hasEnoughSamples
                  ? `${won.format(summary.price)} G`
                  : "-"}
              </strong>
              {summary.cap && summary.average > summary.cap ? (
                <p>상한가 {won.format(summary.cap)} G 적용됨</p>
              ) : (
                <p>거래소 평균가 기준으로 적용</p>
              )}
            </article>
            <article className="auction-price">
              <span>
                거래소 평균가 <small>원본 평균</small>
              </span>
              <strong>
                {summary.hasEnoughSamples
                  ? `${won.format(summary.average)} G`
                  : "-"}
              </strong>
              <p>이상 거래 {summary.anomalyCount}건 기본 제외</p>
            </article>
          </div>
          <div className="transaction-title">
            <div>
              <span>최근 거래 기록</span>
              <h3>실제 거래소 체결가</h3>
            </div>
            <span className="sample-label">최근 7일</span>
          </div>
          <div className="transaction-list">
            {selectedItem.transactions.map((transaction, index) => {
              const isAnomaly =
                summary.average > 0 &&
                Math.abs(transaction.price - summary.average) /
                  summary.average >
                  settings.anomalyRate / 100;
              return (
                <div
                  key={`${transaction.at}-${index}`}
                  className={isAnomaly ? "anomaly" : ""}
                >
                  <span className="tx-dot" />
                  <span>{transaction.at}</span>
                  <b>{transaction.seller}</b>
                  <strong>{won.format(transaction.price)} G</strong>
                  {isAnomaly && <em>이상 거래</em>}
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  ); */
}

function MarketBoard({
  banners,
  activeBanner,
  setActiveBanner,
  sourceItems,
  anomalyTotal,
  query,
  setQuery,
  items,
  selected,
  setSelected,
  selectedItem,
  summary,
  settings,
}: {
  banners: MarketBanner[];
  activeBanner: number;
  setActiveBanner: (index: number) => void;
  sourceItems: MarketItem[];
  anomalyTotal: number;
  query: string;
  setQuery: (value: string) => void;
  items: MarketItem[];
  selected: string;
  setSelected: (id: string) => void;
  selectedItem: MarketItem;
  summary: ReturnType<typeof getMarketSummary>;
  settings: MarketSettings;
}) {
  const [calculatorQuantity, setCalculatorQuantity] = useState(1);
  const [calculatorSource, setCalculatorSource] = useState<"site" | "auction">(
    "site",
  );
  const activeBannerData = banners[activeBanner] ?? banners[0];
  const bannerImage = getUsableBannerImage(activeBannerData?.image);
  const serverJoinUrl = activeBannerData?.link || "minecraft://";
  const unitAmount = getUnitAmount(
    selectedItem.category === "64개 단위"
      ? "stack"
      : selectedItem.category === "16개 단위"
        ? "set"
        : "piece",
  );
  const calculatorPrice =
    calculatorSource === "site" && summary.hasSitePrice
      ? summary.price
      : summary.average;
  const calculatorTotal = Math.round(
    (calculatorPrice / unitAmount) * calculatorQuantity,
  );

  useEffect(() => {
    setCalculatorQuantity(unitAmount);
  }, [selectedItem.id, unitAmount]);

  return (
    <main className="market-board">
      <section
        className="market-board-hero"
        style={{
          backgroundImage: bannerImage
            ? `url(${bannerImage})`
            : undefined,
        }}
      >
        <div className="market-board-copy">
          <span className="board-kicker">
            <Store size={14} /> PLANET EARTH · ECONOMY
          </span>
          <h1>
            {activeBannerData?.title.split("\n").map((line, index) => (
              <span key={line}>
                {index === 1 ? <em>{line}</em> : line}
                {index === 0 && <br />}
              </span>
            ))}
          </h1>
          <p>{activeBannerData?.description}</p>
          <a
            className="board-join"
            href={serverJoinUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="마인크래프트 서버 참가"
          >
            <Store size={15} />
            서버 참가
            <ArrowUpRight size={14} />
          </a>
          <div className="board-dots">
            {banners.map((banner, index) => (
              <button
                key={`${banner.id}-${index}`}
                onClick={() => setActiveBanner(index)}
                className={index === activeBanner ? "active" : ""}
                aria-label={`${index + 1}번 배너`}
              />
            ))}
          </div>
        </div>
        <div className="hero-ledger">
          <span>오늘의 경제 현황</span>
          <strong>
            {sourceItems.length}
            <small>개 품목 추적 중</small>
          </strong>
          <div>
            <p>
              <TrendingUp size={15} />
              최근 거래 기록<b>2,481건</b>
            </p>
            <p>
              <AlertTriangle size={15} />
              검토 중 이상 거래<b>{anomalyTotal}건</b>
            </p>
          </div>
        </div>
      </section>
      <section className="market-board-summary">
        <article>
          <Coins />
          <div>
            <span>사이트 적용가</span>
            <b>운영 상한가 반영</b>
          </div>
        </article>
        <article>
          <TrendingUp />
          <div>
            <span>거래소 평균가</span>
            <b>실제 체결가 기반</b>
          </div>
        </article>
        <article>
          <ShieldCheck />
          <div>
            <span>이상 거래</span>
            <b>{settings.anomalyRate}% 초과 자동 분리</b>
          </div>
        </article>
      </section>
      <section className="market-board-content">
        <aside className="market-catalog">
          <header>
            <div>
              <span>MARKET CATALOG</span>
              <h2>시세 품목</h2>
            </div>
            <label>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="아이템 검색"
              />
            </label>
          </header>
          <div className="catalog-items">
            {items.map((item) => {
              const itemSummary = getMarketSummary(item, settings);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={selected === item.id ? "selected" : ""}
                >
                  <span>
                    <b>{item.name}</b>
                    <small>{item.category}</small>
                  </span>
                  <strong>
                    {itemSummary.hasSitePrice
                      ? `${won.format(itemSummary.price)} G`
                      : "가격 미정"}
                  </strong>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="market-price-card">
          <header>
            <div>
              <span>NOW VIEWING · {selectedItem.category}</span>
              <h2>{selectedItem.name}</h2>
              <p>
                최근 7일 수량 보정 거래 {summary.sampleSize}건을 바탕으로 산정한 안내 가격입니다.
              </p>
            </div>
            <a href="/admin">
              운영 설정 <ArrowUpRight size={16} />
            </a>
          </header>
          <div className="price-columns">
            <article>
              <span>
                가격 <small>사이트 적용가</small>
              </span>
              <strong>
                {summary.hasSitePrice ? `${won.format(summary.price)} G` : "-"}
              </strong>
              <small className="price-unit-label">{selectedItem.category} 기준</small>
              <p>
                {summary.hasSitePrice
                  ? "승인된 가격 제안 기준"
                  : "승인된 가격 제안이 없습니다"}
              </p>
            </article>
            <article>
              <span>
                거래소 평균가 <small>실제 체결 평균</small>
              </span>
              <strong>
                {summary.sampleSize > 0
                  ? `${won.format(summary.average)} G`
                  : "-"}
              </strong>
              <small className="price-unit-label">{selectedItem.category} 기준</small>
              <p>
                {summary.hasEnoughSamples
                  ? `이상 거래 ${summary.anomalyCount}건 제외`
                  : `정상 거래 ${summary.sampleSize}건 · 표본 부족`}
              </p>
            </article>
          </div>
          <div className="market-transactions">
            <span className="transaction-unit-label">
              {selectedItem.category} 기준 거래 가격
            </span>
            <div className="transactions-head">
              <div>
                <span>RECENT ACTIVITY</span>
                <h3>최근 거래 기록</h3>
              </div>
              <small>최근 7일</small>
            </div>
            {selectedItem.transactions.map((transaction, index) => {
              const anomaly =
                summary.average > 0 &&
                Math.abs(transaction.price - summary.average) /
                  summary.average >
                  settings.anomalyRate / 100;
              return (
                <div
                  key={`${transaction.at}-${index}`}
                  className={anomaly ? "anomaly" : ""}
                >
                  <i />
                  <span>{transaction.at}</span>
                  <span className="transaction-item">
                    <b>{transaction.itemName ?? transaction.seller}</b>
                    {transaction.itemCode && <small>{transaction.itemCode}</small>}
                  </span>
                  <strong>{won.format(transaction.price)} G</strong>
                  {anomaly && <em>이상</em>}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="market-calculator" aria-label="가격 계산기">
          <div className="calculator-heading">
            <span><Calculator size={14} /> PRICE CALCULATOR</span>
            <h2>가격 계산기</h2>
            <p>{selectedItem.name} · {selectedItem.category}</p>
          </div>
          <div className="calculator-source" role="group" aria-label="계산 가격 기준">
            <button
              className={calculatorSource === "site" ? "active" : ""}
              onClick={() => setCalculatorSource("site")}
              type="button"
            >
              사이트 적용가
            </button>
            <button
              className={calculatorSource === "auction" ? "active" : ""}
              onClick={() => setCalculatorSource("auction")}
              type="button"
            >
              거래소 평균가
            </button>
          </div>
          <div className="calculator-unit-price">
            <span>1개당 기준가</span>
            <strong>{won.format(Math.round(calculatorPrice / unitAmount))} G</strong>
          </div>
          <label className="calculator-quantity">
            <span>수량</span>
            <input
              min="1"
              onChange={(event) =>
                setCalculatorQuantity(
                  Math.max(1, Math.floor(Number(event.target.value) || 1)),
                )
              }
              type="number"
              value={calculatorQuantity}
            />
          </label>
          <div className="calculator-shortcuts">
            {[1, 16, 64].map((quantity) => (
              <button
                className={calculatorQuantity === quantity ? "active" : ""}
                key={quantity}
                onClick={() => setCalculatorQuantity(quantity)}
                type="button"
              >
                {quantity}개
              </button>
            ))}
          </div>
          <div className="calculator-total">
            <span>{won.format(calculatorQuantity)}개 예상 가격</span>
            <strong>{won.format(calculatorTotal)} G</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
