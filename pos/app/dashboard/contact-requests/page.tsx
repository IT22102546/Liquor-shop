"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";

// ── Types ───────────────────────────────────────────────────────────────────

type ContactStatus = "new" | "contacted" | "closed";

interface ContactRequest {
  id: number;
  displayId: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  interests: string;
  message: string | null;
  status: ContactStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StatsData {
  total: number;
  new: number;
  contacted: number;
  closed: number;
}

interface ListResult {
  data: ContactRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status: ContactStatus) {
  if (status === "new") return "badge badge-new";
  if (status === "contacted") return "badge badge-contacted";
  return "badge badge-closed";
}

function statusLabel(status: ContactStatus) {
  if (status === "new") return "New";
  if (status === "contacted") return "Contacted";
  return "Closed";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ContactRequestsPage() {
  const { token } = useAdmin();

  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View/Edit modal
  const [viewItem, setViewItem] = useState<ContactRequest | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<ContactStatus>("new");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Delete confirm
  const [deleteItem, setDeleteItem] = useState<ContactRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/pos/contact-requests/stats`, {
        headers: authHeader,
      });
      if (res.ok) setStats(await res.json());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      });
      const res = await fetch(`${API_URL}/api/pos/contact-requests?${params}`, {
        headers: authHeader,
      });
      if (!res.ok) throw new Error("Failed to load contact requests");
      const json: ListResult = await res.json();
      setRequests(json.data);
      setTotalPages(json.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, search, filterStatus]);

  useEffect(() => {
    loadStats();
    loadRequests();
  }, [loadStats, loadRequests]);

  function openView(item: ContactRequest) {
    setViewItem(item);
    setEditNotes(item.notes ?? "");
    setEditStatus(item.status);
    setSaveError("");
  }

  async function handleSave() {
    if (!viewItem) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(
        `${API_URL}/api/pos/contact-requests/${viewItem.id}`,
        {
          method: "PATCH",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ status: editStatus, notes: editNotes }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      const updated: ContactRequest = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setViewItem(null);
      loadStats();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatus(
    item: ContactRequest,
    status: ContactStatus,
  ) {
    try {
      const res = await fetch(
        `${API_URL}/api/pos/contact-requests/${item.id}`,
        {
          method: "PATCH",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      const updated: ContactRequest = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      loadStats();
    } catch {}
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await fetch(`${API_URL}/api/pos/contact-requests/${deleteItem.id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      setRequests((prev) => prev.filter((r) => r.id !== deleteItem.id));
      setDeleteItem(null);
      loadStats();
    } catch {}
    setDeleting(false);
  }

  return (
    <div className="bm-page">
      {/* Header */}
      <div className="bm-page-header">
        <div className="page-title-row">
          <span className="page-title-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <div>
            <h1 className="page-title">Contact Requests</h1>
            <p className="page-subtitle">
              Manage enquiries from the website contact form
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bm-stats-grid">
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-label">Total</span>
            </div>
            <div className="bm-stat-value">{stats.total}</div>
          </div>
          <div className="bm-stat-card bm-stat-card-soft">
            <div className="bm-stat-head">
              <span className="bm-stat-label">New</span>
            </div>
            <div className="bm-stat-value" style={{ color: "var(--accent)" }}>
              {stats.new}
            </div>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-label">Contacted</span>
            </div>
            <div className="bm-stat-value" style={{ color: "var(--success)" }}>
              {stats.contacted}
            </div>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-label">Closed</span>
            </div>
            <div className="bm-stat-value">{stats.closed}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bm-table-card">
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            padding: "1rem",
            flexWrap: "wrap",
          }}
        >
          <input
            className="bm-input"
            placeholder="Search name, email, phone, ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ flex: 1, minWidth: "200px" }}
          />
          <select
            className="bm-input"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: "140px" }}
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
          <button
            className="btn-outline"
            onClick={() => {
              setSearch("");
              setFilterStatus("");
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>

        {error && <div className="bm-alert bm-alert-error">{error}</div>}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City</th>
                <th>Interests</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="bm-table-empty">
                    Loading…
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="bm-table-empty">
                    No contact requests found.
                  </td>
                </tr>
              ) : (
                requests.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span
                        style={{ fontFamily: "monospace", fontSize: "0.78rem" }}
                      >
                        {item.displayId}
                      </span>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{item.email}</td>
                    <td style={{ fontSize: "0.82rem" }}>{item.phone || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{item.city || "—"}</td>
                    <td
                      style={{
                        fontSize: "0.78rem",
                        maxWidth: "140px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.interests || "—"}
                    </td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      {formatDate(item.createdAt)}
                    </td>
                    <td>
                      <div className="bm-actions">
                        <button
                          type="button"
                          className="bm-action-btn bm-view-btn"
                          title="View & Edit"
                          onClick={() => openView(item)}
                        >
                          View
                        </button>
                        {item.status === "new" && (
                          <button
                            type="button"
                            className="bm-action-btn bm-edit-btn"
                            title="Mark as Contacted"
                            onClick={() => handleQuickStatus(item, "contacted")}
                          >
                            Contacted
                          </button>
                        )}
                        {item.status !== "closed" && (
                          <button
                            type="button"
                            className="bm-action-btn"
                            title="Mark as Closed"
                            style={{
                              background: "rgba(100,100,120,0.1)",
                              color: "var(--text-muted)",
                            }}
                            onClick={() => handleQuickStatus(item, "closed")}
                          >
                            Close
                          </button>
                        )}
                        <button
                          type="button"
                          className="bm-action-btn bm-del-btn"
                          title="Delete"
                          onClick={() => setDeleteItem(item)}
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              padding: "1rem",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <button
              className="btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Page {page} / {totalPages}
            </span>
            <button
              className="btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── View / Edit Modal ── */}
      {viewItem && (
        <div className="bm-modal-backdrop" onClick={() => setViewItem(null)}>
          <div
            className="bm-modal bm-view-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {viewItem.displayId}
                </span>
                <h2 className="bm-modal-title" style={{ marginTop: "0.25rem" }}>
                  {viewItem.name}
                </h2>
              </div>
              <button
                className="bm-modal-close"
                onClick={() => setViewItem(null)}
              >
                &times;
              </button>
            </div>

            <div
              className="bm-modal-body"
              style={{ display: "grid", gap: "0.75rem" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Email
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>{viewItem.email}</div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Phone
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    {viewItem.phone || "—"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    City
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    {viewItem.city || "—"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Date
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    {formatDate(viewItem.createdAt)}
                  </div>
                </div>
              </div>

              {viewItem.interests && (
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Interests
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>{viewItem.interests}</div>
                </div>
              )}

              {viewItem.message && (
                <div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Message
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {viewItem.message}
                  </div>
                </div>
              )}

              <hr
                style={{ borderColor: "var(--border)", margin: "0.25rem 0" }}
              />

              <div className="bm-field-group">
                <label
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  Status
                </label>
                <select
                  className="bm-input"
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as ContactStatus)
                  }
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="bm-field-group">
                <label
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  Internal Notes
                </label>
                <textarea
                  className="bm-input"
                  rows={3}
                  placeholder="Add notes visible only to staff…"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              {saveError && (
                <div className="bm-alert bm-alert-error">{saveError}</div>
              )}
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1.25rem" }}>
              <button className="btn-outline" onClick={() => setViewItem(null)}>
                Cancel
              </button>
              <button
                className="btn-accent"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteItem && (
        <div className="bm-modal-backdrop" onClick={() => setDeleteItem(null)}>
          <div
            className="bm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px" }}
          >
            <button
              className="bm-modal-close"
              onClick={() => setDeleteItem(null)}
            >
              &times;
            </button>
            <h2 className="bm-modal-title">Delete Request?</h2>
            <p
              style={{
                margin: "0.75rem 0 1.25rem",
                color: "var(--text-muted)",
                fontSize: "0.9rem",
              }}
            >
              Permanently delete contact request{" "}
              <strong>{deleteItem.displayId}</strong> from{" "}
              <strong>{deleteItem.name}</strong>? This cannot be undone.
            </p>
            <div className="bm-modal-actions">
              <button
                className="btn-outline"
                onClick={() => setDeleteItem(null)}
              >
                Cancel
              </button>
              <button
                className="bm-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
