"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconLeasing } from "../../lib/icons";
import TablePagination, { paginateRows } from "../../components/TablePagination";

type LeasingCompany = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type LeasingApplication = {
  id: number;
  purchasedAt: string;
  invoiceGroupCode?: string | null;
  purchaseMode?: "SINGLE" | "BULK";
  finalSellingPrice: number;
  downPaymentAmount?: number;
  remainingAmount?: number;
  settlementStatus?: "SETTLED" | "TO_SETTLE";
  leasingDownPaymentAmount?: number;
  leasingFinancedAmount?: number;
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
  bike?: {
    id: number;
    displayId: string;
    brand: string;
    model: string;
    colour: string;
  } | null;
};

export default function LeasingCompaniesPage() {
  const { token } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [companies, setCompanies] = useState<LeasingCompany[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState("");

  const [selectedCompany, setSelectedCompany] = useState<LeasingCompany | null>(null);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [applications, setApplications] = useState<LeasingApplication[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [applicationPage, setApplicationPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [settleTarget, setSettleTarget] = useState<LeasingApplication | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<"CASH" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [settleChequeNo, setSettleChequeNo] = useState("");
  const [settleChequeBank, setSettleChequeBank] = useState("");
  const [settleChequeDate, setSettleChequeDate] = useState("");

  const base = `${API_URL}/api/pos/user-management`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const totalApplications = useMemo(
    () => applications.length,
    [applications]
  );

  const totalLeasingAmount = useMemo(
    () => applications.reduce((sum, entry) => sum + (entry.leasingFinancedAmount ?? 0), 0),
    [applications]
  );

  const totalOutstandingAmount = useMemo(
    () => applications.reduce((sum, entry) => sum + (entry.remainingAmount ?? 0), 0),
    [applications]
  );

  const settledApplications = useMemo(
    () => applications.filter((entry) => (entry.remainingAmount ?? 0) <= 0).length,
    [applications]
  );
  const filteredCompanies = useMemo(() => {
    const needle = companySearch.trim().toLowerCase();
    return needle ? companies.filter((company) => company.name.toLowerCase().includes(needle)) : companies;
  }, [companies, companySearch]);
  const pagedCompanies = useMemo(() => paginateRows(filteredCompanies, companyPage, pageSize), [filteredCompanies, companyPage, pageSize]);
  const pagedApplications = useMemo(() => paginateRows(applications, applicationPage, pageSize), [applications, applicationPage, pageSize]);
  useEffect(() => { setCompanyPage(1); }, [companySearch, pageSize]);
  useEffect(() => { setApplicationPage(1); }, [selectedCompany, pageSize]);

  const loadCompanies = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${base}/leasing-companies`, { headers: auth, cache: "no-store" });
      const payload = await response.json() as { data?: { companies?: LeasingCompany[] }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load leasing companies");
      setCompanies(payload.data?.companies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leasing companies");
    } finally {
      setLoading(false);
    }
  }, [auth, base, token]);

  const loadApplications = useCallback(async (company: LeasingCompany) => {
    if (!token) return;
    setSelectedCompany(company);
    setApplicationsLoading(true);
    setApplicationsError(null);
    setApplications([]);

    try {
      const response = await fetch(`${base}/leasing-companies/${company.id}/applications?page=1&limit=500`, { headers: auth, cache: "no-store" });
      const payload = await response.json() as { data?: { applications?: LeasingApplication[] }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load leasing applications");
      setApplications(payload.data?.applications ?? []);
    } catch (err) {
      setApplicationsError(err instanceof Error ? err.message : "Failed to load leasing applications");
    } finally {
      setApplicationsLoading(false);
    }
  }, [auth, base, token]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCompanyName.trim()) {
      setError("Leasing company name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${base}/leasing-companies`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to create leasing company");
      setSuccess("Leasing company created");
      setNewCompanyName("");
      await loadCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create leasing company");
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async (companyId: number) => {
    if (!editingCompanyName.trim()) {
      setError("Leasing company name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${base}/leasing-companies/${companyId}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCompanyName.trim() }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update leasing company");
      setSuccess("Leasing company updated");
      setEditingCompanyId(null);
      setEditingCompanyName("");
      await loadCompanies();
      if (selectedCompany?.id === companyId) {
        const refreshed = companies.find((company) => company.id === companyId);
        if (refreshed) {
          await loadApplications({ ...refreshed, name: editingCompanyName.trim() });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update leasing company");
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async (company: LeasingCompany) => {
    const confirmed = window.confirm(`Delete leasing company ${company.name}?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${base}/leasing-companies/${company.id}`, {
        method: "DELETE",
        headers: auth,
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to delete leasing company");
      setSuccess("Leasing company deleted");
      if (selectedCompany?.id === company.id) {
        setSelectedCompany(null);
        setApplications([]);
      }
      await loadCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete leasing company");
    } finally {
      setSaving(false);
    }
  };

  const openSettleModal = (entry: LeasingApplication) => {
    const remaining = Number(entry.remainingAmount ?? 0);
    setSettleTarget(entry);
    setSettleAmount(remaining > 0 ? String(remaining) : "");
    setSettleError(null);
    setSettlePaymentMethod("CASH");
    setSettleChequeNo("");
    setSettleChequeBank("");
    setSettleChequeDate("");
  };

  const closeSettleModal = () => {
    setSettleTarget(null);
    setSettleAmount("");
    setSettleError(null);
    setSettleSaving(false);
    setSettlePaymentMethod("CASH");
    setSettleChequeNo("");
    setSettleChequeBank("");
    setSettleChequeDate("");
  };

  const submitSettle = async (event: FormEvent) => {
    event.preventDefault();
    if (!settleTarget || !selectedCompany) return;

    const remaining = Number(settleTarget.remainingAmount ?? 0);
    const amount = Number(settleAmount || "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      setSettleError("Please enter a valid settle amount");
      return;
    }
    if (amount > remaining) {
      setSettleError(`Settle amount cannot exceed remaining amount (Rs. ${remaining.toLocaleString()})`);
      return;
    }

    setSettleSaving(true);
    setSettleError(null);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${base}/${settleTarget.customer.id}/purchases/${settleTarget.id}/settle`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethod: settlePaymentMethod,
          chequeNo: settlePaymentMethod === "CHEQUE" ? settleChequeNo || undefined : undefined,
          chequeBank: settlePaymentMethod === "CHEQUE" ? settleChequeBank || undefined : undefined,
          chequeDate: settlePaymentMethod === "CHEQUE" ? settleChequeDate || undefined : undefined,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to settle leasing amount");

      setSuccess("Leasing amount settled successfully");
      await loadApplications(selectedCompany);
      closeSettleModal();
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "Failed to settle leasing amount");
    } finally {
      setSettleSaving(false);
    }
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconLeasing /></div>
          <div>
            <h2 className="page-title">Wholesale Accounts</h2>
            <p className="page-subtitle">Manage trade accounts and review wholesale purchase applications.</p>
          </div>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {success && <div className="bm-alert bm-alert-success">{success}</div>}

      <div className="bm-stats-grid" style={{ marginBottom: "1rem" }}>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconLeasing /></span><span className="bm-stat-label">Leasing Partners</span></div>
          <strong className="bm-stat-value">{companies.length}</strong>
          <span className="bm-stat-sub">Total companies in leasing list</span>
        </div>

        <div className="bm-stat-card">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconLeasing /></span><span className="bm-stat-label">Applications</span></div>
          <strong className="bm-stat-value">{totalApplications}</strong>
          <span className="bm-stat-sub">{selectedCompany ? `${selectedCompany.name} applications` : "Select a company to load data"}</span>
        </div>

        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconLeasing /></span><span className="bm-stat-label">Leasing Amount</span></div>
          <strong className="bm-stat-value">Rs. {totalLeasingAmount.toLocaleString()}</strong>
          <span className="bm-stat-sub">Total financed amount for loaded records</span>
        </div>

        <div className="bm-stat-card">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconLeasing /></span><span className="bm-stat-label">Outstanding</span></div>
          <strong className="bm-stat-value">Rs. {totalOutstandingAmount.toLocaleString()}</strong>
          <span className="bm-stat-sub">Settled {settledApplications} of {totalApplications}</span>
        </div>
      </div>

      <div className="bm-table-card" style={{ marginBottom: "1rem" }}>
        <form onSubmit={submitCreate} style={{ padding: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <input
            className="bm-input"
            style={{ minWidth: 280 }}
            placeholder="Leasing company name"
            value={newCompanyName}
            onChange={(event) => setNewCompanyName(event.target.value)}
          />
          <input className="bm-input" style={{ minWidth: 240 }} type="search" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search wholesale accounts" />
          <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving..." : "Add Company"}</button>
          <button type="button" className="btn-outline" onClick={() => void loadCompanies()} disabled={saving}>Refresh</button>
        </form>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={3} className="bm-table-empty">Loading wholesale accounts...</td></tr>}
              {!loading && companies.length === 0 && <tr><td colSpan={3} className="bm-table-empty">No wholesale accounts added yet.</td></tr>}
              {!loading && pagedCompanies.map((company) => (
                <tr key={company.id}>
                  <td>
                    {editingCompanyId === company.id ? (
                      <input className="bm-input" value={editingCompanyName} onChange={(event) => setEditingCompanyName(event.target.value)} />
                    ) : (
                      company.name
                    )}
                  </td>
                  <td>{new Date(company.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="btn-outline" onClick={() => void loadApplications(company)}>View Leasing</button>
                      {editingCompanyId === company.id ? (
                        <>
                          <button type="button" className="btn-accent" onClick={() => void submitUpdate(company.id)} disabled={saving}>Save</button>
                          <button type="button" className="btn-outline" onClick={() => { setEditingCompanyId(null); setEditingCompanyName(""); }}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" className="btn-outline" onClick={() => { setEditingCompanyId(company.id); setEditingCompanyName(company.name); }}>Update</button>
                      )}
                      <button type="button" className="bm-btn-danger" onClick={() => void deleteCompany(company)} disabled={saving}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={companyPage} pageSize={pageSize} total={filteredCompanies.length} onPageChange={setCompanyPage} onPageSizeChange={setPageSize} />
      </div>

      <div className="bm-table-card">
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)" }}>
          <h3 className="users-section-title" style={{ margin: 0 }}>
            {selectedCompany ? `${selectedCompany.name} - Leasing Applications` : "Leasing Applications"}
          </h3>
        </div>

        {applicationsError && <div className="bm-alert bm-alert-error" style={{ margin: "1rem" }}>{applicationsError}</div>}

        <div className="data-table-wrap">
          <table className="data-table users-orders-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Mode</th>
                <th>Final Price</th>
                <th>Downpayment</th>
                <th>Leasing Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!selectedCompany && <tr><td colSpan={10} className="bm-table-empty">Select a leasing company to view applications.</td></tr>}
              {selectedCompany && applicationsLoading && <tr><td colSpan={10} className="bm-table-empty">Loading applications...</td></tr>}
              {selectedCompany && !applicationsLoading && applications.length === 0 && <tr><td colSpan={10} className="bm-table-empty">No leasing applications found.</td></tr>}
              {selectedCompany && !applicationsLoading && pagedApplications.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.purchasedAt).toLocaleString()}</td>
                  <td>{entry.invoiceGroupCode || `INV-${String(entry.id).padStart(5, "0")}`}</td>
                  <td>
                    <div>{entry.customer.firstName} {entry.customer.lastName}</div>
                    <span className="users-muted">{entry.customer.nic} | {entry.customer.mobileNumber}</span>
                  </td>
                  <td>{entry.bike ? `${entry.bike.displayId} | ${entry.bike.brand} ${entry.bike.model} (${entry.bike.colour})` : "-"}</td>
                  <td>{entry.purchaseMode === "BULK" ? "Bulk" : "Single"}</td>
                  <td>Rs. {entry.finalSellingPrice.toLocaleString()}</td>
                  <td>Rs. {(entry.downPaymentAmount ?? entry.leasingDownPaymentAmount ?? 0).toLocaleString()}</td>
                  <td>Rs. {(entry.leasingFinancedAmount ?? 0).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${(entry.remainingAmount ?? 0) > 0 ? "badge-pending" : "badge-active"}`}>
                      {(entry.remainingAmount ?? 0) > 0
                        ? `To Settle Rs. ${(entry.remainingAmount ?? 0).toLocaleString()}`
                        : "Settled"}
                    </span>
                  </td>
                  <td>
                    {(entry.remainingAmount ?? 0) > 0 ? (
                      <button type="button" className="btn-accent" onClick={() => openSettleModal(entry)}>Settle</button>
                    ) : (
                      <span className="users-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={applicationPage} pageSize={pageSize} total={applications.length} onPageChange={setApplicationPage} onPageSizeChange={setPageSize} />
      </div>

      {settleTarget && (
        <div className="bm-modal-backdrop" onClick={closeSettleModal}>
          <form className="bm-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitSettle}>
            <button type="button" className="bm-modal-close" onClick={closeSettleModal}>x</button>
            <h3 className="bm-modal-title">Settle Leasing Amount</h3>
            {settleError && <div className="bm-alert bm-alert-error">{settleError}</div>}

            <div className="users-view-grid" style={{ marginBottom: "1rem" }}>
              <div><strong>Invoice:</strong> {settleTarget.invoiceGroupCode || `INV-${String(settleTarget.id).padStart(5, "0")}`}</div>
              <div><strong>Customer:</strong> {settleTarget.customer.firstName} {settleTarget.customer.lastName}</div>
              <div><strong>Remaining:</strong> Rs. {(settleTarget.remainingAmount ?? 0).toLocaleString()}</div>
              <div><strong>Leasing Amount:</strong> Rs. {(settleTarget.leasingFinancedAmount ?? 0).toLocaleString()}</div>
            </div>

            <div className="bm-field-group">
              <label>Settle Amount</label>
              <input
                className="bm-input"
                type="number"
                min={0.01}
                step="0.01"
                value={settleAmount}
                onChange={(event) => setSettleAmount(event.target.value)}
                required
              />
            </div>

            <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", border: "1px solid var(--panel-border)", borderRadius: "var(--radius-sm)", background: "var(--panel-bg)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.65rem", color: "var(--accent)" }}>How is this being paid?</div>
              <div className="bm-field-group">
                <label>Payment Method</label>
                <div style={{ display: "flex", gap: 20 }}>
                  {(["CASH", "CHEQUE", "BANK_TRANSFER"] as const).map((m) => (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                      <input type="radio" checked={settlePaymentMethod === m} onChange={() => setSettlePaymentMethod(m)} style={{ accentColor: "var(--accent)" }} />
                      {m === "BANK_TRANSFER" ? "Bank Transfer" : m}
                    </label>
                  ))}
                </div>
              </div>
              {settlePaymentMethod === "CHEQUE" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="bm-field-group">
                    <label>Cheque No *</label>
                    <input className="bm-input" value={settleChequeNo} onChange={(e) => setSettleChequeNo(e.target.value)} placeholder="e.g. 001234" />
                  </div>
                  <div className="bm-field-group">
                    <label>Bank</label>
                    <input className="bm-input" value={settleChequeBank} onChange={(e) => setSettleChequeBank(e.target.value)} placeholder="e.g. HNB" />
                  </div>
                  <div className="bm-field-group">
                    <label>Cheque Date</label>
                    <input type="date" className="bm-input" value={settleChequeDate} onChange={(e) => setSettleChequeDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn-accent" disabled={settleSaving}>{settleSaving ? "Saving..." : "Settle"}</button>
              <button type="button" className="btn-outline" onClick={closeSettleModal}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
