"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { ROLE_LABELS } from "../../lib/roles";
import type { PosAdminRole } from "../../lib/types";
import { IconActivity, IconRefresh, IconSearch } from "../../lib/icons";

type ActivityLog = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  category: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  details: LogDetails | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};
/** Plain-language details written by the backend (older entries may have none). */
type LogDetails = {
  facts?: Array<{ label: string; value: string }>;
  changes?: Array<{ label: string; before: string; after: string }>;
  items?: Array<{ name: string; quantity: number; unitPrice: string; empties: number; emptyDeduction: string; total: string }>;
};
type StaffOption = { id: number; name: string; role: PosAdminRole };

const CATEGORIES: Array<{ value: string; label: string; color: string }> = [
  { value: "", label: "All activity", color: "var(--accent)" },
  { value: "AUTH", label: "Sign-ins", color: "var(--c5)" },
  { value: "SALE", label: "Sales", color: "var(--success)" },
  { value: "STOCK", label: "Stock", color: "var(--c2)" },
  { value: "PRODUCT", label: "Products", color: "var(--c1)" },
  { value: "STAFF", label: "Staff", color: "var(--c4)" },
  { value: "ACCOUNTS", label: "Accounts", color: "var(--c6)" },
  { value: "CUSTOMER", label: "Customers", color: "var(--c3)" },
  { value: "OTHER", label: "Other", color: "var(--text-soft)" },
];
const categoryMeta = (value: string) => CATEGORIES.find((item) => item.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
const PAGE_SIZE = 50;

function relativeTime(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const os = /Windows/.test(userAgent) ? "Windows" : /Mac OS X/.test(userAgent) ? "macOS" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default function ActivityLogPage() {
  const { token, logout } = useAdmin();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [actorId, setActorId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (category) params.set("category", category);
    if (actorId) params.set("actorId", actorId);
    if (appliedSearch) params.set("search", appliedSearch);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const response = await fetch(`${API_URL}/api/pos/activity-logs?${params}`, { headers: auth, cache: "no-store" });
      if (response.status === 401) { logout(); return; }
      const payload = (await response.json()) as { data?: { logs: ActivityLog[]; pagination: { total: number } }; message?: string };
      if (!response.ok || !payload.data) throw new Error(payload.message ?? "Failed to load the activity log");
      setLogs(payload.data.logs);
      setTotal(payload.data.pagination.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load the activity log");
    } finally {
      setLoading(false);
    }
  }, [actorId, appliedSearch, auth, category, from, logout, page, to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [category, actorId, appliedSearch, from, to]);

  useEffect(() => {
    void fetch(`${API_URL}/api/pos/auth/staff`, { headers: auth, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: StaffOption[] } | null) => setStaff(json?.data ?? []))
      .catch(() => setStaff([]));
  }, [auth]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(category || actorId || appliedSearch || from || to);

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconActivity /></div>
          <div>
            <h2 className="page-title">Activity Log</h2>
            <p className="page-subtitle">Every sign-in, sale and change made in the POS — who did it and when. Entries can&apos;t be edited or deleted.</p>
          </div>
        </div>
        <button type="button" className="btn-outline" onClick={() => void load()} disabled={loading}>
          <IconRefresh size={16} /> Refresh
        </button>
      </div>

      <div className="lx-card lx-log-filters">
        <div className="lx-log-chips" role="tablist" aria-label="Filter by type">
          {CATEGORIES.map((item) => (
            <button
              key={item.value || "all"}
              type="button"
              role="tab"
              aria-selected={category === item.value}
              className={category === item.value ? "active" : ""}
              style={{ ["--chip-color" as string]: item.color }}
              onClick={() => setCategory(item.value)}
            >
              {item.value && <i />}{item.label}
            </button>
          ))}
        </div>
        <div className="lx-log-controls">
          <form
            className="pos-search-field"
            onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}
          >
            <IconSearch />
            <input className="bm-input" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => setAppliedSearch(search.trim())} placeholder="Search e.g. invoice number, product, email" aria-label="Search activity" />
          </form>
          <select className="bm-input" value={actorId} onChange={(event) => setActorId(event.target.value)} aria-label="Filter by staff member">
            <option value="">Everyone</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.name} · {ROLE_LABELS[member.role] ?? member.role}</option>)}
          </select>
          <input className="bm-input" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
          <input className="bm-input" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
          {hasFilters && (
            <button type="button" className="btn-outline" onClick={() => { setCategory(""); setActorId(""); setSearch(""); setAppliedSearch(""); setFrom(""); setTo(""); }}>Clear</button>
          )}
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="lx-card lx-log-card">
        <div className="lx-log-count">{loading ? "Loading…" : `${total.toLocaleString()} entr${total === 1 ? "y" : "ies"}`}</div>
        {loading && logs.length === 0 && (
          <div className="lx-log-list">{Array.from({ length: 6 }, (_, index) => <div key={index} className="lx-skel" style={{ height: 58 }} />)}</div>
        )}
        {!loading && logs.length === 0 && (
          <div className="lx-empty">{hasFilters ? "No activity matches these filters." : "No activity recorded yet. Sign-ins, sales and changes will appear here."}</div>
        )}
        {logs.length > 0 && (
          <div className="lx-log-list lx-stagger">
            {logs.map((log, index) => {
              const meta = categoryMeta(log.category);
              const isOpen = expanded === log.id;
              const who = log.actorName ?? log.actorEmail ?? "Unknown user";
              return (
                <div key={log.id} className={`lx-log-row${isOpen ? " open" : ""}${log.action === "auth.login_failed" || log.action.endsWith(".denied") ? " warn" : ""}`} style={{ ["--i" as string]: Math.min(index, 12), ["--chip-color" as string]: meta.color }}>
                  <button type="button" className="lx-log-main" onClick={() => setExpanded(isOpen ? null : log.id)} aria-expanded={isOpen}>
                    <span className="lx-log-avatar" aria-hidden="true">{who.charAt(0).toUpperCase()}</span>
                    <span className="lx-log-body">
                      <span className="lx-log-summary">{log.summary}</span>
                      <span className="lx-log-meta">
                        <strong>{who}</strong>
                        {log.actorRole && <> · {ROLE_LABELS[log.actorRole as PosAdminRole] ?? log.actorRole}</>}
                        <> · <span title={new Date(log.createdAt).toLocaleString()}>{relativeTime(log.createdAt)}</span></>
                      </span>
                    </span>
                    <span className="lx-log-tag">{meta.label}</span>
                    <span className="lx-log-time">{new Date(log.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                  {isOpen && (
                    <div className="lx-log-details">
                      <dl>
                        <div><dt>When</dt><dd>{new Date(log.createdAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div>
                        <div><dt>Who</dt><dd>{who}{log.actorRole ? ` · ${ROLE_LABELS[log.actorRole as PosAdminRole] ?? log.actorRole}` : ""}</dd></div>
                        <div><dt>Device</dt><dd>{deviceLabel(log.userAgent)}</dd></div>
                        {log.details?.facts?.map((item) => (
                          <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                        ))}
                      </dl>

                      {log.details?.items && log.details.items.length > 0 && (
                        <div className="lx-log-block">
                          <h4>Items sold</h4>
                          <table className="lx-log-table">
                            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Empties</th><th>Total</th></tr></thead>
                            <tbody>
                              {log.details.items.map((item, itemIndex) => (
                                <tr key={`${item.name}-${itemIndex}`}>
                                  <td>{item.name}</td>
                                  <td>{item.quantity}</td>
                                  <td>{item.unitPrice}</td>
                                  <td>{item.empties > 0 ? `${item.empties} (− ${item.emptyDeduction})` : "—"}</td>
                                  <td>{item.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {log.details?.changes && log.details.changes.length > 0 && (
                        <div className="lx-log-block">
                          <h4>What changed</h4>
                          <table className="lx-log-table lx-log-changes">
                            <thead><tr><th>Detail</th><th>Before</th><th /><th>After</th></tr></thead>
                            <tbody>
                              {log.details.changes.map((change) => (
                                <tr key={change.label}>
                                  <td>{change.label}</td>
                                  <td className="before">{change.before}</td>
                                  <td className="arrow" aria-hidden="true">→</td>
                                  <td className="after">{change.after}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="lx-log-pager">
            <button type="button" className="btn-outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Newer</button>
            <span>Page {page} of {pages}</span>
            <button type="button" className="btn-outline" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)}>Older</button>
          </div>
        )}
      </div>
    </div>
  );
}
