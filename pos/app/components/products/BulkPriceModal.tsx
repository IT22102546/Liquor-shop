"use client";

import { useMemo, useState } from "react";
import { API_URL } from "../../lib/constants";
import { IconClose } from "../../lib/icons";
import type { Product } from "./ProductFormModal";

type Group = "beer" | "hard" | "custom";
type Direction = "up" | "down";
type Mode = "amount" | "percent";

/** Group by the product's own "Hard liquor" tick (beer, wine, champagne… are not hard liquor). */
const inGroup = (product: Product, group: "beer" | "hard") => (group === "hard" ? product.isHardLiquor === true : product.isHardLiquor !== true);
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Government price changes: pick beer or hard liquor (all their products are ticked), untick any that
 * don't change, set the increase or decrease, adjust single rows if sizes change by different amounts,
 * and apply everything together.
 */
export function BulkPriceModal({ token, products, onClose, onDone }: {
  token: string;
  products: Product[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const priced = useMemo(() => products.filter((product) => (product.sellingPrice ?? 0) > 0), [products]);
  const categories = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    priced.forEach((product) => {
      const row = map.get(product.category.id) ?? { id: product.category.id, name: product.category.name, count: 0 };
      row.count += 1;
      map.set(product.category.id, row);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [priced]);
  const groupCategories = (group: Group) => new Set(priced.filter((product) => group !== "custom" && inGroup(product, group)).map((product) => product.category.id));

  const [group, setGroup] = useState<Group>("beer");
  const [chosenCategories, setChosenCategories] = useState<Set<number>>(() => groupCategories("beer"));
  const [unticked, setUnticked] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState<Direction>("up");
  const [mode, setMode] = useState<Mode>("amount");
  const [value, setValue] = useState("");
  const [rounding, setRounding] = useState(0);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseGroup = (next: Group) => {
    setGroup(next);
    if (next !== "custom") setChosenCategories(groupCategories(next));
    setUnticked(new Set());
  };
  const toggleCategory = (id: number) => {
    setGroup("custom");
    setChosenCategories((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const rows = priced
    .filter((product) => (group === "custom" ? chosenCategories.has(product.category.id) : inGroup(product, group)))
    .sort((a, b) => a.category.name.localeCompare(b.category.name) || a.name.localeCompare(b.name));
  const amount = Number(value) || 0;
  const computed = (price: number) => {
    let next = mode === "amount" ? price + (direction === "up" ? amount : -amount) : price * (1 + ((direction === "up" ? 1 : -1) * amount) / 100);
    if (rounding > 0) next = Math.round(next / rounding) * rounding;
    return Math.max(0, Math.round(next * 100) / 100);
  };
  const newPriceOf = (product: Product) => {
    const typed = overrides[product.id];
    return typed !== undefined && typed.trim() !== "" ? Number(typed) : computed(product.sellingPrice ?? 0);
  };
  const selected = rows.filter((product) => !unticked.has(product.id));
  const changing = selected.filter((product) => newPriceOf(product) !== product.sellingPrice);
  const invalid = selected.some((product) => !(newPriceOf(product) > 0));

  const apply = async () => {
    if (changing.length === 0) { setError("None of the selected prices change. Enter an amount or type new prices."); return; }
    if (invalid) { setError("Every new price must be more than Rs. 0."); return; }
    if (reason.trim().length < 3) { setError("Say why the prices are changing, e.g. Excise increase from 1 November."); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/inventory-management/products/bulk-price`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), changes: changing.map((product) => ({ productId: product.id, sellingPrice: newPriceOf(product) })) }),
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: { count: number }; message?: string; errors?: Record<string, string[]> };
      if (!response.ok || !payload.data) throw new Error((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Could not update the prices");
      onDone(`${payload.data.count} price${payload.data.count === 1 ? "" : "s"} updated`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not update the prices");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-modal-backdrop">
      <div className="bm-modal bulk-modal" role="dialog" aria-label="Bulk price update">
        <div className="po-modal-head">
          <div>
            <h3 className="bm-modal-title">Bulk price update</h3>
            <p className="lx-card-sub">For government price changes. Pick the group, untick anything that stays the same, then set the change.</p>
          </div>
          <button type="button" className="po-close" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>

        <div className="bulk-step">
          <span className="bulk-label">Products</span>
          <div className="lx-seg-plain" role="radiogroup" aria-label="Product group">
            <button type="button" role="radio" aria-checked={group === "beer"} className={group === "beer" ? "active" : ""} onClick={() => chooseGroup("beer")}>Beer, wine &amp; others</button>
            <button type="button" role="radio" aria-checked={group === "hard"} className={group === "hard" ? "active" : ""} onClick={() => chooseGroup("hard")}>Hard liquor</button>
            <button type="button" role="radio" aria-checked={group === "custom"} className={group === "custom" ? "active" : ""} onClick={() => chooseGroup("custom")}>Choose categories</button>
          </div>
          <div className="bulk-cats">
            {categories.map((category) => (
              <button key={category.id} type="button" aria-pressed={chosenCategories.has(category.id)} className={chosenCategories.has(category.id) ? "on" : ""} onClick={() => toggleCategory(category.id)}>
                {category.name} <em>{category.count}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="bulk-step bulk-change">
          <span className="bulk-label">Change</span>
          <div className="lx-seg-plain" role="radiogroup" aria-label="Increase or decrease">
            <button type="button" role="radio" aria-checked={direction === "up"} className={direction === "up" ? "active" : ""} onClick={() => setDirection("up")}>Increase</button>
            <button type="button" role="radio" aria-checked={direction === "down"} className={direction === "down" ? "active" : ""} onClick={() => setDirection("down")}>Decrease</button>
          </div>
          <div className="lx-seg-plain" role="radiogroup" aria-label="By amount or percent">
            <button type="button" role="radio" aria-checked={mode === "amount"} className={mode === "amount" ? "active" : ""} onClick={() => setMode("amount")}>Rs.</button>
            <button type="button" role="radio" aria-checked={mode === "percent"} className={mode === "percent" ? "active" : ""} onClick={() => setMode("percent")}>%</button>
          </div>
          <input id="bulk-value" className="bm-input bulk-value" type="number" min={0} step={mode === "percent" ? "0.5" : "1"} value={value} onChange={(event) => setValue(event.target.value)} placeholder={mode === "percent" ? "e.g. 5" : "e.g. 30"} aria-label={mode === "percent" ? "Percent" : "Rupees per bottle"} autoFocus />
          <label className="bulk-round">Round to
            <select id="bulk-round" className="bm-input" value={rounding} onChange={(event) => setRounding(Number(event.target.value))}>
              <option value={0}>No rounding</option>
              <option value={1}>Nearest Rs. 1</option>
              <option value={5}>Nearest Rs. 5</option>
              <option value={10}>Nearest Rs. 10</option>
            </select>
          </label>
        </div>

        <div className="bulk-table-wrap">
          <table className="data-table bulk-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" className="lx-row-check" aria-label="Select all" checked={rows.length > 0 && unticked.size === 0} onChange={(event) => setUnticked(event.target.checked ? new Set() : new Set(rows.map((row) => row.id)))} />
                </th>
                <th>Product</th><th style={{ textAlign: "right" }}>Now</th><th style={{ textAlign: "right" }}>New price</th><th style={{ textAlign: "right" }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="bm-table-empty">No priced products in the chosen categories.</td></tr>}
              {rows.map((product) => {
                const on = !unticked.has(product.id);
                const next = newPriceOf(product);
                const diff = next - (product.sellingPrice ?? 0);
                const typed = overrides[product.id] !== undefined && overrides[product.id].trim() !== "";
                return (
                  <tr key={product.id} className={on ? "" : "bulk-off"}>
                    <td><input type="checkbox" className="lx-row-check" checked={on} aria-label={`Include ${product.name}`} onChange={() => setUnticked((current) => { const nextSet = new Set(current); if (nextSet.has(product.id)) nextSet.delete(product.id); else nextSet.add(product.id); return nextSet; })} /></td>
                    <td><strong>{product.name}</strong><div className="td-muted">{[product.brand.name, product.compatibleWith, product.category.name].filter(Boolean).join(" · ")}</div></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(product.sellingPrice ?? 0)}</td>
                    <td style={{ textAlign: "right" }}>
                      <input
                        className={`bm-input bulk-price${typed ? " typed" : ""}`}
                        type="number" min={0} step="0.01" disabled={!on}
                        value={!on ? String(product.sellingPrice ?? 0) : typed ? overrides[product.id] : String(next)}
                        onChange={(event) => setOverrides({ ...overrides, [product.id]: event.target.value })}
                        aria-label={`New price for ${product.name}`}
                      />
                      {typed && on && <button type="button" className="lx-link-btn muted bulk-reset" onClick={() => { const rest = { ...overrides }; delete rest[product.id]; setOverrides(rest); }}>Use the rule</button>}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className={!on || diff === 0 ? "td-muted" : diff > 0 ? "lx-amount-in" : "lx-amount-out"}>
                      {!on ? "Not changed" : diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className="po-notes">Reason *
          <input id="bulk-reason" className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Excise duty increase from 1 November 2026" />
        </label>
        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <div className="bm-modal-actions bulk-actions">
          <span className="lx-card-sub">{selected.length} selected · <b>{changing.length}</b> price{changing.length === 1 ? "" : "s"} will change</span>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-accent" onClick={() => void apply()} disabled={saving || changing.length === 0}>{saving ? "Updating…" : `Update ${changing.length} price${changing.length === 1 ? "" : "s"}`}</button>
        </div>
      </div>
    </div>
  );
}
