import { useEffect, useMemo, useState } from "react";
import { coerceLanguage, strings } from "../i18n";
import SubscriptionModal from "../components/SubscriptionModal";
import Calendar from "../components/Calendar";
import Modal from "../components/Modal";
import { formatMoney } from "../utils/helpers";
import { useAuth, useAuthHeaders } from "../contexts/AuthContext";
import { apiFetch } from "../utils/api";
import type { ApiSubsListResponse, ApiSubscription } from "../../../shared/api";

function getProgressColor(days: number) {
  if (days <= 3) return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
  if (days <= 7) return "bg-amber-400";
  return "bg-emerald-500";
}

function getCycleLength(sub: ApiSubscription): number {
  if (sub.payment_cycle === "monthly") return 30;
  if (sub.payment_cycle === "yearly") return 365;
  if (sub.payment_cycle === "custom_days") return sub.custom_days ?? 30;
  return 30;
}

function Card({
  sub,
  exchangeEnabled,
  canEdit,
  onEdit
}: {
  sub: ApiSubscription;
  exchangeEnabled: boolean;
  canEdit: boolean;
  onEdit: (s: ApiSubscription) => void;
}) {
  const top = exchangeEnabled && sub.converted ? formatMoney(sub.converted.price, sub.converted.currency) : formatMoney(sub.price, sub.currency);
  const bottom = exchangeEnabled && sub.converted ? formatMoney(sub.price, sub.currency) : null;
  
  const cycleLength = getCycleLength(sub);
  const percentage = Math.min(100, Math.max(0, ((cycleLength - sub.days_left) / cycleLength) * 100));
  
  const progressColor = getProgressColor(sub.days_left);
  const isUrgent = sub.days_left <= 3;

  return (
    <div
      className={[
        "glass-panel relative overflow-hidden rounded-xl p-4 transition-all flex flex-col justify-between h-full",
        canEdit ? "cursor-pointer hover:bg-white/10" : "",
        isUrgent ? "ring-1 ring-red-500/50" : ""
      ].join(" ")}
      onDoubleClick={canEdit ? () => onEdit(sub) : undefined}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-[0_0_15px_rgba(255,255,255,0.1)] ring-1 ring-white/20">
            {sub.logo_url ? (
              <img src={sub.logo_url} alt={sub.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl bg-slate-100 rounded-lg">{sub.icon ?? "📦"}</div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white text-base leading-tight line-clamp-2" title={sub.name}>{sub.name}</div>
            <div className="text-xs text-white/60 capitalize mt-0.5 truncate">{sub.payment_cycle.replace('_', ' ')}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-white tabular-nums tracking-tight">{top}</div>
          {bottom ? <div className="text-xs text-white/50 tabular-nums font-light">{bottom}</div> : null}
        </div>
      </div>
      
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-medium text-white/60 mb-1.5">
          <span>{sub.next_due_date}</span>
          <span className={sub.days_left <= 3 ? "text-red-400 font-bold" : "font-bold"}>{sub.days_left} days left</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, valueColorClass, onClick, clickable }: { label: string; value: string; subValue?: React.ReactNode; valueColorClass?: string, onClick?: () => void, clickable?: boolean }) {
  return (
    <div 
      className={`glass-panel rounded-xl py-3 px-4 flex flex-col justify-between h-full transition-all ${clickable ? 'cursor-pointer hover:bg-white/10 hover:shadow-lg active:scale-95' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-1">
         <div className="text-[13px] text-white/60 uppercase tracking-widest font-bold truncate pr-2">{label}</div>
         {clickable && <div className="text-white/20 text-[10px] shrink-0">↗</div>}
      </div>
      <div className={`text-xl font-bold tabular-nums leading-tight ${valueColorClass || 'text-white'}`}>{value}</div>
      <div className="text-[11px] text-white/40 mt-1.5 h-4 flex items-center overflow-hidden">
        {subValue}
      </div>
    </div>
  );
}

function ExchangeRateModal({ open, onClose, rates, baseCurrency }: { open: boolean; onClose: () => void; rates: Record<string, number> | null; baseCurrency: string }) {
  if (!rates) return null;
  const list = Object.entries(rates);
  return (
    <Modal open={open} onClose={onClose} title={`参考汇率 (Base: ${baseCurrency})`}>
      <div className="mb-3 text-xs text-white/50 text-center bg-white/5 py-2 rounded-lg">
        1 单位外币 ≈ 多少 {baseCurrency}
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
         {list.map(([code, rate]) => (
            <div key={code} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
               <div className="flex items-center gap-3">
                  <span className="font-bold text-white w-8">{code}</span>
               </div>
               <div className="text-white tabular-nums font-mono font-medium">
                  {rate.toFixed(4)}
               </div>
            </div>
         ))}
      </div>
      <div className="mt-4 text-xs text-white/30 text-center">
         Rates provided by ExchangeRate-API. Updated recently.
      </div>
    </Modal>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<ApiSubsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [editSub, setEditSub] = useState<ApiSubscription | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated, authRequired } = useAuth();
  const canWrite = !authRequired || isAuthenticated;
  const authHeaders = useAuthHeaders();
  const lang = coerceLanguage(data?.settings.language);
  const t = strings[lang];
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  async function load() {
    return await apiFetch<ApiSubsListResponse>("/api/subs", { headers: authHeaders });
  }

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const metrics = useMemo(() => {
    if (!data) return { totalMonthly: 0, upcoming: 0, totalSubs: 0, currency: "USD", exchangeRateStr: "OFF", rates: null };
    let totalMonthly = 0;
    let upcoming = 0;
    
    for (const item of data.items) {
      const p = item.converted ? item.converted.price : item.price; 
      if (item.payment_cycle === 'monthly') totalMonthly += p;
      else if (item.payment_cycle === 'yearly') totalMonthly += p / 12;
      else if (item.payment_cycle === 'custom_days' && item.custom_days) totalMonthly += (p / item.custom_days) * 30;
      
      if (item.days_left <= 7) upcoming++;
    }
    
    let rateStr = "OFF";
    if (data.settings.exchangeEnabled && data.settings.exchangeRates) {
      const target = data.settings.baseCurrency === 'USD' ? 'EUR' : 'USD';
      const r = data.settings.exchangeRates[target];
      if (r) {
         rateStr = `1 ${target} ≈ ${r.toFixed(3)} ${data.settings.baseCurrency}`;
      } else {
         rateStr = "Active";
      }
    }
    
    return {
      totalMonthly,
      upcoming,
      totalSubs: data.items.length,
      currency: data.settings.baseCurrency,
      exchangeRateStr: rateStr,
      rates: data.settings.exchangeRates ?? null
    };
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-white tracking-tight">{t.dashboardTitle}</div>
          <div className="text-sm text-white/50 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-sky-500/50 outline-none w-64 transition-colors"
          />
          <button
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors shadow-lg",
              canWrite
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sky-500/20"
                : "bg-white/10 text-white/40 cursor-not-allowed shadow-transparent"
            ].join(" ")}
            onClick={() => setAddOpen(true)}
            disabled={!canWrite}
          >
            {t.addSubscription}
          </button>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
            onClick={() =>
              load()
                .then((d) => {
                  setData(d);
                  setError(null);
                })
                .catch((e) => setError(String(e?.message ?? e)))
            }
          >
            {t.refresh}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100 backdrop-blur-md">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-fr">
        <StatCard 
          label={lang === 'zh-CN' ? '月度预估' : 'Monthly Est.'} 
          value={formatMoney(metrics.totalMonthly, metrics.currency)} 
          subValue={lang === 'zh-CN' ? '基于订阅周期换算' : 'Based on cycles'}
        />
        <StatCard 
          label={lang === 'zh-CN' ? '订阅数量' : 'Total Subs'} 
          value={String(metrics.totalSubs)} 
          subValue={lang === 'zh-CN' ? '当前活跃订阅' : 'Active items'}
        />
        <StatCard 
          label={lang === 'zh-CN' ? '近期扣费' : 'Upcoming'} 
          value={String(metrics.upcoming)} 
          valueColorClass="text-white"
          subValue={
             metrics.upcoming === 0 
               ? <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{lang === 'zh-CN' ? '未来7天无计划' : 'Clean week'}</span>
               : <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{lang === 'zh-CN' ? '未来7天有扣费' : 'Charge expected'}</span>
          }
        />
         <StatCard 
          label={lang === 'zh-CN' ? '参考汇率' : 'Exchange'}
          value={metrics.exchangeRateStr} 
          clickable={Boolean(data?.settings.exchangeEnabled && metrics.rates)}
          onClick={() => {
             if (data?.settings.exchangeEnabled && metrics.rates) setRateOpen(true);
          }}
          subValue={data?.settings.exchangeEnabled ? `${data.settings.baseCurrency} (点击查看)` : "Disabled"} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{lang === 'zh-CN' ? '全部订阅' : 'Subscriptions'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((sub) => (
              <Card
                key={sub.id}
                sub={sub}
                exchangeEnabled={Boolean(data?.settings.exchangeEnabled)}
                canEdit={canWrite}
                onEdit={(s) => {
                  if (!canWrite) return;
                  setEditSub(s);
                }}
              />
            ))}
            {filteredItems.length === 0 && items.length > 0 && (
              <div className="col-span-full py-12 text-center text-white/30 border border-dashed border-white/10 rounded-xl">
                {t.noSearchResults}
              </div>
            )}
            {items.length === 0 && (
               <div className="col-span-full py-12 text-center text-white/30 border border-dashed border-white/10 rounded-xl">
                 {t.noSubscriptions}
               </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
           <Calendar
            lang={lang}
            year={calYear}
            month={calMonth}
            items={items.map((s) => ({
              id: s.id,
              name: s.name,
              next_due_date: s.next_due_date,
              logo_url: s.logo_url,
              url: s.url,
              price: s.price,
              currency: s.currency
            }))}
            selectedISO={selectedISO}
            onSelectISO={(iso) => setSelectedISO(iso)}
            onChangeMonth={(y, m) => {
              setCalYear(y);
              setCalMonth(m);
            }}
          />
        </div>
      </div>

      <SubscriptionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() =>
          load()
            .then((d) => {
              setData(d);
              setError(null);
            })
            .catch((e) => setError(String(e?.message ?? e)))
        }
      />

      <SubscriptionModal
        open={Boolean(editSub)}
        initial={editSub}
        onClose={() => setEditSub(null)}
        onSaved={() =>
          load()
            .then((d) => {
              setData(d);
              setError(null);
            })
            .catch((e) => setError(String(e?.message ?? e)))
        }
      />
      
      <ExchangeRateModal 
        open={rateOpen} 
        onClose={() => setRateOpen(false)} 
        rates={metrics.rates}
        baseCurrency={metrics.currency}
      />
    </div>
  );
}
