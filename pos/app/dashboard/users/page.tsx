"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconPlus, IconSearch, IconUsers } from "../../lib/icons";

type Member = {
  id: number;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string | null;
  nic: string | null;
  address: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  visits: number;
  lastVisitAt: string | null;
  createdAt: string;
};
type MemberBill = { id: number; billNo: string; soldAt: string; total: number; pointsEarned: number; units: number; items: Array<{ name: string; quantity: number }> };
type FormState = { firstName: string; lastName: string; mobileNumber: string; email: string; nic: string; address: string };

const EMPTY_FORM: FormState = { firstName: "", lastName: "", mobileNumber: "", email: "", nic: "", address: "" };
const PAGE_SIZE = 25;
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fullName = (member: Pick<Member, "firstName" | "lastName">) => [member.firstName, member.lastName].filter(Boolean).join(" ");
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function LoyaltyCustomersPage() {
  const { token, logout } = useAdmin();
  const base = `${API_URL}/api/pos/user-management`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [billsFor, setBillsFor] = useState<Member | null>(null);
  const [bills, setBills] = useState<MemberBill[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (appliedSearch) params.set("search", appliedSearch);
    try {
      const response = await fetch(`${base}?${params}`, { headers: auth, cache: "no-store" });
      if (response.status === 401) { logout(); return; }
      const payload = (await response.json()) as { data?: { users: Member[]; total: number }; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.message ?? "Failed to load customers");
      setMembers(payload.data.users);
      setTotal(payload.data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, auth, base, logout, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [appliedSearch]);

  useEffect(() => {
    if (!billsFor) return;
    setBills(null);
    void fetch(`${base}/sales?customerId=${billsFor.id}&limit=50`, { headers: auth, cache: "no-store" })
      .then((res) => res.json())
      .then((json: { data?: { sales: MemberBill[] } }) => setBills(json.data?.sales ?? []))
      .catch(() => setBills([]));
  }, [auth, base, billsFor]);

  const openForm = (member: Member | "new") => {
    setEditing(member);
    setFormError(null);
    setForm(member === "new" ? EMPTY_FORM : {
      firstName: member.firstName, lastName: member.lastName, mobileNumber: member.mobileNumber,
      email: member.email ?? "", nic: member.nic ?? "", address: member.address ?? "",
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch(editing === "new" ? base : `${base}/${editing.id}`, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.status === 401) { logout(); return; }
      const payload = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
      if (!response.ok) {
        setFormError((payload.errors && Object.values(payload.errors)[0]?.[0]) ?? payload.message ?? "Could not save");
        return;
      }
      setEditing(null);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const response = await fetch(`${base}/${deleting.id}`, { method: "DELETE", headers: auth }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setError("Could not delete the member");
    }
    setDeleting(null);
    void load();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconUsers /></div>
          <div>
            <h2 className="page-title">Loyalty Customers</h2>
            <p className="page-subtitle">Members earn 1 point for every Rs. 100 they spend. Everyone else is served as a walk-in customer.</p>
          </div>
        </div>
        <button type="button" className="btn-accent" onClick={() => openForm("new")}><IconPlus /> Add member</button>
      </div>

      <div className="lx-card lx-log-filters">
        <div className="lx-log-controls">
          <form className="pos-search-field" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}>
            <IconSearch />
            <input className="bm-input" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => setAppliedSearch(search.trim())} placeholder="Search by name or mobile number" aria-label="Search members" />
          </form>
          <span className="lx-card-sub">{total.toLocaleString()} member{total === 1 ? "" : "s"}</span>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="bm-table-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ textAlign: "right" }}>Points</th>
                <th style={{ textAlign: "right" }}>Visits</th>
                <th style={{ textAlign: "right" }}>Total spent</th>
                <th>Last visit</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && members.length === 0 && <tr><td colSpan={7} className="bm-table-empty">Loading members…</td></tr>}
              {!loading && members.length === 0 && (
                <tr><td colSpan={7} className="bm-table-empty">{appliedSearch ? "No member matches this search." : "No loyalty members yet. Add one here or from the counter while billing."}</td></tr>
              )}
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="lx-product-cell">
                      <span className="pos-member-avatar">{member.firstName.charAt(0).toUpperCase()}</span>
                      <div><strong>{fullName(member)}</strong><span>{member.mobileNumber}{member.email ? ` · ${member.email}` : ""}</span></div>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}><span className="lx-points">{member.loyaltyPoints.toLocaleString()}</span></td>
                  <td style={{ textAlign: "right" }}>{member.visits}</td>
                  <td style={{ textAlign: "right" }}>{money(member.totalSpent)}</td>
                  <td className="td-muted">{shortDate(member.lastVisitAt)}</td>
                  <td className="td-muted">{shortDate(member.createdAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btn-outline lx-row-btn" onClick={() => setBillsFor(member)}>Bills</button>
                    <button type="button" className="btn-outline lx-row-btn" onClick={() => openForm(member)}>Edit</button>
                    <button type="button" className="btn-outline lx-row-btn" onClick={() => setDeleting(member)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="lx-log-pager">
            <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button type="button" className="btn-outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        )}
      </div>

      {editing && (
        <div className="bm-modal-backdrop" onClick={() => setEditing(null)}>
          <form className="bm-modal lx-member-modal" onClick={(event) => event.stopPropagation()} onSubmit={save}>
            <h3 className="bm-modal-title">{editing === "new" ? "Add loyalty member" : `Edit ${fullName(editing)}`}</h3>
            <div className="lx-member-grid">
              <label>First name *<input className="bm-input" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required autoFocus /></label>
              <label>Last name<input className="bm-input" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
              <label>Mobile number *<input className="bm-input" value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} inputMode="tel" required /></label>
              <label>Email<input className="bm-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>NIC<input className="bm-input" value={form.nic} onChange={(event) => setForm({ ...form, nic: event.target.value })} /></label>
              <label className="wide">Address<input className="bm-input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            </div>
            {formError && <div className="bm-alert bm-alert-error">{formError}</div>}
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving…" : "Save member"}</button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="bm-modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="bm-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="bm-modal-title">Delete {fullName(deleting)}?</h3>
            <p className="bm-modal-body">
              Their {deleting.loyaltyPoints} loyalty points will be lost. Their past sales stay in the sales records as walk-in sales.
            </p>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setDeleting(null)}>Keep member</button>
              <button type="button" className="bm-btn-danger" disabled={saving} onClick={() => void remove()}>Delete member</button>
            </div>
          </div>
        </div>
      )}

      {billsFor && (
        <div className="bm-modal-backdrop" onClick={() => setBillsFor(null)}>
          <div className="bm-modal lx-member-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="bm-modal-title">{fullName(billsFor)}</h3>
            <p className="lx-card-sub">{billsFor.mobileNumber} · {billsFor.loyaltyPoints} points · {billsFor.visits} visits · {money(billsFor.totalSpent)} spent</p>
            <div className="lx-bill-list" style={{ maxHeight: "50vh", overflowY: "auto" }}>
              {bills === null && <div className="lx-skel" style={{ height: 56 }} />}
              {bills?.length === 0 && <div className="lx-empty">No bills yet.</div>}
              {bills?.map((bill) => (
                <div key={bill.id} className="lx-bill-row" style={{ gridTemplateColumns: "5.5rem minmax(0,1fr) auto" }}>
                  <span className="lx-bill-time"><strong>{new Date(bill.soldAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</strong><em>{new Date(bill.soldAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</em></span>
                  <span className="lx-bill-main"><strong>{bill.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</strong><em>{bill.billNo} · +{bill.pointsEarned} pts</em></span>
                  <span className="lx-bill-total">{money(bill.total)}</span>
                </div>
              ))}
            </div>
            <div className="bm-modal-actions"><button type="button" className="btn-accent" onClick={() => setBillsFor(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
