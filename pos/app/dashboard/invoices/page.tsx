"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconInvoice, IconUsers } from "../../lib/icons";
import { readApiData } from "../../lib/api";
import CustomerPurchaseModal from "../../components/CustomerPurchaseModal";

type InstallmentPayment = {
  id: number;
  amount: number;
  penaltyAmount: number;
  note?: string | null;
  paidAt: string;
};

type Installment = {
  id: number;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  isPartial: boolean;
  penaltyRate: number;
  penaltyAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  settledAt?: string | null;
  payments?: InstallmentPayment[];
};

type Purchase = {
  id: number;
  purchasedAt: string;
  itemType: "INVENTORY" | "CUSTOM";
  purchaseMode?: "SINGLE" | "BULK";
  invoiceGroupCode?: string | null;
  quantity: number;
  currentSellingPrice?: number | null;
  finalSellingPrice: number;
  paymentType?: "DIRECT" | "DOWNPAYMENT";
  downPaymentAmount?: number;
  remainingAmount?: number;
  settlementStatus?: "SETTLED" | "TO_SETTLE";
  extraCosts?: Array<{ label: string; amount: number }>;
  interestRate?: number | null;
  installmentMonths?: number | null;
  monthlyInstallmentAmount?: number | null;
  totalWithInterest?: number | null;
  customer: {
    id: number;
    firstName: string;
    lastName: string;
    nic: string;
    mobileNumber: string;
    address: string;
    province: string;
    district: string;
  };
  inventory?: {
    id: number;
    displayId: string;
    name: string;
    brand: string;
    category: string;
    supplier?: string | null;
    description?: string | null;
  } | null;
  customCategory?: string | null;
  customDescription?: string | null;
};

type InvoiceRow = {
  key: string;
  invoiceLabel: string;
  purchasedAt: string;
  customer: Purchase["customer"];
  entries: Purchase[];
  quantity: number;
  finalSellingPrice: number;
  currentSellingPrice: number;
  downPaymentAmount: number;
  extraCosts: Array<{ label: string; amount: number }>;
  remainingAmount: number;
  settlementStatus: "SETTLED" | "TO_SETTLE";
  paymentTypeText: string;
  purchaseModeText: "Single" | "Bulk";
  itemTitle: string;
  itemSubtitle: string;
};

type InvoiceTerm = {
  id: number;
  text: string;
  sortOrder: number;
  isActive: boolean;
  termType: "ADVANCE" | "FINAL";
};

type InvoiceAccount = {
  id: number;
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  branchName?: string | null;
  sortOrder: number;
  isActive: boolean;
};

function getActiveInvoiceTerms(terms: InvoiceTerm[], termType: "ADVANCE" | "FINAL") {
  return terms
    .filter((term) => term.isActive && term.termType === termType)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((term) => term.text);
}

function getActiveInvoiceAccounts(accounts: InvoiceAccount[]) {
  return accounts
    .filter((account) => account.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

function escapeInvoiceHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ENTITY_MAP[char] ?? char);
}

