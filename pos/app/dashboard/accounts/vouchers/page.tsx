"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconAccounts, IconEdit, IconPlus } from "../../../lib/icons";
import TablePagination from "../../../components/TablePagination";

type Account = { id: number; name: string; code: string };

type VoucherRow = {
  id: number;
  voucherNo: string;
  createdAt: string;
  type: string;
  typeLabel: string;
  amount: number;
  description?: string | null;
  payee?: string | null;
  paymentDate?: string | null;
  referenceNo?: string | null;
  isVoided: boolean;
  account: { id: number; name: string; code: string };
  toAccount?: { id: number; name: string; code: string } | null;
};

type ApiErrorPayload = {
  message?: string;
  errors?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
};

const VOUCHER_TYPES = [
  { value: "VEHICLE_CLEARANCE", label: "Vehicle Clearance Payment" },
  { value: "BILL", label: "Bill" },
  { value: "OTHER_PAYMENT", label: "Other Payment" },
  { value: "PERMIT", label: "Permit Payment" },
  { value: "LEASING_PAYMENT", label: "Leasing Payment" },
  { value: "LOAN_PAYMENT", label: "Loan Payment" },
  { value: "SALARY", label: "Salary" },
  { value: "CUSTOMER_REFUND", label: "Customer Refund" },
  { value: "VEHICLE_PURCHASE", label: "Vehicle Purchase" },
  { value: "ADVANCE_REFUND", label: "Advance Invoice Refund" },
  { value: "ACCOUNT_TRANSFER", label: "Account Transfer" },
];

const EMPTY_FORM = {
  accountId: 0,
  toAccountId: 0,
  type: "",
  amount: 0,
  description: "",
  payee: "",
  paymentDate: new Date().toISOString().split("T")[0],
  referenceNo: "",
};

