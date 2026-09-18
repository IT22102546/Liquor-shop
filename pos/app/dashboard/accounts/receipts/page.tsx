"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconAccounts, IconEdit } from "../../../lib/icons";
import TablePagination, { paginateRows } from "../../../components/TablePagination";

type Account = {
  id: number;
  name: string;
  code: string;
  type: string;
  level: "MAIN" | "SUB";
  isActive: boolean;
  mainAccounts: Array<{ id: number; name: string; code: string }>;
};

type InvoicePaymentRow = {
  id: number;
  purchaseId: number;
  amount: number;
  paymentMethod: "CASH" | "CHEQUE" | "BANK_TRANSFER";
  chequeNo?: string | null;
  chequeBank?: string | null;
  chequeDate?: string | null;
  description?: string | null;
  paidAt: string;
  invoiceRef: string;
  itemLabel: string;
  purchase: {
    id: number;
    invoiceGroupCode?: string | null;
    customer: { firstName: string; lastName: string; nic: string; mobileNumber: string };
  };
};

type ReceiptRow = {
  id: number;
  receiptNo: string;
  createdAt: string;
  amount: number;
  paymentMethod: "CASH" | "CHEQUE" | "BANK_TRANSFER";
  chequeNo?: string | null;
  chequeBank?: string | null;
  chequeStatus?: "PENDING" | "CLEARED" | "BOUNCED" | null;
  isVoided: boolean;
  isDeposited: boolean;
  description?: string | null;
  account: { id: number; name: string; code: string } | null;
  purchase: { id: number; invoiceGroupCode?: string | null; customer: { firstName: string; lastName: string; nic: string } };
};

type DepositRow = {
  id: number;
  depositNo: string;
  createdAt: string;
  totalAmount: number;
  isReversed: boolean;
  receiptCount: number;
  account: { id: number; name: string; code: string };
  subAccount?: { id: number; name: string; code: string } | null;
  notes?: string | null;
};

const EMPTY_EDIT_FORM = {
  purchaseId: 0,
  amount: 0,
  paymentMethod: "CASH" as "CASH" | "CHEQUE",
  chequeNo: "",
  chequeBank: "",
  chequeDate: "",
  description: "",
};

