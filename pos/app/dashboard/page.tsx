"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../components/AdminContext";
import { MixDonut } from "../components/charts/MixDonut";
import { Sparkline } from "../components/charts/Sparkline";
import { TrendChart } from "../components/charts/TrendChart";
import { ProductArt } from "../components/products/ProductArt";
import { API_URL } from "../lib/constants";
import { readApiData } from "../lib/api";
import { ROLE_LABELS } from "../lib/roles";
import { SHOP } from "../lib/shop";
import { useCountUp } from "../lib/useCountUp";
import {
  IconActivity,
  IconBottle,
  IconBoxIn,
  IconCard,
  IconCash,
  IconInvoice,
  IconPrinter,
  IconReceipt,
  IconRevenue,
  IconTrend,
  IconUsers,
} from "../lib/icons";

type Figures = {
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
  bills: number;
  units: number;
  averageBill: number;
  emptiesReturned: number;
  emptyDeduction: number;
  memberBills: number;
  discounts: number;
  pointsRedeemed: number;
  pointsValue: number;
};
type Summary = {
  range: { from: string; to: string; bucketing: "HOUR" | "DAY" | "MONTH" };
  current: Figures;
  previous: Figures;
  trend: Array<{ key: string; revenue: number; bills: number; previousRevenue: number }>;
  topProducts: Array<{ id: number; name: string; size: string | null; category: string; imageUrl: string | null; units: number; revenue: number }>;
  categoryMix: Array<{ name: string; revenue: number }>;
  payments: { cash: number; card: number };
  staff: Array<{ name: string; bills: number; revenue: number }>;
  members: { total: number; newInPeriod: number };
  stock: {
    products: number;
    lowStock: number;
    outOfStock: number;
    emptiesOnHand: number;
    watch: Array<{ id: number; name: string; size: string | null; category: string; imageUrl: string | null; quantity: number; lowStockThreshold: number }>;
  };
  recentBills: Array<{ billNo: string; total: number; paymentMethod: string; emptiesReturned: number; soldAt: string; cashier: string; customer: string | null }>;
};

// ── Formatting ───────────────────────────────────────────────────────────────
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K` : `${Math.round(value)}`;
const toInputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const CHART_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function trendLabel(key: string, bucketing: Summary["range"]["bucketing"]) {
  if (bucketing === "HOUR") {
    const hour = Number(key.slice(0, 2));
    return `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;
  }
  if (bucketing === "DAY") return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ── Date ranges ──────────────────────────────────────────────────────────────
type RangeKey = "today" | "yesterday" | "7d" | "30d" | "month" | "12m" | "custom";
const RANGES: Array<{ key: Exclude<RangeKey, "custom">; label: string; compare: string; range: () => [string, string] }> = [
  { key: "today", label: "Today", compare: "vs yesterday", range: () => { const d = toInputDate(new Date()); return [d, d]; } },
  { key: "yesterday", label: "Yesterday", compare: "vs day before", range: () => { const y = new Date(); y.setDate(y.getDate() - 1); const d = toInputDate(y); return [d, d]; } },
  { key: "7d", label: "7 days", compare: "vs previous 7 days", range: () => { const s = new Date(); s.setDate(s.getDate() - 6); return [toInputDate(s), toInputDate(new Date())]; } },
  { key: "30d", label: "30 days", compare: "vs previous 30 days", range: () => { const s = new Date(); s.setDate(s.getDate() - 29); return [toInputDate(s), toInputDate(new Date())]; } },
  { key: "month", label: "This month", compare: "vs previous period", range: () => { const n = new Date(); return [toInputDate(new Date(n.getFullYear(), n.getMonth(), 1)), toInputDate(n)]; } },
  { key: "12m", label: "12 months", compare: "vs previous 12 months", range: () => { const s = new Date(); s.setMonth(s.getMonth() - 11, 1); return [toInputDate(s), toInputDate(new Date())]; } },
];

