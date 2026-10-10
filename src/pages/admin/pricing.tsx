import { useEffect, useState } from "react";
import { loadSettings, saveSettings, type MarketSettings } from "../../lib/marketData";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";
const won = new Intl.NumberFormat("ko-KR");
import { catalogAverage } from '../../lib/catalogAverage';
import { loadCatalogTransactions } from '../../lib/loadCatalogTransactions';
import { getUnitAmount, getUnitLabel } from '../../lib/marketUnits';
import type { Item } from '../../lib/supabase';
type ApprovedProposal = { id: number; item_name: string; proposed_value: number; submitted_at: string; unit_type?: string };
type PriceControl = { item: { id: string; ruleKey: string; code: string; name: string; unitType: Item['unit_type'] }; average: number; samples: number; sitePrice?: number; proposalId?: number };
const proposalKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
export default function PricingPanel({ sessionToken, active, mode }: { sessionToken: string; active: boolean; mode: 'caps' | 'average' }) {
  const [settings, setSettings] = useState<MarketSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [priceControls, setPriceControls] = useState<PriceControl[]>([]);
  const [applyingItem, setApplyingItem] = useState<string | null>(null);
  useEffect(() => {
    if (!hasSupabaseConfig || !active) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [rows, catalog, proposals] = await Promise.all([
          loadCatalogTransactions(),
          supabase.from('items').select('*').eq('status', 'approved').order('name'),
          supabase.from('proposals').select('id,item_name,proposed_value,submitted_at,unit_type').eq('status', 'approved').order('submitted_at', { ascending: false }),
        ]);
        if (catalog.error) throw catalog.error;
        if (proposals.error) throw proposals.error;
        const controls = (catalog.data as Item[]).map(item => {
          const summary = catalogAverage(item, rows, getUnitAmount(item.unit_type));
          const proposal = (proposals.data as ApprovedProposal[]).find(row => proposalKey(row.item_name) === proposalKey(item.name) && row.unit_type === item.unit_type);
          return { item: { id: String(item.id), ruleKey: item.code.toLowerCase().replace('minecraft:', ''), code: item.code, name: item.name, unitType: item.unit_type }, average: summary.average ?? 0, samples: summary.samples, sitePrice: proposal?.proposed_value, proposalId: proposal?.id };
        });
        if (!cancelled) setPriceControls(controls);
      } catch (error) {
        if (!cancelled) setSaveNotice(`가격 조회 실패: ${(error as { message?: string }).message ?? '연결 오류'}`);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [active]);
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    supabase
      .from("market_settings")
      .select("setting_value")
      .eq("setting_key", "market_ui")
      .maybeSingle()
      .then(({ data }) => {
        const remote = data?.setting_value as
          Partial<MarketSettings> | undefined;
        if (!remote) return;
        setSettings((current) => ({
          ...current,
          ...remote,
          rules: { ...current.rules, ...(remote.rules ?? {}) },
          banners: remote.banners ?? current.banners,
        }));
      });
  }, []);
  const updateRule = (itemId: string, capValue: string) => {
    const cap = Number(capValue.replace(/,/g, ""));
    setSettings((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [itemId]: {
          ...(current.rules[itemId] ?? { includeAnomalies: false }),
          cap: Number.isFinite(cap) && cap > 0 ? cap : undefined,
        },
      },
    }));
  };
  const applyAuctionAverage = async (control: PriceControl) => {
    if (!hasSupabaseConfig || !Number.isFinite(control.average) || control.average <= 0) {
      setSaveNotice('거래소 평균가가 없어 적용할 수 없습니다.');
      return;
    }
    setApplyingItem(control.item.id);
    const payload = {
      item_code: control.item.code,
      item_name: control.item.name,
      item_image: '',
      proposed_value: Math.round(control.average),
      current_votes: 5,
      negative_votes: 0,
      required_votes: 5,
      status: 'approved',
      submitted_by: 'market-admin',
      type: 'update',
      unit_type: control.item.unitType,
      submitted_at: new Date().toISOString(),
    };
    const result = control.proposalId
      ? await supabase.from('proposals').update({ proposed_value: payload.proposed_value, submitted_at: payload.submitted_at }).eq('id', control.proposalId)
      : await supabase.from('proposals').insert(payload).select('id').single();
    setApplyingItem(null);
    if (result.error) {
      setSaveNotice(`사이트 적용가 저장에 실패했습니다: ${result.error.message}`);
      return;
    }
    setPriceControls((current) => current.map((row) => row.item.id === control.item.id ? { ...row, sitePrice: payload.proposed_value, proposalId: control.proposalId ?? result.data?.id } : row));
    window.dispatchEvent(new Event('market-site-price-updated'));
    setSaveNotice(`${control.item.name} 거래소 평균가를 사이트 적용가로 반영했습니다.`);
  };
  const persist = async () => {
    setSaved(false);
    setSaveNotice(
      hasSupabaseConfig
        ? "서버에도 저장하는 중입니다…"
        : "현재는 이 브라우저의 미리보기 설정으로 저장했습니다.",
    );
    if (hasSupabaseConfig) {
      if (!sessionToken) {
        setSaved(false);
        setSaveNotice("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      const ruleRows = Object.entries(settings.rules).map(
        ([item_type, rule]) => ({
          item_type,
          price_cap: rule.cap ?? null,
          include_anomalies: rule.includeAnomalies,
        }),
      );
      const { error } = await supabase.rpc("market_admin_save_settings", {
        input_token: sessionToken,
        market_ui: settings,
        pricing: {
          anomalyRate: settings.anomalyRate,
          minimumSamples: settings.minimumSamples,
        },
        rules: ruleRows,
      });
      if (error) {
        setSaveNotice(`상한가 저장 실패: ${error.message}`);
        return;
      }
      saveSettings(settings);
      setSaved(true);
      const failed = false;
      setSaveNotice(
        failed
          ? "브라우저 미리보기에는 저장됐습니다. 서버 저장은 관리자 로그인·권한을 확인해 주세요."
          : "서버 설정까지 저장했습니다. 다음 거래소 동기화부터 새 규칙이 적용됩니다.",
      );
    }
    window.setTimeout(() => {
      setSaved(false);
      setSaveNotice("");
    }, 3500);
  };
  return (
    <section className="bg-stone-900 border-4 border-stone-950 p-4 md:p-6 text-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-bold text-white">{mode === 'caps' ? '아이템별 상한가' : '거래소 평균가 적용'}</h3>
          <p className="text-sm text-stone-400 mt-2">{mode === 'caps' ? '상한가는 개당 기준입니다. 비워두면 제한하지 않습니다. 평균가는 아이템에 표시된 등록 단위 기준입니다.' : '홈과 동일한 최근 7일 거래를 등록 단위로 환산합니다. 중앙값에서 20% 넘게 벗어난 거래는 제외합니다.'}</p>
        </div>
        {mode === 'caps' && <button type="button" onClick={persist} className="px-4 py-2 bg-lime-700 hover:bg-lime-600 text-white font-bold">{saved ? '저장 완료' : '상한가 저장'}</button>}
      </div>
      {saveNotice && <p role="status" className="mb-4 p-3 border border-stone-600 bg-stone-800 text-amber-300">{saveNotice}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] text-sm">
          <thead className="bg-stone-950 text-stone-300"><tr><th className="p-3 text-left">아이템</th><th className="p-3 text-right">최근 7일 평균가</th><th className="p-3 text-right">표본</th><th className="p-3 text-right">{mode === 'caps' ? '상한가' : '사이트 적용가'}</th>{mode === 'average' && <th className="p-3">적용</th>}</tr></thead>
          <tbody>{priceControls.map(control => <tr key={control.item.id} className="border-t border-stone-700 hover:bg-stone-800">
            <td className="p-3 text-white font-bold">{control.item.name}<small className="block text-stone-400 font-normal mt-1">{getUnitLabel(control.item.unitType)}</small></td>
            <td className="p-3 text-right text-amber-300">{control.samples > 0 ? `${won.format(control.average)} G` : '거래 없음'}</td>
            <td className="p-3 text-right">{won.format(control.samples)}건</td>
            <td className="p-3 text-right">{mode === 'caps' ? <input aria-label={`${control.item.name} 상한가`} type="number" min="0" value={settings.rules[control.item.ruleKey]?.cap ?? ''} onChange={event => updateRule(control.item.ruleKey, event.target.value)} placeholder="제한 없음" className="w-32 px-3 py-2 bg-stone-800 border-2 border-stone-600 text-white focus:border-lime-500 outline-none" /> : control.sitePrice === undefined ? '미정' : `${won.format(control.sitePrice)} G`}</td>
            {mode === 'average' && <td className="p-3 text-center"><button type="button" onClick={() => applyAuctionAverage(control)} disabled={applyingItem !== null || control.average <= 0 || control.samples === 0} className="px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white font-bold disabled:opacity-40">{applyingItem === control.item.id ? '적용 중…' : '평균가 적용'}</button></td>}
          </tr>)}</tbody>
        </table>
        {!priceControls.length && <p className="p-5 text-stone-400">가격 데이터를 불러오는 중입니다.</p>}
      </div>
    </section>
  );
}
