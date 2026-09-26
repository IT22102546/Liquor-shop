"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { ReceiptModal } from "../../components/receipt/ReceiptModal";
import { API_URL } from "../../lib/constants";
import { ROLE_LABELS } from "../../lib/roles";
import type { PosAdminRole } from "../../lib/types";
import type { SaleReceipt } from "../../lib/receipt";
import { IconBottle, IconCard, IconCash, IconInvoice, IconPrinter, IconRefresh, IconSearch } from "../../lib/icons";

type SaleItem = {
  productId: number | null;
  name: string;
  brand: string | null;
  size: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  emptiesReturned: number;
  emptyPrice: number;
  emptyDeduction: number;
  lineTotal: number;
};
type Sale = {
  id: number;
  billNo: string;
  soldAt: string;
  paymentMethod: SaleReceipt["paymentMethod"];
  paymentReference?: string | null;
  subtotal: number;
  emptyDeduction: number;
  emptiesReturned: number;
  total: number;
  amountReceived: number;
  changeGiven: number;
  cashier: { name: string; role: PosAdminRole };
  customer: { id: number; name: string | null; mobileNumber: string; pointsBalance: number } | null;
  pointsEarned: number;
  discount: { type: "PERCENT" | "AMOUNT"; value: number; amount: number } | null;
  pointsRedeemed: number;
  pointsValue: number;
  units: number;
  items: SaleItem[];
};

const PAGE_SIZE = 30;
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toInputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function saleToReceipt(sale: Sale): SaleReceipt {
  return {
    billNo: sale.billNo,
    soldAt: sale.soldAt,
    cashierName: sale.cashier.name,
    cashierRole: ROLE_LABELS[sale.cashier.role] ?? sale.cashier.role,
    member: sale.customer
      ? { name: sale.customer.name ?? "Member", mobileNumber: sale.customer.mobileNumber, pointsEarned: sale.pointsEarned, pointsRedeemed: sale.pointsRedeemed, pointsBalance: sale.customer.pointsBalance }
      : null,
    discount: sale.discount,
    pointsRedeemed: sale.pointsRedeemed,
    pointsValue: sale.pointsValue,
    paymentMethod: sale.paymentMethod,
    paymentReference: sale.paymentReference,
    lines: sale.items.map((item) => ({
      name: item.name,
      detail: [item.brand, item.size].filter(Boolean).join(" · ") || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      empties: item.emptiesReturned,
      emptyPrice: item.emptyPrice,
      emptyDeduction: item.emptyDeduction,
      total: item.lineTotal,
    })),
    subtotal: sale.subtotal,
    emptyDeduction: sale.emptyDeduction,
    emptiesReturned: sale.emptiesReturned,
    total: sale.total,
    amountReceived: sale.amountReceived,
    change: sale.changeGiven,
  };
}

const PRESETS: Array<{ key: string; label: string; range: () => [string, string] }> = [
  { key: "today", label: "Today", range: () => { const d = toInputDate(new Date()); return [d, d]; } },
  { key: "yesterday", label: "Yesterday", range: () => { const y = new Date(); y.setDate(y.getDate() - 1); const d = toInputDate(y); return [d, d]; } },
  { key: "7d", label: "7 days", range: () => { const s = new Date(); s.setDate(s.getDate() - 6); return [toInputDate(s), toInputDate(new Date())]; } },
  { key: "30d", label: "30 days", range: () => { const s = new Date(); s.setDate(s.getDate() - 29); return [toInputDate(s), toInputDate(new Date())]; } },
  { key: "all", label: "All", range: () => ["", ""] },
];