function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? { dir: "flat" as const, text: "No change" } : { dir: "up" as const, text: "New" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return { dir: "flat" as const, text: "No change" };
  return { dir: pct > 0 ? ("up" as const) : ("down" as const), text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(pct >= 100 ? 0 : 1)}%` };
}

// ── Pieces ───────────────────────────────────────────────────────────────────
function RangeControl({ value, onChange }: { value: RangeKey; onChange: (key: Exclude<RangeKey, "custom">) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const button = wrapRef.current?.querySelector<HTMLButtonElement>(`button[data-key="${value}"]`);
    setIndicator(button ? { left: button.offsetLeft, width: button.offsetWidth } : { left: 0, width: 0 });
  }, [value]);
  return (
    <div className="lx-seg" ref={wrapRef} role="tablist" aria-label="Date range">
      <span className="lx-seg-indicator" style={{ transform: `translateX(${indicator.left - 4}px)`, width: indicator.width, opacity: indicator.width ? 1 : 0 }} />
      {RANGES.map((range) => (
        <button key={range.key} data-key={range.key} type="button" role="tab" aria-selected={value === range.key} className={value === range.key ? "active" : ""} onClick={() => onChange(range.key)}>
          {range.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, format, previous, compare, icon, color, spark, foot, index }: {
  label: string; value: number; format: (value: number) => string; previous: number; compare: string;
  icon: React.ReactNode; color: string; spark: number[]; foot?: string; index: number;
}) {
  const animated = useCountUp(value);
  const delta = change(value, previous);
  return (
    <div className="lx-card lx-kpi" style={{ ["--kpi-color" as string]: color, ["--i" as string]: index }}>
      <div className="lx-kpi-top">
        <span className="lx-kpi-label">{label}</span>
        <span className="lx-kpi-icon">{icon}</span>
      </div>
      <div className="lx-kpi-value lx-num">{format(animated)}</div>
      <div className="lx-kpi-foot">
        <span className={`lx-chip ${delta.dir}`}>{delta.text}</span>
        <span>{foot ?? compare}</span>
      </div>
      <div className="lx-kpi-spark"><Sparkline values={spark.length > 1 ? spark : [0, 0]} color={color} /></div>
    </div>
  );
}

function exportReport(summary: Summary, rangeText: string, preparedBy: string) {
  const c = summary.current;
  const rows = (items: Array<[string, string]>) => items.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sales_Report_${summary.range.from}_to_${summary.range.to}</title><style>
    @page { size: A4 portrait; margin: 14mm; } * { box-sizing: border-box; } body { font: 12px/1.45 Arial, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 22px; letter-spacing: .06em; margin: 0; } .sub { color: #555; margin: 2px 0 14px; } h2 { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; margin: 18px 0 6px; border-bottom: 2px solid #111; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; } td, th { padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: left; } td:last-child, th:last-child { text-align: right; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; } .box { border: 1px solid #111; border-radius: 6px; padding: 8px; } .box span { display: block; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .08em; } .box strong { font-size: 16px; }
    .foot { margin-top: 18px; color: #666; font-size: 10px; }
  </style></head><body>
    <h1>${SHOP.name} — SALES REPORT</h1><div class="sub">${rangeText} · ${SHOP.address}</div>
    <div class="grid">
      <div class="box"><span>Sales</span><strong>${money(c.revenue)}</strong></div>
      <div class="box"><span>Bills</span><strong>${c.bills}</strong></div>
      <div class="box"><span>Average bill</span><strong>${money(c.averageBill)}</strong></div>
      <div class="box"><span>Gross profit</span><strong>${money(c.grossProfit)}</strong></div>
    </div>
    <h2>Profit</h2><table>${rows([["Sales (after empty-bottle deductions)", money(c.revenue)], ["Cost of stock sold", money(c.cost)], ["Gross profit", money(c.grossProfit)], ["Margin", `${c.margin.toFixed(1)}%`]])}</table>
    <h2>Counter</h2><table>${rows([["Bills served", String(c.bills)], ["Units sold", String(c.units)], ["Cash", money(summary.payments.cash)], ["Card / transfer", money(summary.payments.card)], ["Empty bottles returned", `${c.emptiesReturned} (−${money(c.emptyDeduction)})`], ["Bills with loyalty members", String(c.memberBills)]])}</table>
    <h2>Top sellers</h2><table><tr><th>Product</th><th>Units</th><th>Sales</th></tr>${summary.topProducts.map((p) => `<tr><td>${p.name}${p.size ? ` (${p.size})` : ""}</td><td>${p.units}</td><td>${money(p.revenue)}</td></tr>`).join("") || "<tr><td colspan=3>No sales</td></tr>"}</table>
    <h2>Sales by staff</h2><table><tr><th>Staff member</th><th>Bills</th><th>Sales</th></tr>${summary.staff.map((s) => `<tr><td>${s.name}</td><td>${s.bills}</td><td>${money(s.revenue)}</td></tr>`).join("") || "<tr><td colspan=3>No sales</td></tr>"}</table>
    <div class="foot">Prepared by ${preparedBy} on ${new Date().toLocaleString("en-GB")}. Cost of stock uses each product's current average cost.</div>
  </body></html>`;
  const frame = document.createElement("iframe");
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "10px", border: "0" });
  frame.srcdoc = html;
  frame.onload = () => {
    const title = document.title;
    document.title = `Sales_Report_${summary.range.from}_to_${summary.range.to}`;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => { document.title = title; frame.remove(); }, 1000);
  };
  document.body.appendChild(frame);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { admin, token } = useAdmin();
  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [[from, to], setRange] = useState<[string, string]>(RANGES[0].range());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const summaryQuery = useQuery({
    queryKey: ["pos", "dashboard-summary", from, to, token],
    enabled: Boolean(token && from && to && from <= to),
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/user-management/dashboard?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      return readApiData<Summary>(response, "Failed to load the dashboard");
    },
    placeholderData: (previous) => previous,
  });
  const summary = summaryQuery.data;
  const compare = RANGES.find((range) => range.key === rangeKey)?.compare ?? "vs previous period";
  const rangeText = from === to
    ? new Date(`${from}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${new Date(`${from}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(`${to}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const sparks = useMemo(() => {
    const trend = summary?.trend ?? [];
    return {
      revenue: trend.map((point) => point.revenue),
      bills: trend.map((point) => point.bills),
      average: trend.map((point) => (point.bills ? point.revenue / point.bills : 0)),
      profit: trend.map((point) => point.revenue * ((summary?.current.margin ?? 0) / 100)),
    };
  }, [summary]);

  const topMax = Math.max(1, ...(summary?.topProducts.map((product) => product.revenue) ?? [1]));
  const paymentTotal = (summary?.payments.cash ?? 0) + (summary?.payments.card ?? 0);
  const topStaff = summary?.staff[0];

  return (
    <div className="lx-dash">
      <header className="lx-hero">
        <div>
          <span className="lx-eyebrow"><i className="lx-live-dot" /> Live · {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 className="lx-hero-title">{greeting}, <em>{admin.name}</em></h1>
          <p className="lx-hero-sub">{ROLE_LABELS[admin.role]} · Here&apos;s how {SHOP.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} is doing {rangeKey === "today" ? "today" : `for ${rangeText}`}.</p>
        </div>
        <div className="lx-hero-actions">
          <RangeControl value={rangeKey} onChange={(key) => { setRangeKey(key); setRange(RANGES.find((range) => range.key === key)!.range()); }} />
          <button type="button" className="btn-outline" disabled={!summary} onClick={() => summary && exportReport(summary, rangeText, admin.name)}>
            <IconPrinter size={16} /> Report
          </button>
          <Link href="/dashboard/inventory" className="btn-accent"><IconReceipt /> Open counter</Link>
        </div>
      </header>

      {summaryQuery.error && <div className="bm-alert bm-alert-error">{summaryQuery.error instanceof Error ? summaryQuery.error.message : "Failed to load the dashboard"}</div>}

      <section className="lx-kpis lx-stagger">
        {summary ? (
          <>
            <Kpi index={0} label="Sales" value={summary.current.revenue} previous={summary.previous.revenue} format={money} compare={compare} icon={<IconRevenue />} color="var(--c1)" spark={sparks.revenue} />
            <Kpi index={1} label="Bills served" value={summary.current.bills} previous={summary.previous.bills} format={(v) => Math.round(v).toLocaleString()} compare={compare} icon={<IconInvoice />} color="var(--c2)" spark={sparks.bills} foot={`${summary.current.units} units sold`} />
            <Kpi index={2} label="Average bill" value={summary.current.averageBill} previous={summary.previous.averageBill} format={money} compare={compare} icon={<IconTrend />} color="var(--c5)" spark={sparks.average} />
            <Kpi index={3} label="Gross profit" value={summary.current.grossProfit} previous={summary.previous.grossProfit} format={money} compare={compare} icon={<IconActivity />} color="var(--c4)" spark={sparks.profit} foot={`${summary.current.margin.toFixed(1)}% margin · stock cost ${money(summary.current.cost)}`} />
          </>
        ) : Array.from({ length: 4 }, (_, index) => <div key={index} className="lx-card lx-skel" style={{ height: 176 }} />)}
      </section>

      <section className="lx-row-main">
        <div className="lx-card">
          <div className="lx-card-head">
            <div>
              <div className="lx-card-title">Sales trend</div>
              <div className="lx-card-sub">{summary?.range.bucketing === "HOUR" ? "By hour of the day" : summary?.range.bucketing === "DAY" ? "By day" : "By month"} · {rangeText}</div>
            </div>
            <div className="lx-legend">
              <span><i style={{ background: "var(--c1)" }} /> This period</span>
              <span><i className="dashed" /> Previous</span>
            </div>
          </div>
          {summary ? (
            <TrendChart
              labels={summary.trend.map((point) => trendLabel(point.key, summary.range.bucketing))}
              values={summary.trend.map((point) => point.revenue)}
              compare={summary.trend.map((point) => point.previousRevenue)}
              formatValue={money}
              formatAxis={moneyShort}
              compareLabel="Previous period"
            />
          ) : <div className="lx-skel" style={{ height: 270 }} />}
        </div>

        <div className="lx-card">
          <div className="lx-card-head">
            <div>
              <div className="lx-card-title">Sales by category</div>
              <div className="lx-card-sub">Where the money came from</div>
            </div>
          </div>
          {summary && summary.categoryMix.length > 0 ? (
            <MixDonut
              key={`${from}-${to}`}
              segments={summary.categoryMix.slice(0, 6).map((category, index) => ({ label: category.name, value: category.revenue, color: CHART_COLORS[index % CHART_COLORS.length] }))}
              centerLabel="total sales"
              formatValue={(value) => `Rs. ${moneyShort(value)}`}
            />
          ) : <div className="lx-empty">{summary ? "No sales in this period yet." : ""}</div>}
        </div>
      </section>

      <section className="lx-row-3">
        <div className="lx-card">
          <div className="lx-card-head">
            <div><div className="lx-card-title">Top sellers</div><div className="lx-card-sub">By sales value</div></div>
          </div>
          <div className="lx-list lx-stagger">
            {summary?.topProducts.map((product, index) => (
              <div key={product.id} className="lx-list-row" style={{ ["--i" as string]: index }}>
                <ProductArt className="lx-mini-art" categoryName={product.category} imageUrl={product.imageUrl} alt={product.name} iconSize={18} />
                <div className="lx-list-main">
                  <div className="lx-list-name">{product.name}</div>
                  <div className="lx-list-meta">{product.units} sold{product.size ? ` · ${product.size}` : ""}</div>
                  <div className="lx-bar"><i style={{ width: `${(product.revenue / topMax) * 100}%`, ["--i" as string]: index }} /></div>
                </div>
                <div className="lx-list-value">{money(product.revenue)}</div>
              </div>
            ))}
            {summary && summary.topProducts.length === 0 && <div className="lx-empty">No sales in this period yet.</div>}
          </div>
        </div>

        <div className="lx-card">
          <div className="lx-card-head">
            <div><div className="lx-card-title">Stock watch</div><div className="lx-card-sub">{summary ? `${summary.stock.outOfStock} out · ${summary.stock.lowStock} running low · ${summary.stock.products} products` : " "}</div></div>
            <Link href="/dashboard/inventory/manage" className="lx-chip"><IconBoxIn size={14} /> Add stock</Link>
          </div>
          <div className="lx-list lx-stagger">
            {summary?.stock.watch.map((product, index) => (
              <div key={product.id} className="lx-list-row" style={{ ["--i" as string]: index }}>
                <ProductArt className="lx-mini-art" categoryName={product.category} imageUrl={product.imageUrl} alt={product.name} iconSize={18} />
                <div className="lx-list-main">
                  <div className="lx-list-name">{product.name}</div>
                  <div className="lx-list-meta">{product.lowStockThreshold > 0 ? `Alert at ${product.lowStockThreshold}` : "No alert level set"}</div>
                </div>
                <span className={`lx-stock-badge ${product.quantity <= 0 ? "out" : "low"}`}>{product.quantity <= 0 ? "Out of stock" : `${product.quantity} left`}</span>
              </div>
            ))}
            {summary && summary.stock.watch.length === 0 && <div className="lx-empty">All products are well stocked.</div>}
          </div>
        </div>

        <div className="lx-card">
          <div className="lx-card-head">
            <div><div className="lx-card-title">Latest bills</div><div className="lx-card-sub">Updates every minute</div></div>
            <Link href="/dashboard/sales" className="lx-chip">All bills</Link>
          </div>
          <div className="lx-feed lx-stagger">
            {summary?.recentBills.map((bill, index) => (
              <div key={bill.billNo} className="lx-feed-row" style={{ ["--i" as string]: index }}>
                <span className="lx-feed-icon">{bill.paymentMethod === "CASH" ? <IconCash size={16} /> : <IconCard size={16} />}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="lx-feed-title">{bill.customer ?? "Walk-in"}{bill.emptiesReturned > 0 ? ` · ${bill.emptiesReturned} empties` : ""}</div>
                  <div className="lx-feed-meta">{bill.cashier} · {relativeTime(bill.soldAt)}</div>
                </div>
                <div className="lx-feed-amount">{money(bill.total)}<span>{bill.billNo.slice(-9)}</span></div>
              </div>
            ))}
            {summary && summary.recentBills.length === 0 && <div className="lx-empty">No sales yet.</div>}
          </div>
        </div>
      </section>

      <section className="lx-card lx-ledger">
        <div className="lx-ledger-item">
          <span>Cash vs card</span>
          <strong>{summary ? money(summary.payments.cash) : "—"}</strong>
          <em>{summary && paymentTotal > 0 ? `${Math.round((summary.payments.cash / paymentTotal) * 100)}% cash · ${money(summary.payments.card)} card` : "No payments yet"}</em>
        </div>
        <div className="lx-ledger-item">
          <span><IconBottle /> Empties returned</span>
          <strong>{summary ? summary.current.emptiesReturned.toLocaleString() : "—"}</strong>
          <em>{summary ? `−${money(summary.current.emptyDeduction)} off bills · ${summary.stock.emptiesOnHand} in the shop` : ""}</em>
        </div>
        <div className="lx-ledger-item">
          <span><IconUsers /> Loyalty members</span>
          <strong>{summary ? summary.current.memberBills.toLocaleString() : "—"}</strong>
          <em>{summary ? `bills to members · ${summary.members.newInPeriod} new · ${summary.members.total} total` : ""}</em>
        </div>
        <div className="lx-ledger-item">
          <span>Discounts &amp; points</span>
          <strong>{summary ? money(summary.current.discounts + summary.current.pointsValue) : "—"}</strong>
          <em>{summary ? `${money(summary.current.discounts)} discounts · ${summary.current.pointsRedeemed} points used` : ""}</em>
        </div>
        <div className="lx-ledger-item highlight">
          <span>Top staff</span>
          <strong>{topStaff ? topStaff.name : "—"}</strong>
          <em>{topStaff ? `${topStaff.bills} bills · ${money(topStaff.revenue)}` : "No sales in this period"}</em>
        </div>
      </section>
    </div>
  );
}
