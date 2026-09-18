"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconAccounts } from "../../../lib/icons";
import { exportTableToPdf } from "../../../lib/pdf-export";
import { exportLedgerToExcel } from "../../../lib/excel-export";
import TablePagination, { paginateRows } from "../../../components/TablePagination";

type Account = {
  id: number;
  name: string;
  code: string;
  type: string;
  level: "MAIN" | "SUB";
};

type LedgerRow = {
  id: number;
  type: string;
  typeLabel: string;
  refNo?: string | null;
  createdById: number;
  date: string;
  description?: string | null;
  chequeNo?: string | null;
  drAmount: number;
  crAmount: number;
  balance: number;
};

type LedgerResult = {
  account: Account;
  openingBalance: number;
  rows: LedgerRow[];
  totalDr: number;
  totalCr: number;
  closingBalance: number;
};

function formatRs(v: number) {
  return v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB");
}

function firstDayOfMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatBalance(v: number): { amount: string; side: "Dr" | "Cr"; color: string } {
  if (v >= 0) return { amount: formatRs(v), side: "Dr", color: "var(--success)" };
  return { amount: formatRs(Math.abs(v)), side: "Cr", color: "var(--danger)" };
}

export default function LedgerPage() {
  const { token } = useAdmin();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number>(0);
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState<LedgerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rowSearch, setRowSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const filteredRows = useMemo(() => {
    const rows = result?.rows ?? [];
    const needle = rowSearch.trim().toLowerCase();
    return needle ? rows.filter((row) => [row.typeLabel, row.refNo, row.description, row.chequeNo].some((value) => value?.toLowerCase().includes(needle))) : rows;
  }, [result, rowSearch]);
  const pagedRows = useMemo(() => paginateRows(filteredRows, page, pageSize), [filteredRows, page, pageSize]);
  useEffect(() => { setPage(1); }, [rowSearch, pageSize, result]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/pos/accounts/chart`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setAccounts(d.data ?? []));
  }, [token]);

  async function search() {
    if (!accountId) { setError("Please select an account"); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ accountId: String(accountId), from: fromDate, to: toDate });
      const res = await fetch(`${API_URL}/api/pos/accounts/ledger?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) { setError(d.message ?? "Failed to load ledger"); return; }
      setResult(d.data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  type ExportRow = { type: string; refNo: string; date: string; description: string; chequeNo: string; dr: string; cr: string; balance: string };

  function handleExport() {
    if (!result) return;
    const ob = formatBalance(result.openingBalance);
    const cb = formatBalance(result.closingBalance);
    const exportRows: ExportRow[] = [
      {
        type: "Opening Balance",
        refNo: "—",
        date: fromDate,
        description: "—",
        chequeNo: "—",
        dr: ob.side === "Dr" ? ob.amount : "—",
        cr: ob.side === "Cr" ? ob.amount : "—",
        balance: `${ob.amount} ${ob.side}`,
      },
      ...result.rows.map((r) => {
        const rb = formatBalance(r.balance);
        return {
          type: r.typeLabel,
          refNo: r.refNo ?? "—",
          date: formatDate(r.date),
          description: r.description ?? "—",
          chequeNo: r.chequeNo ?? "—",
          dr: r.drAmount > 0 ? formatRs(r.drAmount) : "—",
          cr: r.crAmount > 0 ? formatRs(r.crAmount) : "—",
          balance: `${rb.amount} ${rb.side}`,
        };
      }),
      { type: "TOTALS", refNo: "", date: "", description: "", chequeNo: "", dr: formatRs(result.totalDr), cr: formatRs(result.totalCr), balance: `${cb.amount} ${cb.side}` },
    ];

    exportTableToPdf<ExportRow>({
      fileName: `Ledger-${result.account.code}-${fromDate}-${toDate}.pdf`,
      title: `General Ledger — ${result.account.name}`,
      subtitle: `${fromDate} to ${toDate} · Account: ${result.account.code}`,
      columns: [
        { header: "Type", value: (r) => r.type },
        { header: "Ref No", value: (r) => r.refNo },
        { header: "Date", value: (r) => r.date },
        { header: "Description", value: (r) => r.description },
        { header: "Cheque No", value: (r) => r.chequeNo },
        { header: "Dr (Rs.)", value: (r) => r.dr },
        { header: "Cr (Rs.)", value: (r) => r.cr },
        { header: "Balance (Rs.)", value: (r) => r.balance },
      ],
      rows: exportRows,
    });
  }

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <span className="page-title-icon"><IconAccounts /></span>
          <div>
            <h1 className="page-title">General Ledger</h1>
            <p className="page-subtitle">Transaction history per account with running balance</p>
          </div>
        </div>
        {result && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-outline" onClick={handleExport}>
              Export PDF
            </button>
            <button className="btn-outline" onClick={() => exportLedgerToExcel(result, fromDate, toDate)}>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="bm-filter-card">
        <div className="bm-filter-grid" style={{ gridTemplateColumns: "1fr 160px 160px auto" }}>
          <div className="bm-field-group">
            <label className="users-label">Account *</label>
            <select
              className="bm-select"
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              <option value={0}>— Select account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code}) — {a.level === "MAIN" ? "Main" : "Sub"} · {a.type}
                </option>
              ))}
            </select>
          </div>
          <div className="bm-field-group">
            <label className="users-label">From Date</label>
            <input className="bm-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="bm-field-group">
            <label className="users-label">To Date</label>
            <input className="bm-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="bm-field-group" style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-accent" onClick={search} disabled={loading} style={{ width: "100%" }}>
              {loading ? "Loading..." : "View Transactions"}
            </button>
          </div>
        </div>
        {error && <div className="bm-alert bm-alert-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {/* Ledger table */}
      {result && (
        <div className="bm-table-card">
          <div className="panel-header">
            <div>
              <div className="panel-title-row">
                <span style={{ color: "var(--accent)" }}><IconAccounts /></span>
                <h3>{result.account.name}</h3>
              </div>
              <div className="td-muted" style={{ marginTop: 2, marginLeft: 28, fontSize: "0.8rem" }}>
                {result.account.code} · {result.account.level === "MAIN" ? "Main" : "Sub"} · {result.account.type}
              </div>
            </div>
          </div>

          {/* Summary chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "0.9rem", padding: "1rem", borderBottom: "1px solid var(--panel-border)" }}>
            <div className="bm-stat-card bm-stat-card-soft">
              <div className="bm-stat-label">Opening Balance</div>
              {(() => { const ob = formatBalance(result.openingBalance); return (
                <div className="bm-stat-value" style={{ fontSize: "1.1rem", color: ob.color }}>
                  Rs. {ob.amount} <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>{ob.side}</span>
                </div>
              ); })()}
            </div>
            <div className="bm-stat-card">
              <div className="bm-stat-label">Total Received (Dr)</div>
              <div className="bm-stat-value" style={{ fontSize: "1.1rem", color: "var(--success)" }}>Rs. {formatRs(result.totalDr)}</div>
            </div>
            <div className="bm-stat-card">
              <div className="bm-stat-label">Total Paid Out (Cr)</div>
              <div className="bm-stat-value" style={{ fontSize: "1.1rem", color: "var(--danger)" }}>Rs. {formatRs(result.totalCr)}</div>
            </div>
            <div className="bm-stat-card">
              <div className="bm-stat-label">Closing Balance</div>
              {(() => { const cb = formatBalance(result.closingBalance); return (
                <div className="bm-stat-value" style={{ fontSize: "1.1rem", fontWeight: 800, color: cb.color }}>
                  Rs. {cb.amount} <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>{cb.side}</span>
                </div>
              ); })()}
            </div>
          </div>

          <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)" }}><input className="bm-input" type="search" value={rowSearch} onChange={(event) => setRowSearch(event.target.value)} placeholder="Search transaction, reference, description or cheque" /></div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Ref No</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Cheque No</th>
                  <th style={{ textAlign: "right" }}>Dr (Rs.)</th>
                  <th style={{ textAlign: "right" }}>Cr (Rs.)</th>
                  <th style={{ textAlign: "right" }}>Balance (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                {(() => { const ob = formatBalance(result.openingBalance); return (
                  <tr style={{ background: "var(--bg)", fontWeight: 600 }}>
                    <td>Opening Balance</td>
                    <td>—</td>
                    <td>{formatDate(fromDate + "T00:00:00")}</td>
                    <td>—</td>
                    <td>—</td>
                    <td style={{ textAlign: "right", color: ob.side === "Dr" ? "var(--success)" : "inherit", fontVariantNumeric: "tabular-nums" }}>
                      {ob.side === "Dr" ? ob.amount : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: ob.side === "Cr" ? "var(--danger)" : "inherit", fontVariantNumeric: "tabular-nums" }}>
                      {ob.side === "Cr" ? ob.amount : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: ob.color }}>
                      {ob.amount} <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>{ob.side}</span>
                    </td>
                  </tr>
                ); })()}
                {result.rows.length === 0 ? (
                  <tr><td colSpan={8} className="bm-table-empty">No transactions in this period</td></tr>
                ) : pagedRows.map((row) => (
                  <tr key={row.id} style={{ background: row.typeLabel === "Reversal" ? "rgba(220,38,38,0.04)" : undefined }}>
                    <td>
                      <span
                        className={`badge ${
                          row.typeLabel === "Receipt" ? "badge-active"
                          : row.typeLabel === "Deposit" ? "badge-active"
                          : row.typeLabel === "Voucher" ? "badge-review"
                          : row.typeLabel === "Transfer" ? "badge-active"
                          : "badge-pending"
                        }`}
                        style={
                          row.typeLabel === "Reversal"
                            ? { background: "var(--danger-bg)", color: "var(--danger)" }
                            : row.typeLabel === "Deposit"
                            ? { background: "var(--info-bg, #dbeafe)", color: "var(--info, #2563eb)" }
                            : row.typeLabel === "Transfer"
                            ? { background: "#ede9fe", color: "#7c3aed" }
                            : {}
                        }
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="td-muted">{row.refNo ?? "—"}</td>
                    <td className="td-muted">{formatDate(row.date)}</td>
                    <td className="td-muted">{row.description ?? "—"}</td>
                    <td className="td-muted">{row.chequeNo ?? "—"}</td>
                    <td style={{ textAlign: "right", color: row.drAmount > 0 ? "var(--success)" : "inherit", fontVariantNumeric: "tabular-nums" }}>
                      {row.drAmount > 0 ? formatRs(row.drAmount) : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: row.crAmount > 0 ? "var(--danger)" : "inherit", fontVariantNumeric: "tabular-nums" }}>
                      {row.crAmount > 0 ? formatRs(row.crAmount) : "—"}
                    </td>
                    {(() => { const rb = formatBalance(row.balance); return (
                      <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: rb.color }}>
                        {rb.amount} <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>{rb.side}</span>
                      </td>
                    ); })()}
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: "var(--bg)", fontWeight: 700, borderTop: "2px solid var(--panel-border)" }}>
                  <td colSpan={5} style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", color: "var(--text-xsoft)", textTransform: "uppercase" }}>TOTALS</td>
                  <td style={{ textAlign: "right", color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{formatRs(result.totalDr)}</td>
                  <td style={{ textAlign: "right", color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{formatRs(result.totalCr)}</td>
                  {(() => { const cb = formatBalance(result.closingBalance); return (
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: cb.color }}>
                      {cb.amount} <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>{cb.side}</span>
                    </td>
                  ); })()}
                </tr>
              </tbody>
            </table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={filteredRows.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  );
}
