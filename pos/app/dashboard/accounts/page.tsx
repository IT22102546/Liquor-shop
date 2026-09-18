"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconAccounts, IconEdit, IconPlus } from "../../lib/icons";
import TablePagination, { paginateRows } from "../../components/TablePagination";

type Account = {
  id: number;
  name: string;
  code: string;
  type: "BANK" | "CASH";
  level: "MAIN" | "SUB";
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
  mainAccounts: Array<{ id: number; name: string; code: string }>;
  subAccounts: Array<{ id: number; name: string; code: string }>;
};

const EMPTY_FORM = {
  name: "",
  type: "BANK" as "BANK" | "CASH",
  level: "MAIN" as "MAIN" | "SUB",
  openingBalance: 0,
  mainAccountIds: [] as number[],
};

export default function ManageAccountsPage() {
  const { token } = useAdmin();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? accounts.filter((account) => [
      account.code,
      account.name,
      account.type,
      account.level,
      ...account.mainAccounts.map((main) => main.name),
      ...account.subAccounts.map((sub) => sub.name),
    ].some((value) => value.toLowerCase().includes(needle))) : accounts;
  }, [accounts, search]);
  const mainAccounts = useMemo(
    () => accounts.filter((account) => account.level === "MAIN" && account.isActive),
    [accounts],
  );
  const pagedAccounts = useMemo(() => paginateRows(filteredAccounts, page, pageSize), [filteredAccounts, page, pageSize]);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pos/accounts/chart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAccounts(data.data ?? []);
    } catch {
      setError("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchAccounts();
  }, [token]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc);
    setForm({
      name: acc.name,
      type: acc.type,
      level: acc.level,
      openingBalance: acc.openingBalance,
      mainAccountIds: acc.mainAccounts.map((main) => main.id),
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editing
        ? `${API_URL}/api/pos/accounts/chart/${editing.id}`
        : `${API_URL}/api/pos/accounts/chart`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? "Failed to save");
        return;
      }
      setModalOpen(false);
      fetchAccounts();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(acc: Account) {
    await fetch(`${API_URL}/api/pos/accounts/chart/${acc.id}/toggle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAccounts();
  }

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <span className="page-title-icon"><IconAccounts /></span>
          <div>
            <h1 className="page-title">Manage Accounts</h1>
            <p className="page-subtitle">Main financial accounts and linked customer sub accounts</p>
          </div>
        </div>
        <button className="btn-accent" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={openAdd}>
          <IconPlus /> Add Account
        </button>
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)" }}><input className="bm-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search account code, name or type" /></div>
        {loading ? (
          <div className="bm-table-empty">Loading accounts...</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Level</th>
                  <th>Type</th>
                  <th>Linked Accounts</th>
                  <th>Opening Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr><td colSpan={8} className="bm-table-empty">No accounts yet. Add your first account.</td></tr>
                ) : pagedAccounts.map((acc) => (
                  <tr key={acc.id} style={{ opacity: acc.isActive ? 1 : 0.55 }}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)" }}>
                        {acc.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{acc.name}</td>
                    <td>
                      <span className={`badge ${acc.level === "MAIN" ? "badge-review" : "badge-active"}`}>
                        {acc.level === "MAIN" ? "Main" : "Sub"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${acc.type === "BANK" ? "badge-review" : "badge-active"}`}>
                        {acc.type}
                      </span>
                    </td>
                    <td className="td-muted" style={{ fontSize: "0.8rem" }}>
                      {acc.level === "SUB"
                        ? acc.mainAccounts.map((main) => main.name).join(", ") || "—"
                        : `${acc.subAccounts.length} sub account${acc.subAccounts.length === 1 ? "" : "s"}`}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      Rs. {acc.openingBalance.toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${acc.isActive ? "badge-active" : "badge-pending"}`}>
                        {acc.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="bm-row-actions">
                        <button className="bm-action-btn bm-edit-btn" onClick={() => openEdit(acc)} title="Edit">
                          <IconEdit />
                        </button>
                        <button
                          className={`bm-action-btn ${acc.isActive ? "" : "bm-restore-btn"}`}
                          style={acc.isActive ? { borderColor: "var(--warning)", color: "var(--warning)" } : {}}
                          onClick={() => handleToggle(acc)}
                        >
                          {acc.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination page={page} pageSize={pageSize} total={filteredAccounts.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {modalOpen && (
        <div className="bm-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            <h2 className="bm-modal-title">{editing ? "Edit Account" : "Add Account"}</h2>
            <div className="bm-modal-body">
              {error && <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div className="bm-field-group">
                  <label className="users-label">Account Name *</label>
                  <input
                    className="bm-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Bar Shop HNB"
                  />
                </div>
                <div className="bm-field-group">
                  <label className="users-label">Account Level *</label>
                  <select
                    className="bm-select"
                    value={form.level}
                    disabled={Boolean(editing)}
                    onChange={(e) => setForm({
                      ...form,
                      level: e.target.value as "MAIN" | "SUB",
                      mainAccountIds: [],
                    })}
                  >
                    <option value="MAIN">Main Account</option>
                    <option value="SUB">Sub Account</option>
                  </select>
                  {editing && <small className="td-muted">Account level cannot be changed after creation.</small>}
                </div>
                <div className="bm-field-group">
                  <label className="users-label">Account Type *</label>
                  <select
                    className="bm-select"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "BANK" | "CASH" })}
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="CASH">Cash Account</option>
                  </select>
                </div>
                {form.level === "SUB" && (
                  <div className="bm-field-group">
                    <label className="users-label">Linked Main Accounts</label>
                    <div style={{ display: "grid", gap: 8, padding: "0.75rem", border: "1px solid var(--panel-border)", borderRadius: 8 }}>
                      {mainAccounts.length === 0 ? (
                        <span className="td-muted">Create a main account first.</span>
                      ) : mainAccounts.map((main) => (
                        <label key={main.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={form.mainAccountIds.includes(main.id)}
                            onChange={(e) => setForm({
                              ...form,
                              mainAccountIds: e.target.checked
                                ? [...form.mainAccountIds, main.id]
                                : form.mainAccountIds.filter((id) => id !== main.id),
                            })}
                          />
                          <span>{main.name} ({main.code})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bm-field-group">
                  <label className="users-label">Opening Balance (Rs.)</label>
                  <input
                    className="bm-input"
                    type="number"
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="bm-modal-actions">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-accent" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