function formatRs(v: number) {
  return `Rs. ${v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB");
}

function buildVoucherTypeLabel(type: string) {
  return VOUCHER_TYPES.find((voucherType) => voucherType.value === type)?.label ?? type;
}

function preferText(value: unknown, fallback: string | null) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function displayText(value: string | null | undefined, fallback = "—") {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function getApiErrorMessage(payload: ApiErrorPayload, fallback: string) {
  const fieldErrors = payload.errors?.fieldErrors;
  const firstFieldError = fieldErrors
    ? Object.entries(fieldErrors).find(([, messages]) => messages.length > 0)
    : null;
  if (firstFieldError) {
    const [field, messages] = firstFieldError;
    return `${field}: ${messages[0]}`;
  }

  const formError = payload.errors?.formErrors?.[0];
  return formError || payload.message || fallback;
}

function normalizeVoucherRow(voucher: VoucherRow): VoucherRow {
  return {
    ...voucher,
    description: voucher.description?.trim() || null,
    payee: voucher.payee?.trim() || null,
    referenceNo: voucher.referenceNo?.trim() || null,
    toAccount: voucher.toAccount ?? null,
    typeLabel: voucher.typeLabel || buildVoucherTypeLabel(voucher.type),
  };
}

export default function VouchersPage() {
  const { token } = useAdmin();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalVouchers, setTotalVouchers] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [editingVoucher, setEditingVoucher] = useState<VoucherRow | null>(null);
  const [editForm, setEditForm] = useState({
    type: "",
    amount: 0,
    description: "",
    payee: "",
    paymentDate: "",
    referenceNo: "",
  });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [printVoucher, setPrintVoucher] = useState<VoucherRow | null>(null);

  async function fetchAccounts() {
    const res = await fetch(`${API_URL}/api/pos/accounts/chart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setAccounts((d.data ?? []).filter((a: Account & { isActive: boolean }) => a.isActive));
  }

  async function fetchVouchers(signal?: AbortSignal) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (voucherType) params.set("type", voucherType);

    try {
      const res = await fetch(`${API_URL}/api/pos/accounts/vouchers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error("Failed to load vouchers");
      const d = await res.json();
      if (signal?.aborted) return;
      const rows = Array.isArray(d.data?.data) ? d.data.data : Array.isArray(d.data) ? d.data : [];
      setVouchers(rows.map(normalizeVoucherRow));
      setTotalVouchers(Number(d.data?.pagination?.total ?? rows.length));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setVouchers([]);
      setTotalVouchers(0);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function fetchVoucherById(id: number) {
    const res = await fetch(`${API_URL}/api/pos/accounts/vouchers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const d = await res.json();
    return (d.data ?? null) as VoucherRow | null;
  }

  async function fetchBalance(accountId: number) {
    if (!accountId) { setAvailableBalance(null); return; }
    setBalanceLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pos/accounts/chart/${accountId}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setAvailableBalance(d.data?.balance ?? null);
    } catch {
      setAvailableBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      fetchAccounts();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void fetchVouchers(controller.signal);
    return () => controller.abort();
  }, [token, page, pageSize, debouncedSearch, voucherType]);

  async function submitVoucher() {
    if (!form.accountId) { setFormError("Select a from account"); return; }
    if (!form.type) { setFormError("Select a voucher type"); return; }
    if (form.type === "ACCOUNT_TRANSFER" && !form.toAccountId) { setFormError("Select a destination account"); return; }
    if (form.type === "ACCOUNT_TRANSFER" && form.toAccountId === form.accountId) { setFormError("Source and destination accounts must be different"); return; }
    if (!form.amount || form.amount <= 0) { setFormError("Enter a valid amount"); return; }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        accountId: form.accountId,
        type: form.type,
        amount: form.amount,
        description: form.description || undefined,
        paymentDate: form.paymentDate || undefined,
        referenceNo: form.referenceNo || undefined,
      };
      if (form.type === "ACCOUNT_TRANSFER") {
        body.toAccountId = form.toAccountId;
      } else {
        body.payee = form.payee || undefined;
      }
      const res = await fetch(`${API_URL}/api/pos/accounts/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(getApiErrorMessage(d, "Failed to create")); return; }
      const freshVoucher = (await fetchVoucherById(d.data.id)) ?? d.data;
      const createdVoucher = normalizeVoucherRow({
        ...freshVoucher,
        account: freshVoucher.account ?? accounts.find((account) => account.id === form.accountId) ?? { id: form.accountId, name: "", code: "" },
        toAccount: freshVoucher.toAccount ?? (form.type === "ACCOUNT_TRANSFER"
          ? accounts.find((account) => account.id === form.toAccountId) ?? null
          : null),
        typeLabel: freshVoucher.typeLabel ?? buildVoucherTypeLabel(form.type),
        description: preferText(freshVoucher.description, form.description || null),
        payee: preferText(freshVoucher.payee, form.type === "ACCOUNT_TRANSFER" ? null : (form.payee || null)),
        referenceNo: preferText(freshVoucher.referenceNo, form.referenceNo || null),
        paymentDate: preferText(freshVoucher.paymentDate, form.paymentDate || null),
      });
      setForm(EMPTY_FORM);
      setAvailableBalance(null);
      setPrintVoucher(createdVoucher);
      if (page === 1) {
        void fetchVouchers();
      } else {
        setPage(1);
      }
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(v: VoucherRow) {
    const msg = v.type === "ACCOUNT_TRANSFER"
      ? "Void this transfer? Both accounts will have their balances restored."
      : "Void this voucher? The ledger entry will be reversed.";
    if (!confirm(msg)) return;
    await fetch(`${API_URL}/api/pos/accounts/vouchers/${v.id}/void`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchVouchers();
  }

  function openEdit(v: VoucherRow) {
    setEditingVoucher(v);
    setEditForm({
      type: v.type,
      amount: v.amount,
      description: v.description ?? "",
      payee: v.payee ?? "",
      paymentDate: v.paymentDate ? v.paymentDate.split("T")[0] : "",
      referenceNo: v.referenceNo ?? "",
    });
    setEditError("");
  }

  async function submitEdit() {
    if (!editingVoucher) return;
    setEditSaving(true);
    setEditError("");
    try {
      const isTransfer = editingVoucher.type === "ACCOUNT_TRANSFER";
      const body: Record<string, unknown> = {
        description: editForm.description || undefined,
        paymentDate: editForm.paymentDate || undefined,
        referenceNo: editForm.referenceNo || undefined,
      };
      if (!isTransfer) {
        body.type = editForm.type || undefined;
        body.amount = editForm.amount;
        body.payee = editForm.payee || undefined;
      }
      const res = await fetch(`${API_URL}/api/pos/accounts/vouchers/${editingVoucher.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setEditError(getApiErrorMessage(d, "Failed")); return; }
      setEditingVoucher(null);
      fetchVouchers();
    } catch {
      setEditError("Network error");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <span className="page-title-icon"><IconAccounts /></span>
          <div>
            <h1 className="page-title">Vouchers</h1>
            <p className="page-subtitle">Record cash out / expense payments</p>
          </div>
        </div>
      </div>

      {/* Create voucher form */}
      <div className="bm-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--panel-border)", marginBottom: "1rem" }}>
          <span style={{ color: "var(--accent)" }}><IconPlus /></span>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>New Voucher</h3>
        </div>
        {formError && <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
        <div className="bm-fields-grid">
          <div className="bm-field-group">
            <label className="users-label">Voucher Type *</label>
            <select className="bm-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="">— Select type —</option>
              {VOUCHER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="bm-field-group">
            <label className="users-label">Amount (Rs.) *</label>
            <input className="bm-input" type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div className="bm-field-group">
            <label className="users-label">From Account *</label>
            <select
              className="bm-select"
              value={form.accountId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setForm({ ...form, accountId: id });
                fetchBalance(id);
              }}
            >
              <option value={0}>— Select account —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
            {form.accountId > 0 && (
              <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
                {balanceLoading
                  ? <span style={{ color: "var(--text-soft)" }}>Loading balance...</span>
                  : availableBalance !== null
                    ? <span style={{ color: availableBalance >= 0 ? "var(--success, #16a34a)" : "var(--danger, #dc2626)", fontWeight: 600 }}>
                        Available: {formatRs(availableBalance)}
                      </span>
                    : null}
              </div>
            )}
          </div>
          {form.type === "ACCOUNT_TRANSFER" && (
            <div className="bm-field-group">
              <label className="users-label">To Account *</label>
              <select
                className="bm-select"
                value={form.toAccountId}
                onChange={(e) => setForm({ ...form, toAccountId: Number(e.target.value) })}
              >
                <option value={0}>— Select destination account —</option>
                {accounts
                  .filter((a) => a.id !== form.accountId)
                  .map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
              </select>
            </div>
          )}
          {form.type !== "ACCOUNT_TRANSFER" && (
            <div className="bm-field-group">
              <label className="users-label">Payee / Recipient</label>
              <input
                className="bm-input"
                value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
                placeholder="e.g. employee name, supplier..."
              />
            </div>
          )}
          <div className="bm-field-group">
            <label className="users-label">Payment Date</label>
            <input
              className="bm-input"
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            />
          </div>
          <div className="bm-field-group">
            <label className="users-label">Reference No.</label>
            <input
              className="bm-input"
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              placeholder="Cheque no., bill ref..."
            />
          </div>
          <div className="bm-field-group">
            <label className="users-label">Description (optional)</label>
            <input className="bm-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Additional notes..." />
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-accent" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={submitVoucher} disabled={saving}>
            <IconPlus /> {saving ? "Creating..." : "Create Voucher"}
          </button>
        </div>
      </div>

      {/* Voucher history */}
      <div className="bm-table-card">
        <div className="panel-header">
          <div className="panel-title-row">
            <span style={{ color: "var(--accent)" }}><IconAccounts /></span>
            <h3>Voucher History</h3>
          </div>
        </div>
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <input
            className="bm-input"
            style={{ flex: "1 1 320px" }}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search voucher, payee, reference or account"
            aria-label="Search voucher history"
          />
          <select
            className="bm-select"
            style={{ flex: "1 1 240px", maxWidth: 360 }}
            value={voucherType}
            onChange={(event) => {
              setVoucherType(event.target.value);
              setPage(1);
            }}
            aria-label="Filter voucher history by voucher type"
          >
            <option value="">All Voucher Types</option>
            {VOUCHER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="bm-table-empty">Loading...</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Payee</th>
                  <th>Payment Date</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Account</th>
                  <th>Ref No.</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr><td colSpan={11} className="bm-table-empty">No vouchers match the selected filters</td></tr>
                ) : vouchers.map((v) => (
                  <tr key={v.id} style={{ opacity: v.isVoided ? 0.5 : 1 }}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)" }}>
                        {v.voucherNo}
                      </span>
                    </td>
                    <td className="td-muted">{formatDate(v.createdAt)}</td>
                    <td>{v.typeLabel}</td>
                    <td className="td-muted">
                      {v.type === "ACCOUNT_TRANSFER"
                        ? v.toAccount ? <span style={{ color: "var(--accent)", fontWeight: 600 }}>→ {v.toAccount.name}</span> : "—"
                        : displayText(v.payee)}
                    </td>
                    <td className="td-muted">
                      {v.paymentDate ? formatDate(v.paymentDate) : formatDate(v.createdAt)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatRs(v.amount)}</td>
                    <td className="td-muted">{v.account.name}</td>
                    <td className="td-muted" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{displayText(v.referenceNo)}</td>
                    <td className="td-muted">{displayText(v.description)}</td>
                    <td>
                      {v.isVoided
                        ? <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Voided</span>
                        : <span className="badge badge-active">Active</span>
                      }
                    </td>
                    <td>
                      <div className="bm-row-actions">
                        <button className="bm-action-btn" onClick={() => setPrintVoucher(v)} title="Print" style={{ fontSize: "0.9rem" }}>🖨</button>
                        {!v.isVoided && (
                          <button className="bm-action-btn bm-edit-btn" onClick={() => openEdit(v)}><IconEdit /></button>
                        )}
                        {!v.isVoided && (
                          <button className="bm-action-btn" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={() => handleVoid(v)}>Void</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={totalVouchers}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {/* Edit voucher modal */}
      {editingVoucher && (
        <div className="bm-modal-backdrop" onClick={() => setEditingVoucher(null)}>
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={() => setEditingVoucher(null)}>✕</button>
            <h2 className="bm-modal-title">Edit Voucher — {editingVoucher.voucherNo}</h2>
            <div className="bm-modal-body">
              {editError && <div className="bm-alert bm-alert-error" style={{ marginBottom: 10 }}>{editError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {editingVoucher?.type === "ACCOUNT_TRANSFER" ? (
                  <>
                    <div className="bm-field-group">
                      <label className="users-label">Type</label>
                      <input className="bm-input" value="Account Transfer" disabled style={{ opacity: 0.6 }} />
                    </div>
                    <div className="bm-field-group">
                      <label className="users-label">From Account</label>
                      <input className="bm-input" value={editingVoucher.account.name} disabled style={{ opacity: 0.6 }} />
                    </div>
                    <div className="bm-field-group">
                      <label className="users-label">To Account</label>
                      <input className="bm-input" value={editingVoucher.toAccount?.name ?? "—"} disabled style={{ opacity: 0.6 }} />
                    </div>
                    <div className="bm-field-group">
                      <label className="users-label">Amount (Rs.)</label>
                      <input className="bm-input" value={formatRs(editingVoucher.amount)} disabled style={{ opacity: 0.6 }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bm-field-group">
                      <label className="users-label">Type</label>
                      <select className="bm-select" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                        {VOUCHER_TYPES.filter((t) => t.value !== "ACCOUNT_TRANSFER").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="bm-field-group">
                      <label className="users-label">Amount (Rs.)</label>
                      <input className="bm-input" type="number" min={0} value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
                    </div>
                    <div className="bm-field-group">
                      <label className="users-label">Payee / Recipient</label>
                      <input className="bm-input" value={editForm.payee} onChange={(e) => setEditForm({ ...editForm, payee: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="bm-field-group">
                  <label className="users-label">Payment Date</label>
                  <input className="bm-input" type="date" value={editForm.paymentDate} onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })} />
                </div>
                <div className="bm-field-group">
                  <label className="users-label">Reference No.</label>
                  <input className="bm-input" value={editForm.referenceNo} onChange={(e) => setEditForm({ ...editForm, referenceNo: e.target.value })} />
                </div>
                <div className="bm-field-group">
                  <label className="users-label">Description</label>
                  <input className="bm-input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="bm-modal-actions">
              <button className="btn-outline" onClick={() => setEditingVoucher(null)}>Cancel</button>
              <button className="btn-accent" onClick={submitEdit} disabled={editSaving}>{editSaving ? "Saving..." : "Update"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Print voucher modal */}
      {printVoucher && (
        <div className="bm-modal-backdrop print-hide" onClick={() => setPrintVoucher(null)}>
          <div className="bm-modal bm-modal-lg invoice-print-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close print-hide" onClick={() => setPrintVoucher(null)}>✕</button>
            <h2 className="bm-modal-title print-hide">Voucher — {printVoucher.voucherNo}</h2>
            <div className="bm-modal-body" style={{ paddingTop: 8 }}>
              <div style={{ padding: "1.25rem", border: "1px solid var(--panel-border)", borderRadius: "var(--radius-md)", background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text)" }}>BAR SHOP</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>Importers, Exporters &amp; Dealers Of Motorcycles</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>No:154, Puttalam Road, Kurunegala, Sri Lanka</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>
                      {printVoucher.type === "ACCOUNT_TRANSFER" ? "TRANSFER VOUCHER" : "PAYMENT VOUCHER"}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>Voucher No: <strong style={{ color: "var(--text)" }}>{printVoucher.voucherNo}</strong></div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                      Date: {printVoucher.paymentDate ? formatDate(printVoucher.paymentDate) : formatDate(printVoucher.createdAt)}
                    </div>
                  </div>
                </div>
                <hr style={{ margin: "12px 0", borderColor: "var(--panel-border)" }} />
                <table className="data-table" style={{ width: "100%" }}>
                  <tbody>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Payment Type</td><td style={{ textAlign: "right", fontWeight: 600 }}>{printVoucher.typeLabel}</td></tr>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Amount</td><td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>{formatRs(printVoucher.amount)}</td></tr>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>From Account</td><td style={{ textAlign: "right" }}>{printVoucher.account.name} ({printVoucher.account.code})</td></tr>
                    {printVoucher.type === "ACCOUNT_TRANSFER" && printVoucher.toAccount && (
                      <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>To Account</td><td style={{ textAlign: "right", fontWeight: 600 }}>{printVoucher.toAccount.name} ({printVoucher.toAccount.code})</td></tr>
                    )}
                    {printVoucher.type !== "ACCOUNT_TRANSFER" && (
                      <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Payee / Recipient</td><td style={{ textAlign: "right", fontWeight: 600 }}>{displayText(printVoucher.payee)}</td></tr>
                    )}
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Reference No.</td><td style={{ textAlign: "right" }}>{displayText(printVoucher.referenceNo)}</td></tr>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Description</td><td style={{ textAlign: "right" }}>{displayText(printVoucher.description)}</td></tr>
                  </tbody>
                </table>
                <hr style={{ margin: "16px 0", borderColor: "var(--panel-border)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #333", width: 120, marginBottom: 4 }} /><small style={{ color: "var(--text-soft)" }}>Prepared By</small></div>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #333", width: 120, marginBottom: 4 }} /><small style={{ color: "var(--text-soft)" }}>Authorised By</small></div>
                </div>
              </div>
            </div>
            <div className="bm-modal-actions print-hide">
              <button className="btn-outline print-hide" onClick={() => setPrintVoucher(null)}>Close</button>
              <button className="btn-accent print-hide" onClick={() => window.print()}>🖨 Print Voucher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