export default function InvoicesPage() {
  const { token } = useAdmin();
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [invoiceInstallments, setInvoiceInstallments] = useState<Installment[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState<number | "all">(20);
  const [currentPage, setCurrentPage] = useState(1);

  const base = `${API_URL}/api/pos/user-management`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const invoicesQuery = useQuery({
    queryKey: ["pos", "invoices", token],
    enabled: Boolean(token),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<Purchase[]> => {
      const response = await fetch(`${base}/purchases?page=1&limit=500`, { headers: auth, cache: "no-store" });
      const payload = await readApiData<{ purchases?: Purchase[] }>(response, "Failed to load invoices");
      return payload.purchases ?? [];
    },
  });

  const invoiceTermsQuery = useQuery({
    queryKey: ["pos", "invoice-terms", token],
    enabled: Boolean(token),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<InvoiceTerm[]> => {
      try {
        const response = await fetch(`${base}/invoice-terms`, { headers: auth, cache: "no-store" });
        const payload = await response.json() as { data?: { terms?: InvoiceTerm[] }; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Failed to load invoice terms");
        return payload.data?.terms ?? [];
      } catch {
        return [];
      }
    },
  });

  const invoiceAccountsQuery = useQuery({
    queryKey: ["pos", "invoice-accounts", token],
    enabled: Boolean(token),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<InvoiceAccount[]> => {
      try {
        const response = await fetch(`${base}/invoice-accounts`, { headers: auth, cache: "no-store" });
        const payload = await readApiData<{ accounts?: InvoiceAccount[] }>(response, "Failed to load invoice accounts");
        return payload.accounts ?? [];
      } catch {
        return [];
      }
    },
  });

  const invoices = invoicesQuery.data ?? [];
  const invoiceTerms = invoiceTermsQuery.data ?? [];
  const invoiceAccounts = invoiceAccountsQuery.data ?? [];
  const loading = invoicesQuery.isLoading;
  const refreshing = invoicesQuery.isFetching || invoiceTermsQuery.isFetching || invoiceAccountsQuery.isFetching;
  const visibleError = invoicesQuery.error instanceof Error ? invoicesQuery.error.message : null;
  const invoiceSupportLoading = invoiceTermsQuery.isLoading || invoiceAccountsQuery.isLoading;

  const handleRefresh = useCallback(() => {
    void invoicesQuery.refetch();
    void invoiceTermsQuery.refetch();
    void invoiceAccountsQuery.refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  const [editingEntry, setEditingEntry] = useState<Purchase | null>(null);
  const [editFsp, setEditFsp] = useState("");
  const [editDown, setEditDown] = useState("");
  const [editMobileNumber, setEditMobileNumber] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editHasReceipts, setEditHasReceipts] = useState(false);
  const [editFinancialsEnabled, setEditFinancialsEnabled] = useState(false);

  const handlePrintInvoice = useCallback((_invoice: InvoiceRow) => {
    setIsPreparingPrint(true);
    requestAnimationFrame(() => {
      window.print();
      setIsPreparingPrint(false);
    });
  }, []);

  function openEditModal(invoice: InvoiceRow) {
    const entry = invoice.entries[0];
    setEditFsp(String(entry.finalSellingPrice));
    setEditDown(String(entry.downPaymentAmount ?? ""));
    setEditMobileNumber(entry.customer.mobileNumber);
    setEditError(null);
    setEditFinancialsEnabled(invoice.purchaseModeText === "Single");
    const outstanding = entry.finalSellingPrice - (entry.downPaymentAmount ?? 0);
    setEditHasReceipts(
      invoice.purchaseModeText === "Single" &&
      (entry.remainingAmount ?? 0) < outstanding
    );
    setEditingEntry(entry);
  }

  async function submitEditInvoice() {
    if (!editingEntry) return;
    const mobileNumber = editMobileNumber.trim();
    if (mobileNumber.length < 7 || mobileNumber.length > 20) {
      setEditError("Mobile number must be between 7 and 20 characters");
      return;
    }

    const body: Record<string, number | string> = { mobileNumber };
    if (editFinancialsEnabled) {
      const fsp = parseFloat(editFsp);
      if (!isFinite(fsp) || fsp < 0) {
        setEditError("Final selling price must be a valid positive number");
        return;
      }
      body.finalSellingPrice = fsp;
      if (editingEntry.paymentType === "DOWNPAYMENT") {
        const down = parseFloat(editDown);
        if (!isFinite(down) || down < 0) { setEditError("Down payment must be a valid number"); return; }
        body.downPaymentAmount = down;
      }
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`${base}/purchases/${editingEntry.id}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json() as { message?: string };
      if (!res.ok) { setEditError(payload.message ?? "Failed to update invoice"); return; }
      setEditingEntry(null);
      void invoicesQuery.refetch();
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedInvoice) { setInvoiceInstallments([]); return; }
    const entry = selectedInvoice.entries.find((e) => (e.installmentMonths ?? 0) > 0);
    if (!entry) { setInvoiceInstallments([]); return; }
    void (async () => {
      try {
        const resp = await fetch(`${base}/${entry.customer.id}/purchases/${entry.id}/installments`, { headers: auth, cache: "no-store" });
        const json = await resp.json() as { data?: { installments?: Installment[] } };
        setInvoiceInstallments(json.data?.installments ?? []);
      } catch { setInvoiceInstallments([]); }
    })();
  }, [auth, base, selectedInvoice]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rowsPerPage]);

  const getPurchaseItemMeta = useCallback((entry: Purchase) => {
    if (entry.itemType === "INVENTORY" && entry.inventory) {
      return {
        title: entry.inventory.name,
        subtitle: `${entry.inventory.displayId} • ${entry.inventory.brand}`,
      };
    }
    if (entry.itemType === "CUSTOM") {
      return {
        title: entry.customCategory ?? "Custom Invoice",
        subtitle: entry.customDescription ?? "—",
      };
    }
    return { title: "Unknown item", subtitle: "-" };
  }, []);

  const isDownPaymentEntry = useCallback((entry: Purchase) => {
    if (entry.paymentType === "DOWNPAYMENT") return true;
    const downPayment = entry.downPaymentAmount ?? 0;
    const remaining = entry.remainingAmount ?? 0;
    if (remaining > 0) return true;
    if (downPayment > 0 && downPayment < entry.finalSellingPrice) return true;
    return false;
  }, []);

  const getPaymentLabel = useCallback((entry: Purchase) => {
    return isDownPaymentEntry(entry) ? "Downpayment" : "Direct";
  }, [isDownPaymentEntry]);

  const invoiceRows = useMemo(() => {
    const grouped = new Map<string, Purchase[]>();

    invoices.forEach((entry: Purchase) => {
      const groupCode = entry.invoiceGroupCode?.trim();
      const key = groupCode
        ? `group:${entry.customer.id}:${groupCode}`
        : `single:${entry.id}`;
      const existing = grouped.get(key);
      if (existing) existing.push(entry);
      else grouped.set(key, [entry]);
    });

    const rows: InvoiceRow[] = Array.from(grouped.entries()).map(([key, entries]) => {
      const sorted = [...entries].sort((a, b) => +new Date(b.purchasedAt) - +new Date(a.purchasedAt));
      const representative = sorted[0];
      const explicitGroupCode = representative.invoiceGroupCode?.trim();
      const isBulk = sorted.length > 1 || representative.purchaseMode === "BULK" || !!explicitGroupCode;

      const quantity = sorted.reduce((sum, entry) => sum + entry.quantity, 0);
      const finalSellingPrice = sorted.reduce((sum, entry) => sum + entry.finalSellingPrice, 0);
      const currentSellingPrice = sorted.reduce((sum, entry) => sum + (entry.currentSellingPrice ?? 0), 0);
      const downPaymentAmount = sorted.reduce((sum, entry) => {
        const explicit = entry.downPaymentAmount ?? 0;
        if (explicit > 0) return sum + explicit;
        if (!isDownPaymentEntry(entry)) return sum;
        return sum + Math.max(0, entry.finalSellingPrice - (entry.remainingAmount ?? 0));
      }, 0);
      const extraCosts = sorted.flatMap((entry) => Array.isArray(entry.extraCosts) ? entry.extraCosts : []);
      const remainingAmount = Math.max(0, Math.round(sorted.reduce((sum, entry) => sum + (entry.remainingAmount ?? 0), 0) * 100) / 100);
      const settlementStatus: "SETTLED" | "TO_SETTLE" = remainingAmount > 0 || sorted.some((entry) => entry.settlementStatus === "TO_SETTLE")
        ? "TO_SETTLE"
        : "SETTLED";
      const paymentTypeText = getPaymentLabel(representative);

      const itemTitle = isBulk ? `Bulk Purchase (${sorted.length} items)` : getPurchaseItemMeta(representative).title;
      const itemSubtitle = isBulk
        ? sorted.slice(0, 2).map((entry) => getPurchaseItemMeta(entry).title).join(" + ")
        : getPurchaseItemMeta(representative).subtitle;

      const invoiceLabel = explicitGroupCode
        ? explicitGroupCode
        : isBulk
          ? `BULK-${String(Math.min(...sorted.map((entry) => entry.id))).padStart(5, "0")}`
          : `INV-${String(representative.id).padStart(5, "0")}`;

      return {
        key,
        invoiceLabel,
        purchasedAt: representative.purchasedAt,
        customer: representative.customer,
        entries: sorted,
        quantity,
        finalSellingPrice,
        currentSellingPrice,
        downPaymentAmount,
        extraCosts,
        remainingAmount,
        settlementStatus,
        paymentTypeText,
        purchaseModeText: isBulk ? "Bulk" : "Single",
        itemTitle,
        itemSubtitle,
      };
    });

    rows.sort((a, b) => +new Date(b.purchasedAt) - +new Date(a.purchasedAt));
    return rows;
  }, [getPaymentLabel, getPurchaseItemMeta, invoices, isDownPaymentEntry]);

  const filteredInvoiceRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return invoiceRows;

    return invoiceRows.filter((invoice: InvoiceRow) => {
      const searchableValues = [
        invoice.invoiceLabel,
        invoice.customer.firstName,
        invoice.customer.lastName,
        invoice.customer.nic,
        invoice.customer.mobileNumber,
        invoice.customer.address,
        invoice.customer.province,
        invoice.customer.district,
        invoice.itemTitle,
        invoice.itemSubtitle,
        invoice.paymentTypeText,
        invoice.purchaseModeText,
        ...invoice.entries.flatMap((entry) => [
          String(entry.id),
          entry.customer.nic,
          entry.customer.mobileNumber,
          entry.inventory?.displayId,
          entry.inventory?.name,
          entry.inventory?.brand,
        ]),
      ];

      return searchableValues.some((value) => value?.toLowerCase().includes(needle));
    });
  }, [invoiceRows, search]);

  const pagedRows = useMemo(() => {
    if (rowsPerPage === "all") return filteredInvoiceRows;
    const rpp = rowsPerPage as number;
    return filteredInvoiceRows.slice((currentPage - 1) * rpp, currentPage * rpp);
  }, [filteredInvoiceRows, rowsPerPage, currentPage]);

  const totalPages = rowsPerPage === "all" ? 1 : Math.max(1, Math.ceil(filteredInvoiceRows.length / (rowsPerPage as number)));

  const totalInvoiceAmount = useMemo(
    () => invoiceRows.reduce((sum, invoice) => sum + invoice.finalSellingPrice, 0),
    [invoiceRows]
  );

  const selectedInvoiceTermType: "ADVANCE" | "FINAL" = selectedInvoice && selectedInvoice.remainingAmount > 0
    ? "ADVANCE"
    : "FINAL";
  const activeInvoiceTerms = useMemo((): string[] => {
    return getActiveInvoiceTerms(invoiceTerms, selectedInvoiceTermType);
  }, [invoiceTerms, selectedInvoiceTermType]);

  const activeInvoiceAccounts = useMemo((): InvoiceAccount[] => {
    return getActiveInvoiceAccounts(invoiceAccounts);
  }, [invoiceAccounts]);

  const getInvoiceGrandTotal = (invoice: InvoiceRow) => {
    const effectiveTotal = invoice.entries.reduce((sum, e) => sum + (e.totalWithInterest ?? e.finalSellingPrice), 0);
    const extraCostsTotal = invoice.extraCosts.reduce((sum, cost) => sum + cost.amount, 0);
    return effectiveTotal + extraCostsTotal;
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconInvoice /></div>
          <div>
            <h2 className="page-title">Invoice Management</h2>
            <p className="page-subtitle">Purchase invoices with complete customer and item details.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-accent"
          onClick={() => setShowCustomModal(true)}
        >
          + Generate Custom Invoice
        </button>
      </div>

      {showCustomModal && (
        <CustomerPurchaseModal
          token={token}
          itemType="CUSTOM"
          itemId={0}
          itemLabel="Custom Invoice"
          onClose={() => setShowCustomModal(false)}
          onSaved={() => {
            setShowCustomModal(false);
            void invoicesQuery.refetch();
          }}
        />
      )}

      {visibleError && <div className="bm-alert bm-alert-error">{visibleError}</div>}

      <div className="bm-stats-grid" style={{ marginBottom: "1rem" }}>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconInvoice /></span><span className="bm-stat-label">Total Invoices</span></div>
          <strong className="bm-stat-value">{invoiceRows.length}</strong>
          <span className="bm-stat-sub">Completed purchase invoices</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconUsers /></span><span className="bm-stat-label">Total Amount</span></div>
          <strong className="bm-stat-value">Rs. {totalInvoiceAmount.toLocaleString()}</strong>
          <span className="bm-stat-sub">Sum of final selling prices</span>
        </div>
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="bm-input"
            style={{ maxWidth: 420 }}
            placeholder="Search by customer, NIC, item ID, or product name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn-outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Mobile Number</th>
                <th>Item</th>
                <th>Final Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="bm-table-empty">Loading invoices...</td></tr>}
              {!loading && filteredInvoiceRows.length === 0 && <tr><td colSpan={8} className="bm-table-empty">No invoices found.</td></tr>}
              {!loading && pagedRows.map((invoice) => (
                <tr key={invoice.key}>
                  <td>{invoice.invoiceLabel}</td>
                  <td>{new Date(invoice.purchasedAt).toLocaleString()}</td>
                  <td>{invoice.customer.firstName} {invoice.customer.lastName}</td>
                  <td>{invoice.customer.mobileNumber}</td>
                  <td>
                    <div className="users-order-title">{invoice.itemTitle}</div>
                    <span className="users-order-item-meta">{invoice.itemSubtitle}</span>
                    <span className="users-muted" style={{ display: "block" }}>{invoice.purchaseModeText} • {invoice.paymentTypeText}</span>
                  </td>
                  <td>Rs. {invoice.finalSellingPrice.toLocaleString()}</td>
                  <td>
                    {(invoice.remainingAmount > 0 || invoice.settlementStatus === "SETTLED") && (
                      <span style={{
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        color: invoice.settlementStatus === "SETTLED" ? "var(--green)" : "var(--amber, #f59e0b)",
                      }}>
                        {invoice.settlementStatus === "SETTLED" ? "Settled" : "To Settle"}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="btn-outline" onClick={() => setSelectedInvoice(invoice)}>View Invoice</button>
                      <button type="button" className="btn-outline" onClick={() => openEditModal(invoice)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInvoiceRows.length > 0 && (
          <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--panel-border)", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--text-soft)" }}>Rows per page:</span>
              <select
                className="bm-select"
                style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                value={rowsPerPage}
                onChange={(e) => {
                  const v = e.target.value;
                  setRowsPerPage(v === "all" ? "all" : Number(v));
                }}
              >
                {([10, 20, 50, 100] as const).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value="all">All</option>
              </select>
            </div>
            {rowsPerPage !== "all" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text-soft)" }}>
                  {`${(currentPage - 1) * (rowsPerPage as number) + 1}–${Math.min(currentPage * (rowsPerPage as number), filteredInvoiceRows.length)}`} of {filteredInvoiceRows.length}
                </span>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ‹ Prev
                </button>
                <span style={{ color: "var(--text-soft)" }}>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="bm-modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="bm-modal bm-modal-lg invoice-template-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bm-modal-close" onClick={() => setSelectedInvoice(null)}>x</button>
            <div className="invoice-paper">
              <header className="invoice-paper-header">
                <img src="/landing/lion-logo.png" alt="Bar Shop" className="invoice-brand-logo" />
                <p className="invoice-brand-line">Importers, Exporters & Dealers Of Motorcycles, Motor Vehicles, Machineries & Other</p>
                <p className="invoice-brand-line">Beverages, mixers, snacks, and bar supplies.</p>
                <p className="invoice-brand-address">No:154, Puttalam Road, Kurunegala, Sri Lanka, Kurunegala</p>
              </header>

              <section className="invoice-paper-body">
                <div className="invoice-meta-row">
                  <strong>Invoice No: #{String(Math.min(...selectedInvoice.entries.map((entry) => entry.id))).padStart(4, "0")}</strong>
                  <strong>Date: {new Date(selectedInvoice.purchasedAt).toLocaleDateString("en-GB")}</strong>
                </div>

                <div className="invoice-customer-block">
                  <strong>{selectedInvoice.customer.firstName} {selectedInvoice.customer.lastName}</strong>
                  <span>Mobile: {selectedInvoice.customer.mobileNumber}</span>
                  <span>{selectedInvoice.customer.address}</span>
                  <span>{selectedInvoice.customer.district}</span>
                </div>

                <div className="invoice-divider" />

                <table className="invoice-print-table">
                  <thead>
                    <tr>
                      <th className="invoice-col-desc">Description</th>
                      <th className="invoice-col-qty">Qty</th>
                      <th className="invoice-col-amount">Unit Price</th>
                      <th className="invoice-col-amount">Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.entries.map((entry) => {
                      const itemMeta = getPurchaseItemMeta(entry);
                      return (
                        <tr key={`entry-${entry.id}`}>
                          <td className="invoice-desc-cell">
                            <strong>{itemMeta.title}</strong>
                            <div className="invoice-item-meta">{itemMeta.subtitle}</div>
                          </td>
                          <td className="invoice-col-qty">{entry.quantity}</td>
                          <td className="invoice-col-amount">Rs. {(entry.quantity > 0 ? entry.finalSellingPrice / entry.quantity : entry.finalSellingPrice).toLocaleString()}</td>
                          <td className="invoice-col-amount">Rs. {entry.finalSellingPrice.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {selectedInvoice.extraCosts.map((cost, index) => (
                      <tr key={`extra-${index}-${cost.label}`} className="invoice-registration-row">
                        <td className="invoice-desc-cell">{cost.label}</td>
                        <td className="invoice-col-qty">1</td>
                        <td className="invoice-col-amount">Rs. {cost.amount.toLocaleString()}</td>
                        <td className="invoice-col-amount">Rs. {cost.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {(() => {
                      const interestEntry = selectedInvoice.entries.find((e) => (e.interestRate ?? 0) > 0 && (e.installmentMonths ?? 0) > 0);
                      if (!interestEntry) return null;
                      return (
                        <>
                          <tr className="invoice-summary-row">
                            <td className="invoice-desc-cell">Finance Charge ({interestEntry.interestRate}%)</td>
                            <td className="invoice-col-qty" />
                            <td className="invoice-col-amount">Rs. {((interestEntry.totalWithInterest ?? 0) - interestEntry.finalSellingPrice).toLocaleString()}</td>
                            <td className="invoice-col-amount" />
                          </tr>
                          <tr className="invoice-summary-row">
                            <td className="invoice-desc-cell">Monthly Installment × {interestEntry.installmentMonths} months</td>
                            <td className="invoice-col-qty" />
                            <td className="invoice-col-amount">Rs. {(interestEntry.monthlyInstallmentAmount ?? 0).toLocaleString()}</td>
                            <td className="invoice-col-amount" />
                          </tr>
                        </>
                      );
                    })()}
                    <tr className="invoice-summary-row">
                      <td className="invoice-desc-cell">Advance Paid</td>
                      <td className="invoice-col-qty" />
                      <td className="invoice-col-amount">Rs. {selectedInvoice.downPaymentAmount.toLocaleString()}</td>
                      <td className="invoice-col-amount" />
                    </tr>
                    <tr className="invoice-summary-row invoice-balance-row">
                      <td className="invoice-desc-cell">Balance Remaining</td>
                      <td className="invoice-col-qty" />
                      <td className="invoice-col-amount">Rs. {selectedInvoice.remainingAmount.toLocaleString()}</td>
                      <td className="invoice-col-amount" />
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="invoice-total-label">Grand Total</td>
                      <td className="invoice-total-value">Rs. {getInvoiceGrandTotal(selectedInvoice).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="invoice-bank-block">
                  <strong>Bank Details</strong>
                  <span>019010033205</span>
                  <span>Bar Shop</span>
                  <span>HNB</span>
                </div>

                {invoiceInstallments.length > 0 && (() => {
                  const paidCount = invoiceInstallments.filter((i) => i.status === "PAID" || i.status === "PARTIAL").length;
                  const remainingCount = invoiceInstallments.filter((i) => i.status === "PENDING" || i.status === "PARTIAL").length;
                  return (
                    <>
                      <div className="invoice-divider" />
                      <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                        Installment Schedule — {paidCount} of {invoiceInstallments.length} months paid · {remainingCount} remaining
                      </strong>
                      <table className="invoice-print-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Due Date</th>
                            <th className="invoice-col-amount">Monthly Due</th>
                            <th className="invoice-col-amount">Paid</th>
                            <th className="invoice-col-amount">Penalty</th>
                            <th className="invoice-col-amount">Balance Due</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceInstallments.map((inst) => {
                            const balanceDue = Math.max(0, Math.round((inst.dueAmount + (inst.penaltyAmount ?? 0) - inst.paidAmount) * 100) / 100);
                            return (
                              <>
                                <tr key={inst.id} style={{ opacity: inst.status === "PAID" ? 0.65 : 1 }}>
                                  <td>{inst.installmentNo}</td>
                                  <td>
                                    {new Date(inst.dueDate).toLocaleDateString("en-GB")}
                                    {inst.settledAt && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Last: {new Date(inst.settledAt).toLocaleDateString("en-GB")}</div>}
                                  </td>
                                  <td className="invoice-col-amount">Rs. {inst.dueAmount.toLocaleString()}</td>
                                  <td className="invoice-col-amount">{inst.paidAmount > 0 ? `Rs. ${inst.paidAmount.toLocaleString()}` : "—"}</td>
                                  <td className="invoice-col-amount">{(inst.penaltyAmount ?? 0) > 0 ? `Rs. ${inst.penaltyAmount.toLocaleString()}` : "—"}</td>
                                  <td className="invoice-col-amount" style={{ fontWeight: balanceDue > 0 ? 600 : undefined, color: balanceDue > 0 ? "var(--amber, #f59e0b)" : undefined }}>
                                    {balanceDue > 0 ? `Rs. ${balanceDue.toLocaleString()}` : "—"}
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 600, color: inst.status === "PAID" ? "var(--green)" : inst.status === "PARTIAL" ? "var(--amber, #f59e0b)" : "var(--text-muted)" }}>
                                      {inst.status}
                                    </span>
                                  </td>
                                </tr>
                                {inst.payments && inst.payments.length > 0 && inst.payments.map((pay) => (
                                  <tr key={`pay-${pay.id}`} style={{ background: "var(--panel-bg, #f9f9f9)" }}>
                                    <td style={{ paddingLeft: "1.2rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>↳</td>
                                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{new Date(pay.paidAt).toLocaleDateString("en-GB")}</td>
                                    <td className="invoice-col-amount" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{pay.note ?? ""}</td>
                                    <td className="invoice-col-amount" style={{ fontSize: "0.78rem" }}>Rs. {pay.amount.toLocaleString()}</td>
                                    <td className="invoice-col-amount" style={{ fontSize: "0.78rem", color: pay.penaltyAmount > 0 ? "var(--amber, #f59e0b)" : "var(--text-muted)" }}>
                                      {pay.penaltyAmount > 0 ? `Rs. ${pay.penaltyAmount.toLocaleString()}` : "—"}
                                    </td>
                                    <td colSpan={2} />
                                  </tr>
                                ))}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  );
                })()}

                {activeInvoiceTerms.length > 0 && (
                  <>
                    <div className="invoice-divider" />
                    <strong style={{ display: "block", marginBottom: "0.45rem" }}>
                      {selectedInvoiceTermType === "ADVANCE" ? "Advance Payment" : "Final Payment"} Terms &amp; Conditions
                    </strong>
                    <ul className="invoice-paper-terms">
                      {activeInvoiceTerms.map((term, index) => (
                        <li key={`${index}-${term.slice(0, 24)}`}>{term}</li>
                      ))}
                    </ul>
                  </>
                )}

                <p className="invoice-support-note">If you have any questions concerning this invoice, please contact us at <strong>071 791 0091</strong></p>
              </section>
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button 
                type="button" 
                className="btn-accent" 
                disabled={invoiceSupportLoading || isPreparingPrint}
                onClick={() => void handlePrintInvoice(selectedInvoice)}
              >
                {invoiceSupportLoading || isPreparingPrint ? "Preparing Invoice..." : "Print Invoice"}
              </button>
              <button type="button" className="btn-outline" onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="bm-modal-backdrop" onClick={() => setEditingEntry(null)}>
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bm-modal-close" onClick={() => setEditingEntry(null)}>×</button>
            <h3 className="bm-modal-title">Edit Invoice</h3>
            <div className="bm-modal-body">
              {editHasReceipts && (
                <div style={{ background: "var(--amber-bg, #fef3c7)", border: "1px solid var(--amber, #f59e0b)", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.85rem", color: "var(--amber-dark, #92400e)" }}>
                  Warning: Payments for this invoice may already be receipted. Editing amounts may create a discrepancy with existing receipts.
                </div>
              )}
              {editError && (
                <div className="bm-alert bm-alert-error" style={{ marginBottom: "0.75rem" }}>{editError}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="bm-field-group">
                  <label className="users-label" htmlFor="invoice-mobile-number">Customer Mobile Number</label>
                  <input
                    id="invoice-mobile-number"
                    className="bm-input"
                    type="tel"
                    minLength={7}
                    maxLength={20}
                    value={editMobileNumber}
                    onChange={(e) => setEditMobileNumber(e.target.value)}
                    required
                  />
                </div>
                {editFinancialsEnabled && (
                  <div className="bm-field-group">
                    <label className="users-label">Final Selling Price (Rs.)</label>
                    <input
                      className="bm-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editFsp}
                      onChange={(e) => setEditFsp(e.target.value)}
                    />
                  </div>
                )}
                {editFinancialsEnabled && editingEntry.paymentType === "DOWNPAYMENT" && (
                  <div className="bm-field-group">
                    <label className="users-label">Down Payment Amount (Rs.)</label>
                    <input
                      className="bm-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editDown}
                      onChange={(e) => setEditDown(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="bm-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setEditingEntry(null)}>Cancel</button>
              <button
                type="button"
                className="btn-accent"
                onClick={() => void submitEditInvoice()}
                disabled={editSaving}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