export default function SalesBillsPage() {
  const { token, logout } = useAdmin();
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState({ bills: 0, revenue: 0, emptiesReturned: 0, discounts: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState("today");
  const [[from, to], setRange] = useState<[string, string]>(PRESETS[0].range());
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [viewing, setViewing] = useState<Sale | null>(null);
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (appliedSearch) params.set("search", appliedSearch);
    try {
      const response = await fetch(`${API_URL}/api/pos/user-management/sales?${params}`, { headers: auth, cache: "no-store" });
      if (response.status === 401) { logout(); return; }
      const payload = (await response.json()) as { data?: { sales: Sale[]; summary: typeof summary; pagination: { total: number } }; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.message ?? "Failed to load sales");
      setSales(payload.data.sales);
      setSummary(payload.data.summary);
      setTotal(payload.data.pagination.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, auth, from, logout, page, to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [from, to, appliedSearch]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconInvoice /></div>
          <div>
            <h2 className="page-title">Sales Bills</h2>
            <p className="page-subtitle">Every sale from the counter — open any bill to see the receipt or print it again.</p>
          </div>
        </div>
        <button type="button" className="btn-outline" onClick={() => void load()} disabled={loading}><IconRefresh size={16} /> Refresh</button>
      </div>

      <div className="lx-card lx-log-filters">
        <div className="lx-log-controls">
          <div className="lx-seg-plain" role="tablist" aria-label="Date range">
            {PRESETS.map((item) => (
              <button key={item.key} type="button" className={preset === item.key ? "active" : ""} onClick={() => { setPreset(item.key); setRange(item.range()); }}>{item.label}</button>
            ))}
          </div>
          <input className="bm-input" type="date" value={from} max={to || undefined} onChange={(event) => { setPreset("custom"); setRange([event.target.value, to]); }} aria-label="From date" />
          <input className="bm-input" type="date" value={to} min={from || undefined} onChange={(event) => { setPreset("custom"); setRange([from, event.target.value]); }} aria-label="To date" />
          <form className="pos-search-field" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}>
            <IconSearch />
            <input className="bm-input" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => setAppliedSearch(search.trim())} placeholder="Bill number, cashier, member name or mobile" aria-label="Search bills" />
          </form>
        </div>
        <div className="lx-bill-summary">
          <div><span>Bills</span><strong>{summary.bills.toLocaleString()}</strong></div>
          <div><span>Sales total</span><strong>{money(summary.revenue)}</strong></div>
          <div><span>Average bill</span><strong>{summary.bills ? money(summary.revenue / summary.bills) : "—"}</strong></div>
          <div><span>Discounts &amp; points</span><strong>{money(summary.discounts ?? 0)}</strong></div>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="lx-card lx-log-card">
        {loading && sales.length === 0 && (
          <div className="lx-log-list">{Array.from({ length: 6 }, (_, index) => <div key={index} className="lx-skel" style={{ height: 64 }} />)}</div>
        )}
        {!loading && sales.length === 0 && <div className="lx-empty">No sales in this period.</div>}
        {sales.length > 0 && (
          <div className="lx-bill-list lx-stagger">
            {sales.map((sale, index) => (
              <button key={sale.id} type="button" className="lx-bill-row" style={{ ["--i" as string]: Math.min(index, 12) }} onClick={() => setViewing(sale)}>
                <span className="lx-bill-time">
                  <strong>{new Date(sale.soldAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</strong>
                  <em>{new Date(sale.soldAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</em>
                </span>
                <span className="lx-bill-main">
                  <strong>{sale.items.map((item) => `${item.quantity} × ${item.name}`).slice(0, 2).join(", ")}{sale.items.length > 2 ? ` +${sale.items.length - 2} more` : ""}</strong>
                  <em>
                    {sale.billNo} · {sale.cashier.name} · {sale.customer ? <b className="member">{sale.customer.name} · +{sale.pointsEarned} pts</b> : "Walk-in"}
                    {sale.emptiesReturned > 0 && <> · <IconBottle /> {sale.emptiesReturned} empt{sale.emptiesReturned === 1 ? "y" : "ies"}</>}
                    {sale.discount && sale.discount.amount > 0 && <> · <b className="discount">−{money(sale.discount.amount)} discount</b></>}
                    {sale.pointsRedeemed > 0 && <> · <b className="member">{sale.pointsRedeemed} pts used</b></>}
                  </em>
                </span>
                <span className={`lx-bill-pay ${sale.paymentMethod === "CASH" ? "cash" : "card"}`}>
                  {sale.paymentMethod === "CASH" ? <IconCash size={14} /> : <IconCard size={14} />}
                  {sale.paymentMethod === "CASH" ? "Cash" : sale.paymentMethod === "CARD" ? "Card" : "Transfer / QR"}
                </span>
                <span className="lx-bill-total">{money(sale.total)}</span>
                <span className="lx-bill-print" aria-hidden="true"><IconPrinter size={16} /></span>
              </button>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="lx-log-pager">
            <button type="button" className="btn-outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Newer</button>
            <span>Page {page} of {pages}</span>
            <button type="button" className="btn-outline" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)}>Older</button>
          </div>
        )}
      </div>

      {viewing && (
        <ReceiptModal
          receipt={saleToReceipt(viewing)}
          title={`Bill ${viewing.billNo}`}
          subtitle={`${money(viewing.total)} · served by ${viewing.cashier.name} (${ROLE_LABELS[viewing.cashier.role] ?? viewing.cashier.role})`}
          closeLabel="Close"
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