function formatRs(v: number) {
  return `Rs. ${v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB");
}

export default function ReceiptsPage() {
  const { token } = useAdmin();
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Payment queue
  const [payments, setPayments] = useState<InvoicePaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [generatePayment, setGeneratePayment] = useState<InvoicePaymentRow | null>(null);
  const [genDescription, setGenDescription] = useState("");
  const [genError, setGenError] = useState("");
  const [genSaving, setGenSaving] = useState(false);

  // Receipts
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [toDate, setToDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<number>>(new Set());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [printReceipt, setPrintReceipt] = useState<any>(null);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Deposits
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [depositAccountId, setDepositAccountId] = useState(0);
  const [depositSubAccountId, setDepositSubAccountId] = useState(0);
  const [depositNotes, setDepositNotes] = useState("");
  const [depositError, setDepositError] = useState("");
  const [depositSaving, setDepositSaving] = useState(false);
  const [showDepositHistory, setShowDepositHistory] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [receiptsPage, setReceiptsPage] = useState(1);
  const [depositsPage, setDepositsPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const pagedPayments = useMemo(() => paginateRows(payments, paymentsPage, pageSize), [payments, paymentsPage, pageSize]);
  const pagedReceipts = useMemo(() => paginateRows(receipts, receiptsPage, pageSize), [receipts, receiptsPage, pageSize]);
  const pagedDeposits = useMemo(() => paginateRows(deposits, depositsPage, pageSize), [deposits, depositsPage, pageSize]);
  const mainAccounts = useMemo(
    () => accounts.filter((account) => account.level === "MAIN"),
    [accounts],
  );
  const availableSubAccounts = useMemo(
    () => accounts.filter(
      (account) => account.level === "SUB"
        && account.mainAccounts.some((main) => main.id === depositAccountId),
    ),
    [accounts, depositAccountId],
  );
  useEffect(() => { setPaymentsPage(1); }, [paymentSearch, pageSize]);
  useEffect(() => { setReceiptsPage(1); }, [search, fromDate, toDate, pageSize]);
  useEffect(() => { setDepositsPage(1); }, [pageSize]);

  async function fetchAccounts() {
    const res = await fetch(`${API_URL}/api/pos/accounts/chart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setAccounts((d.data ?? []).filter((a: Account) => a.isActive));
  }

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    const params = new URLSearchParams({ limit: "200" });
    if (paymentSearch.trim()) params.set("search", paymentSearch.trim());
    const res = await fetch(`${API_URL}/api/pos/accounts/payments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setPayments(d.data?.data ?? []);
    setLoadingPayments(false);
  }, [token, paymentSearch]);

  const fetchReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    const params = new URLSearchParams({ limit: "200" });
    if (search.trim()) params.set("search", search.trim());
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const res = await fetch(`${API_URL}/api/pos/accounts/receipts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setReceipts(d.data?.data ?? []);
    setTotal(d.data?.pagination?.total ?? 0);
    setLoadingReceipts(false);
  }, [token, search, fromDate, toDate]);

  const fetchDeposits = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/pos/accounts/deposits?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setDeposits(d.data?.data ?? []);
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) fetchPayments();
  }, [token, fetchPayments]);

  useEffect(() => {
    if (token) fetchReceipts();
  }, [token, fetchReceipts]);

  useEffect(() => {
    if (token) fetchDeposits();
  }, [token, fetchDeposits]);

  async function fetchReceiptForPrint(id: number) {
    const res = await fetch(`${API_URL}/api/pos/accounts/receipts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    setPrintReceipt(d.data);
  }

  // Generate receipt from payment
  function openGenerateModal(p: InvoicePaymentRow) {
    setGeneratePayment(p);
    setGenDescription("");
    setGenError("");
  }

  async function submitGenerateReceipt() {
    if (!generatePayment) return;
    setGenSaving(true);
    setGenError("");
    try {
      const res = await fetch(`${API_URL}/api/pos/accounts/payments/${generatePayment.id}/generate-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: genDescription || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setGenError(d.message ?? "Failed to generate receipt"); setGenSaving(false); return; }
      setGeneratePayment(null);
      await Promise.all([fetchPayments(), fetchReceipts()]);
      if (d.data?.id) fetchReceiptForPrint(d.data.id);
    } catch {
      setGenError("Network error");
    } finally {
      setGenSaving(false);
    }
  }

  // Receipts actions
  async function doVoid(id: number) {
    await fetch(`${API_URL}/api/pos/accounts/receipts/${id}/void`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchReceipts();
  }

  function handleVoid(id: number) {
    setConfirmModal({
      title: "Void Receipt",
      message: "Void this receipt? This cannot be undone.",
      onConfirm: () => doVoid(id),
    });
  }

  async function doBounce(id: number) {
    await fetch(`${API_URL}/api/pos/accounts/receipts/${id}/bounce`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchReceipts();
  }

  function handleBounce(r: ReceiptRow) {
    setConfirmModal({
      title: "Mark Cheque as Bounced",
      message: "A reversal entry will be created in the ledger and this receipt will become available to deposit again.",
      onConfirm: () => doBounce(r.id),
    });
  }

  async function handleClearCheque(id: number) {
    await fetch(`${API_URL}/api/pos/accounts/receipts/${id}/clear`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchReceipts();
  }

  function openEdit(r: ReceiptRow) {
    setEditingReceipt(r);
    setEditForm({
      purchaseId: r.purchase.id,
      amount: r.amount,
      paymentMethod: (r.paymentMethod === "BANK_TRANSFER" ? "CASH" : r.paymentMethod) as "CASH" | "CHEQUE",
      chequeNo: r.chequeNo ?? "",
      chequeBank: r.chequeBank ?? "",
      chequeDate: "",
      description: r.description ?? "",
    });
    setEditError("");
  }

  async function submitEdit() {
    if (!editingReceipt) return;
    setEditSaving(true);
    setEditError("");
    try {
      const body: Record<string, unknown> = {
        amount: editForm.amount,
        paymentMethod: editForm.paymentMethod,
        description: editForm.description || undefined,
      };
      if (editForm.paymentMethod === "CHEQUE") {
        body.chequeNo = editForm.chequeNo;
        body.chequeBank = editForm.chequeBank || undefined;
      }
      const res = await fetch(`${API_URL}/api/pos/accounts/receipts/${editingReceipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setEditError(d.message ?? "Failed to update");
        return;
      }
      setEditingReceipt(null);
      fetchReceipts();
    } catch {
      setEditError("Network error");
    } finally {
      setEditSaving(false);
    }
  }

  // Deposit selection
  function toggleReceiptSelection(id: number) {
    setSelectedReceiptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedReceipts = receipts.filter((r) => selectedReceiptIds.has(r.id));
  const selectedTotal = selectedReceipts.reduce((s, r) => s + r.amount, 0);

  async function submitDeposit() {
    if (selectedReceiptIds.size === 0) return;
    if (!depositAccountId) { setDepositError("Please select an account"); return; }
    setDepositSaving(true);
    setDepositError("");
    try {
      const res = await fetch(`${API_URL}/api/pos/accounts/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountId: depositAccountId,
          subAccountId: depositSubAccountId || undefined,
          receiptIds: [...selectedReceiptIds],
          notes: depositNotes || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setDepositError(d.message ?? "Failed to create deposit"); setDepositSaving(false); return; }
      setSelectedReceiptIds(new Set());
      setDepositNotes("");
      setDepositAccountId(0);
      setDepositSubAccountId(0);
      await Promise.all([fetchReceipts(), fetchDeposits()]);
    } catch {
      setDepositError("Network error");
    } finally {
      setDepositSaving(false);
    }
  }

  async function doReverseDeposit(id: number) {
    await fetch(`${API_URL}/api/pos/accounts/deposits/${id}/reverse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await Promise.all([fetchReceipts(), fetchDeposits()]);
  }

  function handleReverseDeposit(id: number) {
    setConfirmModal({
      title: "Reverse Deposit",
      message: "The receipts will become undeposited and a reversal ledger entry will be created.",
      onConfirm: () => doReverseDeposit(id),
    });
  }

  function chequeStatusBadge(r: ReceiptRow) {
    if (r.paymentMethod !== "CHEQUE") return null;
    if (r.chequeStatus === "CLEARED") return <span className="badge badge-active">Cheque Cleared</span>;
    if (r.chequeStatus === "BOUNCED") return <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Bounced</span>;
    return <span className="badge badge-pending">Cheque Pending</span>;
  }

  const activeReceipts = receipts.filter((r) => !r.isVoided);
  const totalReceiptsAmount = activeReceipts.reduce((s, r) => s + r.amount, 0);
  const depositableReceipts = receipts.filter(
    (r) => !r.isVoided && !r.isDeposited
  );

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <span className="page-title-icon"><IconAccounts /></span>
          <div>
            <h1 className="page-title">Receipt Management</h1>
            <p className="page-subtitle">Review payments, generate receipts, and manage end-of-day deposits</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="bm-stats-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-label">Pending Receipt Generation</div>
          <div className="bm-stat-value">{payments.length}</div>
          <div className="bm-stat-sub">payments awaiting receipt</div>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-label">Receipts (filtered)</div>
          <div className="bm-stat-value">{activeReceipts.length}</div>
          <div className="bm-stat-sub">{formatRs(totalReceiptsAmount)}</div>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-label">Ready to Deposit</div>
          <div className="bm-stat-value">{depositableReceipts.length}</div>
          <div className="bm-stat-sub">{formatRs(depositableReceipts.reduce((s, r) => s + r.amount, 0))}</div>
        </div>
      </div>

      {/* ── Section 1: Payment Queue ── */}
      <div className="bm-table-card" style={{ marginBottom: "1.5rem" }}>
        <div className="panel-header">
          <div className="panel-title-row">
            <span style={{ color: "var(--accent)" }}><IconAccounts /></span>
            <h3>Payment Queue — Generate Receipts</h3>
            <span className="badge badge-pending" style={{ marginLeft: 8 }}>{payments.length} pending</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              className="bm-input"
              style={{ width: 220, height: 34 }}
              placeholder="Search customer or invoice..."
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
            />
          </div>
        </div>
        {loadingPayments ? (
          <div className="bm-table-empty">Loading payment queue...</div>
        ) : payments.length === 0 ? (
          <div className="bm-table-empty">No pending payments — all payments have receipts generated.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice Ref</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Method</th>
                  <th>Paid At</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)" }}>
                        {p.invoiceRef}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.purchase.customer.firstName} {p.purchase.customer.lastName}</div>
                      <div className="td-muted" style={{ fontSize: "0.78rem" }}>{p.purchase.customer.nic}</div>
                    </td>
                    <td className="td-muted" style={{ fontSize: "0.82rem", maxWidth: 180 }}>{p.itemLabel}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--success)" }}>
                      {formatRs(p.amount)}
                    </td>
                    <td>
                      <span className={`badge ${p.paymentMethod === "CHEQUE" ? "badge-review" : "badge-active"}`}>
                        {p.paymentMethod}
                      </span>
                      {p.paymentMethod === "CHEQUE" && p.chequeNo && (
                        <div className="td-muted" style={{ fontSize: "0.75rem" }}>#{p.chequeNo}</div>
                      )}
                    </td>
                    <td className="td-muted">{formatDate(p.paidAt)}</td>
                    <td className="td-muted" style={{ fontSize: "0.82rem" }}>{p.description ?? "—"}</td>
                    <td>
                      <button
                        className="btn-accent"
                        style={{ fontSize: "0.78rem", padding: "4px 12px" }}
                        onClick={() => openGenerateModal(p)}
                      >
                        Generate Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination page={paymentsPage} pageSize={pageSize} total={payments.length} onPageChange={setPaymentsPage} onPageSizeChange={setPageSize} />
      </div>

      {/* ── Section 2: Receipts + Deposit Selection ── */}
      <div className="bm-filter-card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: "0.75rem", alignItems: "end" }}>
          <div className="bm-field-group" style={{ marginBottom: 0 }}>
            <label className="users-label">Search</label>
            <input
              className="bm-input"
              placeholder="Receipt no, customer name or NIC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bm-field-group" style={{ marginBottom: 0 }}>
            <label className="users-label">From Date</label>
            <input type="date" className="bm-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="bm-field-group" style={{ marginBottom: 0 }}>
            <label className="users-label">To Date</label>
            <input type="date" className="bm-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bm-table-card" style={{ marginBottom: "1.5rem" }}>
        <div className="panel-header">
          <div className="panel-title-row">
            <span style={{ color: "var(--accent)" }}><IconAccounts /></span>
            <h3>Receipt History</h3>
            {selectedReceiptIds.size > 0 && (
              <span className="badge badge-pending" style={{ marginLeft: 8 }}>
                {selectedReceiptIds.size} selected — {formatRs(selectedTotal)}
              </span>
            )}
          </div>
          {selectedReceiptIds.size > 0 && (
            <button className="btn-outline" style={{ fontSize: "0.8rem" }} onClick={() => setSelectedReceiptIds(new Set())}>
              Clear selection
            </button>
          )}
        </div>
        <div className="bm-alert bm-alert-info" style={{ margin: "0 1.25rem 1rem" }}>
          <strong>Cheque status guide:</strong> a cheque starts as <strong>Cheque Pending</strong> until it's deposited.
          Once deposited it shows <strong>Clearance Pending</strong> — click <strong>Cleared</strong> once the bank
          confirms it (status becomes <strong>Deposited</strong>), or <strong>Bounced</strong> if the bank returns it
          (this posts a reversal in the ledger and frees the receipt to be deposited again).
        </div>
        {loadingReceipts ? (
          <div className="bm-table-empty">Loading receipts...</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={depositableReceipts.length > 0 && depositableReceipts.every((r) => selectedReceiptIds.has(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedReceiptIds(new Set(depositableReceipts.map((r) => r.id)));
                        else setSelectedReceiptIds(new Set());
                      }}
                      title="Select all depositable"
                    />
                  </th>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Invoice Ref</th>
                  <th>Customer</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Method</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr><td colSpan={10} className="bm-table-empty">No receipts found</td></tr>
                ) : pagedReceipts.map((r) => {
                  const canSelect = !r.isVoided && !r.isDeposited;
                  return (
                    <tr key={r.id} style={{ opacity: r.isVoided ? 0.5 : 1, background: selectedReceiptIds.has(r.id) ? "var(--accent-bg, #f0f7ff)" : undefined }}>
                      <td>
                        {canSelect && (
                          <input
                            type="checkbox"
                            checked={selectedReceiptIds.has(r.id)}
                            onChange={() => toggleReceiptSelection(r.id)}
                          />
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)" }}>
                          {r.receiptNo}
                        </span>
                      </td>
                      <td className="td-muted">{formatDate(r.createdAt)}</td>
                      <td className="td-muted">{r.purchase.invoiceGroupCode ?? `INV-${String(r.purchase.id).padStart(5, "0")}`}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.purchase.customer.firstName} {r.purchase.customer.lastName}</div>
                        <div className="td-muted" style={{ fontSize: "0.78rem" }}>{r.purchase.customer.nic}</div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatRs(r.amount)}</td>
                      <td>
                        <span className={`badge ${r.paymentMethod === "CHEQUE" ? "badge-review" : "badge-active"}`}>
                          {r.paymentMethod}
                        </span>
                      </td>
                      <td className="td-muted">{r.account?.name ?? "—"}</td>
                      <td>
                        {r.isVoided
                          ? <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Voided</span>
                          : r.isDeposited
                          ? (r.paymentMethod === "CHEQUE" && r.chequeStatus === "PENDING"
                              ? <span className="badge badge-pending">Clearance Pending</span>
                              : <span className="badge" style={{ background: "var(--success-bg, #e6f9f0)", color: "var(--success)" }}>Deposited</span>)
                          : chequeStatusBadge(r) ?? <span className="badge badge-active">Active</span>
                        }
                      </td>
                      <td>
                        <div className="bm-row-actions">
                          <button className="bm-action-btn" style={{ fontSize: "0.9rem" }} onClick={() => fetchReceiptForPrint(r.id)} title="Print">🖨</button>
                          {!r.isVoided && !r.isDeposited && (
                            <button className="bm-action-btn bm-edit-btn" onClick={() => openEdit(r)} title="Edit"><IconEdit /></button>
                          )}
                          {!r.isVoided && r.isDeposited && r.paymentMethod === "CHEQUE" && r.chequeStatus === "PENDING" && (
                            <>
                              <button className="bm-action-btn" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={() => handleClearCheque(r.id)}>Cleared</button>
                              <button className="bm-action-btn" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={() => handleBounce(r)}>Bounced</button>
                            </>
                          )}
                          {!r.isVoided && !r.isDeposited && (
                            <button className="bm-action-btn" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={() => handleVoid(r.id)}>Void</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination page={receiptsPage} pageSize={pageSize} total={receipts.length} onPageChange={setReceiptsPage} onPageSizeChange={setPageSize} />
      </div>

      {/* ── Section 3: Deposit Panel ── */}
      {selectedReceiptIds.size > 0 && (
        <div className="bm-table-card" style={{ marginBottom: "1.5rem", borderColor: "var(--accent)" }}>
          <div className="panel-header">
            <div className="panel-title-row">
              <span style={{ color: "var(--accent)" }}><IconAccounts /></span>
              <h3>Create Deposit</h3>
              <span className="badge badge-pending" style={{ marginLeft: 8 }}>{selectedReceiptIds.size} receipts — {formatRs(selectedTotal)}</span>
            </div>
          </div>
          <div style={{ padding: "1rem 1.25rem" }}>
            {depositError && <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{depositError}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "end" }}>
              <div className="bm-field-group" style={{ marginBottom: 0 }}>
                <label className="users-label">Main Account *</label>
                <select className="bm-select" value={depositAccountId} onChange={(e) => {
                  setDepositAccountId(Number(e.target.value));
                  setDepositSubAccountId(0);
                }}>
                  <option value={0}>— Select Main Account —</option>
                  {mainAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                </select>
              </div>
              <div className="bm-field-group" style={{ marginBottom: 0 }}>
                <label className="users-label">Sub Account (optional)</label>
                <select
                  className="bm-select"
                  value={depositSubAccountId}
                  disabled={!depositAccountId || availableSubAccounts.length === 0}
                  onChange={(e) => setDepositSubAccountId(Number(e.target.value))}
                >
                  <option value={0}>— No Sub Account —</option>
                  {availableSubAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                </select>
              </div>
              <div className="bm-field-group" style={{ marginBottom: 0 }}>
                <label className="users-label">Notes (optional)</label>
                <input className="bm-input" placeholder="e.g. Cash collected today" value={depositNotes} onChange={(e) => setDepositNotes(e.target.value)} />
              </div>
              <button className="btn-accent" onClick={submitDeposit} disabled={depositSaving} style={{ height: 38 }}>
                {depositSaving ? "Creating..." : "Create Deposit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit history */}
      <div className="bm-table-card">
        <div className="panel-header" style={{ cursor: "pointer" }} onClick={() => setShowDepositHistory((v) => !v)}>
          <div className="panel-title-row">
            <span style={{ color: "var(--accent)" }}><IconAccounts /></span>
            <h3>Deposit History</h3>
            <span className="badge" style={{ marginLeft: 8, background: "var(--bg-soft)", color: "var(--text-soft)" }}>{deposits.length}</span>
          </div>
          <button className="btn-outline" style={{ fontSize: "0.78rem" }}>{showDepositHistory ? "Hide" : "Show"}</button>
        </div>
        {showDepositHistory && (
          deposits.length === 0 ? (
            <div className="bm-table-empty">No deposits yet.</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Deposit No</th>
                    <th>Date</th>
                    <th>Main Account</th>
                    <th>Sub Account</th>
                    <th>Receipts</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDeposits.map((d) => (
                    <tr key={d.id} style={{ opacity: d.isReversed ? 0.5 : 1 }}>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)" }}>
                          {d.depositNo}
                        </span>
                      </td>
                      <td className="td-muted">{formatDate(d.createdAt)}</td>
                      <td className="td-muted">{d.account.name}</td>
                      <td className="td-muted">{d.subAccount?.name ?? "—"}</td>
                      <td className="td-muted">{d.receiptCount} receipt{d.receiptCount !== 1 ? "s" : ""}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatRs(d.totalAmount)}</td>
                      <td>
                        {d.isReversed
                          ? <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Reversed</span>
                          : <span className="badge badge-active">Deposited</span>
                        }
                      </td>
                      <td className="td-muted" style={{ fontSize: "0.82rem" }}>{d.notes ?? "—"}</td>
                      <td>
                        {!d.isReversed && (
                          <button
                            className="bm-action-btn"
                            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                            onClick={() => handleReverseDeposit(d.id)}
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {showDepositHistory && <TablePagination page={depositsPage} pageSize={pageSize} total={deposits.length} onPageChange={setDepositsPage} onPageSizeChange={setPageSize} />}
      </div>

      {/* Confirm action modal */}
      {confirmModal && (
        <div className="bm-modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={() => setConfirmModal(null)}>✕</button>
            <h2 className="bm-modal-title">{confirmModal.title}</h2>
            <div className="bm-modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="bm-modal-actions">
              <button className="btn-outline" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className="btn-danger"
                onClick={() => {
                  const { onConfirm } = confirmModal;
                  setConfirmModal(null);
                  onConfirm();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Receipt Modal */}
      {generatePayment && (
        <div className="bm-modal-backdrop" onClick={() => setGeneratePayment(null)}>
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={() => setGeneratePayment(null)}>✕</button>
            <h2 className="bm-modal-title">Generate Receipt</h2>
            <div className="bm-modal-body">
              {genError && <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{genError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ padding: "0.75rem", background: "var(--bg-soft)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                  <div><strong>Invoice:</strong> {generatePayment.invoiceRef}</div>
                  <div><strong>Customer:</strong> {generatePayment.purchase.customer.firstName} {generatePayment.purchase.customer.lastName}</div>
                  <div><strong>Amount:</strong> <span style={{ color: "var(--success)", fontWeight: 700 }}>{formatRs(generatePayment.amount)}</span></div>
                  <div><strong>Method:</strong> {generatePayment.paymentMethod}{generatePayment.chequeNo ? ` — Cheque #${generatePayment.chequeNo}` : ""}</div>
                </div>
                <div className="bm-field-group">
                  <label className="users-label">Description (optional)</label>
                  <input className="bm-input" value={genDescription} onChange={(e) => setGenDescription(e.target.value)} placeholder="Add a note..." />
                </div>
              </div>
            </div>
            <div className="bm-modal-actions">
              <button className="btn-outline" onClick={() => setGeneratePayment(null)}>Cancel</button>
              <button className="btn-accent" onClick={submitGenerateReceipt} disabled={genSaving}>
                {genSaving ? "Generating..." : "Generate Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit receipt modal */}
      {editingReceipt && (
        <div className="bm-modal-backdrop" onClick={() => setEditingReceipt(null)}>
          <div className="bm-modal bm-modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={() => setEditingReceipt(null)}>✕</button>
            <h2 className="bm-modal-title">Edit Receipt — {editingReceipt.receiptNo}</h2>
            <div className="bm-modal-body">
              {editError && <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{editError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div className="bm-field-group">
                  <label className="users-label">Amount (Rs.) *</label>
                  <input className="bm-input" type="number" min={0} value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
                </div>
                <div className="bm-field-group">
                  <label className="users-label">Payment Method</label>
                  <div style={{ display: "flex", gap: 20 }}>
                    {(["CASH", "CHEQUE"] as const).map((m) => (
                      <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                        <input type="radio" checked={editForm.paymentMethod === m} onChange={() => setEditForm({ ...editForm, paymentMethod: m })} style={{ accentColor: "var(--accent)" }} />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                {editForm.paymentMethod === "CHEQUE" && (
                  <div className="bm-field-group">
                    <label className="users-label">Cheque No</label>
                    <input className="bm-input" value={editForm.chequeNo} onChange={(e) => setEditForm({ ...editForm, chequeNo: e.target.value })} />
                  </div>
                )}
                <div className="bm-field-group">
                  <label className="users-label">Description</label>
                  <input className="bm-input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="bm-modal-actions">
              <button className="btn-outline" onClick={() => setEditingReceipt(null)}>Cancel</button>
              <button className="btn-accent" onClick={submitEdit} disabled={editSaving}>
                {editSaving ? "Saving..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print receipt modal */}
      {printReceipt && (
        <div className="bm-modal-backdrop print-hide" onClick={() => setPrintReceipt(null)}>
          <div className="bm-modal bm-modal-lg invoice-print-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close print-hide" onClick={() => setPrintReceipt(null)}>✕</button>
            <h2 className="bm-modal-title print-hide">Receipt — {printReceipt.receiptNo}</h2>
            <div className="bm-modal-body">
              <div style={{ padding: "1.25rem", border: "1px solid var(--panel-border)", borderRadius: "var(--radius-md)", background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text)" }}>BAR SHOP</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>Importers, Exporters &amp; Dealers Of Motorcycles</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>No:154, Puttalam Road, Kurunegala, Sri Lanka</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>Tel: 071 791 0091</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>RECEIPT</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>Receipt No: <strong style={{ color: "var(--text)" }}>{printReceipt.receiptNo}</strong></div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>Date: {formatDate(printReceipt.createdAt)}</div>
                  </div>
                </div>
                <hr style={{ margin: "12px 0", borderColor: "var(--panel-border)" }} />
                <div style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                  <div><strong>Received From:</strong> {printReceipt.purchase?.customer?.firstName} {printReceipt.purchase?.customer?.lastName}</div>
                  <div style={{ color: "var(--text-soft)" }}>NIC: {printReceipt.purchase?.customer?.nic}</div>
                  <div style={{ color: "var(--text-soft)" }}>Mobile: {printReceipt.purchase?.customer?.mobileNumber}</div>
                </div>
                <hr style={{ margin: "12px 0", borderColor: "var(--panel-border)" }} />
                <table className="data-table" style={{ width: "100%" }}>
                  <tbody>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Invoice Reference</td><td style={{ textAlign: "right" }}>{printReceipt.purchase?.invoiceGroupCode ?? `INV-${String(printReceipt.purchase?.id ?? "").padStart(5, "0")}`}</td></tr>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Amount Received</td><td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>{formatRs(printReceipt.amount)}</td></tr>
                    <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Payment Method</td><td style={{ textAlign: "right" }}>{printReceipt.paymentMethod}</td></tr>
                    {printReceipt.paymentMethod === "CHEQUE" && (
                      <>
                        <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Cheque No</td><td style={{ textAlign: "right" }}>{printReceipt.chequeNo}</td></tr>
                        {printReceipt.chequeBank && <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Cheque Bank</td><td style={{ textAlign: "right" }}>{printReceipt.chequeBank}</td></tr>}
                      </>
                    )}
                    {printReceipt.account && <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Deposited to Account</td><td style={{ textAlign: "right" }}>{printReceipt.account.name}</td></tr>}
                    {printReceipt.description && <tr><td style={{ color: "var(--text-soft)", fontSize: "0.85rem" }}>Notes</td><td style={{ textAlign: "right" }}>{printReceipt.description}</td></tr>}
                  </tbody>
                </table>
                <hr style={{ margin: "16px 0", borderColor: "var(--panel-border)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #333", width: 120, marginBottom: 4 }} /><small style={{ color: "var(--text-soft)" }}>Customer Signature</small></div>
                  <div style={{ textAlign: "center" }}><div style={{ borderTop: "1px solid #333", width: 120, marginBottom: 4 }} /><small style={{ color: "var(--text-soft)" }}>Authorised Signature</small></div>
                </div>
              </div>
            </div>
            <div className="bm-modal-actions print-hide">
              <button className="btn-outline print-hide" onClick={() => setPrintReceipt(null)}>Close</button>
              <button className="btn-accent print-hide" onClick={() => window.print()}>🖨 Print Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
