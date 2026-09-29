"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { switchBranch, useBranch } from "../../lib/useBranch";
import { IconBranch, IconCheck, IconClose, IconPlus } from "../../lib/icons";

type BranchRow = {
  id: number; code: string; name: string; address: string | null; phone: string | null; email: string | null; isMain: boolean; isActive: boolean;
  units: number; damaged: number; stockValue: number; staff: number; openShift: string | null; transfersToReceive: number;
};
type Form = { code: string; name: string; address: string; phone: string; email: string };

const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BranchesPage() {
  const { token, logout } = useAdmin();
  const { branch: current } = useBranch(token);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [branches, setBranches] = useState<BranchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BranchRow | "new" | null>(null);
  const [form, setForm] = useState<Form>({ code: "", name: "", address: "", phone: "", email: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const api = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}/api/pos${path}`, { ...init, headers, cache: "no-store" });
    if (response.status === 401) { logout(); throw new Error("Signed out"); }
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
    if (!response.ok) throw new Error((payload.errors && Object.values(payload.errors).flat()[0]) ?? payload.message ?? "Something went wrong");
    return payload.data as T;
  }, [headers, logout]);
  const load = useCallback(async () => {
    try { setBranches(await api<BranchRow[]>("/branches?all=1")); setError(null); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load branches"); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3500); };
  const openForm = (row: BranchRow | "new") => {
    setEditing(row);
    setFormError(null);
    setForm(row === "new" ? { code: "", name: "", address: "", phone: "", email: "" } : { code: row.code, name: row.name, address: row.address ?? "", phone: row.phone ?? "", email: row.email ?? "" });
  };
  const save = async () => {
    setBusy(true); setFormError(null);
    try {
      const body = JSON.stringify({ code: form.code, name: form.name, address: form.address || null, phone: form.phone || null, email: form.email.trim() || null });
      if (editing === "new") await api("/branches", { method: "POST", body });
      else if (editing) await api(`/branches/${editing.id}`, { method: "PATCH", body });
      flash(editing === "new" ? `${form.name} added` : `${form.name} saved`);
      setEditing(null);
      void load();
    } catch (saveError) { setFormError(saveError instanceof Error ? saveError.message : "Could not save"); } finally { setBusy(false); }
  };
  const setActive = async (row: BranchRow, isActive: boolean) => {
    try { await api(`/branches/${row.id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }); flash(`${row.name} ${isActive ? "reopened" : "closed"}`); void load(); }
    catch (activeError) { setError(activeError instanceof Error ? activeError.message : "Could not change the branch"); }
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconBranch /></div>
          <div>
            <h2 className="page-title">Branches</h2>
            <p className="page-subtitle">Each branch has its own stock, tills, Day End and cash drawer. Products, prices and loyalty members are shared. Move stock between branches with Branch Transfers (GTN).</p>
          </div>
        </div>
        <button type="button" className="btn-accent" onClick={() => openForm("new")}><IconPlus /> Add branch</button>
      </div>
      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="br-grid">
        {branches === null && <div className="lx-skel" style={{ height: 180 }} />}
        {branches?.map((row) => (
          <section key={row.id} className={`br-card${row.id === current?.id ? " current" : ""}${row.isActive ? "" : " closed"}`}>
            <h3>{row.name} <span className="code">{row.code}</span></h3>
            <p>{row.address || "No address"}{row.phone ? ` · ${row.phone}` : ""}{row.email ? ` · ${row.email}` : ""}</p>
            <div className="br-tags">
              {row.isMain && <span>Main branch</span>}
              {row.id === current?.id && <span className="live">You are working here</span>}
              {!row.isActive && <span className="warn">Closed</span>}
              {row.openShift && <span className="live">Till open · {row.openShift}</span>}
              {row.transfersToReceive > 0 && <span className="warn">{row.transfersToReceive} transfer(s) to receive</span>}
            </div>
            <div className="br-stats">
              <div><span>Bottles</span><b>{row.units.toLocaleString()}</b></div>
              <div><span>Stock value</span><b style={{ fontSize: "0.82rem" }}>{money(row.stockValue)}</b></div>
              <div><span>Staff</span><b>{row.staff}</b></div>
            </div>
            {row.damaged > 0 && <p>{row.damaged} damaged bottle(s) kept aside</p>}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {row.isActive && row.id !== current?.id && <button type="button" className="btn-accent lx-row-btn" onClick={() => void switchBranch(token, row.id)}>Work here</button>}
              <button type="button" className="btn-outline lx-row-btn" onClick={() => openForm(row)}>Edit</button>
              {!row.isMain && (row.isActive
                ? <button type="button" className="btn-outline lx-row-btn" onClick={() => void setActive(row, false)}>Close branch</button>
                : <button type="button" className="btn-outline lx-row-btn" onClick={() => void setActive(row, true)}>Reopen</button>)}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <div className="bm-modal-backdrop" onClick={() => setEditing(null)}>
          <form className="bm-modal lx-member-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }}>
            <div className="po-modal-head">
              <h3 className="bm-modal-title">{editing === "new" ? "Add branch" : `Edit ${editing.name}`}</h3>
              <button type="button" className="po-close" onClick={() => setEditing(null)} aria-label="Close"><IconClose /></button>
            </div>
            <div className="lx-member-grid">
              <label>Branch name *<input className="bm-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Kandy branch" autoFocus required /></label>
              <label>Short code *<input className="bm-input" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="e.g. KDY" maxLength={10} required /><small>Printed on transfer notes</small></label>
              <label className="wide">Address<input className="bm-input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label>Phone<input className="bm-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" /></label>
              <label>Branch email<input className="bm-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="e.g. kandy@yourshop.lk" /><small>Printed on this branch&apos;s purchase orders. Supplier replies come here.</small></label>
            </div>
            {editing === "new" && <p className="po-note">A new branch starts with no stock. Send it stock from another branch with a GTN, or receive supplier deliveries there with a GRN. Assign its cashiers under Staff &amp; Roles.</p>}
            {formError && <div className="bm-alert bm-alert-error">{formError}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={busy}>{busy ? "Saving…" : "Save branch"}</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className="lx-toasts"><div className="lx-toast ok"><span className="lx-toast-icon"><IconCheck size={16} /></span><div><strong>{toast}</strong></div></div></div>}
    </div>
  );
}
