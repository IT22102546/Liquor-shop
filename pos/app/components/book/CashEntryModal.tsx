"use client";

import { useEffect, useState, type FormEvent } from "react";
import { API_URL } from "../../lib/constants";
import type { CashEntry } from "../../lib/bookPrint";

type Category = { value: string; label: string; automatic: boolean };
type Source = "DRAWER" | "BANK" | "OWNER";

type CashEntryModalProps = {
  token: string;
  direction: "IN" | "OUT";
  /** Cashiers may only record cash going in or out of their drawer. */
  drawerOnly: boolean;
  /** Whether a shift is open (drawer entries need one). */
  shiftOpen: boolean;
  onClose: () => void;
  onSaved: (entry: CashEntry) => void;
};

const SOURCE_TEXT: Record<Source, { OUT: string; IN: string }> = {
  DRAWER: { OUT: "Cash drawer (this shift)", IN: "Cash drawer (this shift)" },
  BANK: { OUT: "Bank", IN: "Bank" },
  OWNER: { OUT: "Owner paid personally", IN: "" },
};

/** Record an expense (voucher, money out) or money in (receipt). */
export function CashEntryModal({ token, direction, drawerOnly, shiftOpen, onClose, onSaved }: CashEntryModalProps) {
  const isOut = direction === "OUT";
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ category: "", amount: "", source: (shiftOpen ? "DRAWER" : "BANK") as Source, party: "", reference: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API_URL}/api/pos/cash-book?direction=${direction}&limit=1`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((res) => res.json())
      .then((json: { data?: { categories: Category[] } }) => setCategories((json.data?.categories ?? []).filter((category) => !category.automatic)))
      .catch(() => setCategories([]));
  }, [direction, token]);

  const sources: Source[] = drawerOnly ? ["DRAWER"] : isOut ? ["DRAWER", "BANK", "OWNER"] : ["DRAWER", "BANK"];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.category) { setError("Choose what it's for"); return; }
    const amount = Number(form.amount);
    if (!(amount > 0)) { setError("Enter an amount"); return; }
    if (form.source === "DRAWER" && !shiftOpen) { setError("No shift is open — start a shift in Day End to use the cash drawer"); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/cash-book`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ direction, category: form.category, amount, source: form.source, party: form.party, reference: form.reference, note: form.note }),
      });
      const payload = (await response.json()) as { data?: CashEntry; message?: string; errors?: Record<string, string[]> };
      if (!response.ok || !payload.data) {
        setError((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Could not save");
        return;
      }
      onSaved(payload.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <form className="bm-modal lx-member-modal lx-entry-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h3 className="bm-modal-title">{isOut ? "Record an expense" : "Record money in"}</h3>
        <p className="lx-card-sub">{isOut ? "Anything paid out — petrol, ice, wages, bills. It's numbered as a voucher and shows on the Z report." : "Money received other than sales — e.g. a supplier's refund for empties or the owner topping up the float."}</p>

        <div className="lx-entry-cats" role="radiogroup" aria-label={isOut ? "Expense type" : "Money in type"}>
          {categories.map((category) => (
            <button key={category.value} type="button" role="radio" aria-checked={form.category === category.value} className={form.category === category.value ? "active" : ""} onClick={() => setForm({ ...form, category: category.value })}>
              {category.label}
            </button>
          ))}
          {categories.length === 0 && <div className="lx-skel" style={{ height: 34, width: "100%" }} />}
        </div>

        <div className="lx-member-grid">
          <label>Amount (Rs.) *<input className="bm-input lx-entry-amount" type="number" min={0} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required autoFocus /></label>
          <label>{isOut ? "Paid from" : "Paid into"} *
            <select className="bm-input" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as Source })}>
              {sources.map((source) => <option key={source} value={source} disabled={source === "DRAWER" && !shiftOpen}>{SOURCE_TEXT[source][direction]}{source === "DRAWER" && !shiftOpen ? " — no shift open" : ""}</option>)}
            </select>
          </label>
          <label>{isOut ? "Paid to" : "Received from"}<input className="bm-input" value={form.party} onChange={(event) => setForm({ ...form, party: event.target.value })} placeholder={isOut ? "e.g. Lanka IOC Kurunegala" : "e.g. Lion Brewery rep"} /></label>
          <label>Bill / reference no<input className="bm-input" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="e.g. fuel bill no" /></label>
          <label className="wide">Note<input className="bm-input" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={isOut ? "e.g. van trip to the distributor" : "Details"} /></label>
        </div>

        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving…" : isOut ? "Save expense" : "Save money in"}</button>
        </div>
      </form>
    </div>
  );
}
