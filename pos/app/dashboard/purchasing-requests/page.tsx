"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import {
  IconContactRequests,
  IconClose,
  IconActivity,
  IconInvoice,
  IconUsers,
} from "../../lib/icons";

// ──────────────────── TYPES ────────────────────────

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

// ──────────────────── HELPERS ────────────────────────

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

// ──────────────────── MAIN COMPONENT ────────────────────────

export default function ContactRequestsPage() {
  const { token } = useAdmin();

  // ── Contact requests state
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [contactStats, setContactStats] = useState<StatsData | null>(null);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilterStatus, setContactFilterStatus] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [contactTotalPages, setContactTotalPages] = useState(1);

  const [viewContactItem, setViewContactItem] = useState<ContactRequest | null>(
    null,
  );
  const [editContactNotes, setEditContactNotes] = useState("");
  const [editContactStatus, setEditContactStatus] =
    useState<ContactStatus>("new");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSaveError, setContactSaveError] = useState("");

  const [deleteContactItem, setDeleteContactItem] =
    useState<ContactRequest | null>(null);
  const [contactDeleting, setContactDeleting] = useState(false);

  // ────────────────── CONTACT REQUESTS FUNCTIONS ──────────────────

  const loadContactStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/pos/contact-requests/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setContactStats(await res.json());
    } catch {}
  }, [token]);

  const loadContactRequests = useCallback(async () => {
    if (!token) {
      setContactLoading(false);
      return;
    }
    setContactLoading(true);
    setContactError("");
    try {
      const params = new URLSearchParams({
        page: String(contactPage),
        limit: "20",
        ...(contactSearch ? { search: contactSearch } : {}),
        ...(contactFilterStatus ? { status: contactFilterStatus } : {}),
      });
      const res = await fetch(`${API_URL}/api/pos/contact-requests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load contact requests");
      const json: ListResult = await res.json();
      setRequests(json.data);
      setContactTotalPages(json.totalPages || 1);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setContactLoading(false);
    }
  }, [token, contactPage, contactSearch, contactFilterStatus]);

  useEffect(() => {
    loadContactStats();
    loadContactRequests();
  }, [loadContactStats, loadContactRequests]);

  function openViewContact(item: ContactRequest) {
    setViewContactItem(item);
    setEditContactNotes(item.notes ?? "");
    setEditContactStatus(item.status);
    setContactSaveError("");
  }

  async function handleContactSave() {
    if (!viewContactItem) return;
    setContactSaving(true);
    setContactSaveError("");
    try {
      const res = await fetch(
        `${API_URL}/api/pos/contact-requests/${viewContactItem.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: editContactStatus,
            notes: editContactNotes,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      const updated: ContactRequest = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      setViewContactItem(null);
      loadContactStats();
    } catch (err) {
      setContactSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setContactSaving(false);
    }
  }

  async function handleContactQuickStatus(
    item: ContactRequest,
    status: ContactStatus,
  ) {
    try {
      const res = await fetch(
        `${API_URL}/api/pos/contact-requests/${item.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      const updated: ContactRequest = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      loadContactStats();
    } catch {}
  }

  async function handleContactDelete() {
    if (!deleteContactItem) return;
    setContactDeleting(true);
    try {
      await fetch(
        `${API_URL}/api/pos/contact-requests/${deleteContactItem.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setRequests((prev) => prev.filter((r) => r.id !== deleteContactItem.id));
      setDeleteContactItem(null);
      loadContactStats();
    } catch {}
    setContactDeleting(false);
  }

  return (
    <div className="bm-page">
      {/* Header */}
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon">
            <IconContactRequests />
          </div>
          <div>
            <h2 className="page-title">Contact Requests</h2>
            <p className="page-subtitle">
              Manage enquiries from the website contact form
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {contactStats && (
        <div className="bm-stats-grid">
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-icon">
                <IconContactRequests />
              </span>
              <span className="bm-stat-label">Total</span>
            </div>
            <div className="bm-stat-value">{contactStats.total}</div>
            <span className="bm-stat-sub">All enquiries</span>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-icon">
                <IconActivity />
              </span>
              <span className="bm-stat-label">New</span>
            </div>
            <div
              className="bm-stat-value"
              style={{ color: "var(--accent)" }}
            >
              {contactStats.new}
            </div>
            <span className="bm-stat-sub">Need follow-up</span>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-icon">
                <IconUsers />
              </span>
              <span className="bm-stat-label">Contacted</span>
            </div>
            <div
              className="bm-stat-value"
              style={{ color: "var(--success)" }}
            >
              {contactStats.contacted}
            </div>
            <span className="bm-stat-sub">In progress</span>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-head">
              <span className="bm-stat-icon">
                <IconInvoice />
              </span>
              <span className="bm-stat-label">Closed</span>
            </div>
            <div className="bm-stat-value">{contactStats.closed}</div>
            <span className="bm-stat-sub">Resolved items</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bm-table-card">
        <div className="filter-bar">
          <input
            className="bm-input"
            placeholder="Search name, email, phone, ID…"
            value={contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value);
              setContactPage(1);
            }}
          />
          <select
            className="bm-input"
            value={contactFilterStatus}
            onChange={(e) => {
              setContactFilterStatus(e.target.value);
              setContactPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
          <button
            className="btn-outline"
            onClick={() => {
              setContactSearch("");
              setContactFilterStatus("");
              setContactPage(1);
            }}
          >
            Reset
          </button>
        </div>

        {contactError && (
          <div className="bm-alert bm-alert-error">{contactError}</div>
        )}

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
              {contactLoading ? (
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
                      <span className="display-id">{item.displayId}</span>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.email}</td>
                    <td>{item.phone || "—"}</td>
                    <td>{item.city || "—"}</td>
                    <td className="interests-cell">
                      {item.interests || "—"}
                    </td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="bm-actions">
                        <button
                          type="button"
                          className="bm-action-btn bm-view-btn"
                          onClick={() => openViewContact(item)}
                        >
                          View
                        </button>
                        {item.status === "new" && (
                          <button
                            type="button"
                            className="bm-action-btn bm-edit-btn"
                            onClick={() =>
                              handleContactQuickStatus(item, "contacted")
                            }
                          >
                            Contacted
                          </button>
                        )}
                        {item.status !== "closed" && (
                          <button
                            type="button"
                            className="bm-action-btn"
                            onClick={() =>
                              handleContactQuickStatus(item, "closed")
                            }
                          >
                            Close
                          </button>
                        )}
                        <button
                          type="button"
                          className="bm-action-btn delete"
                          onClick={() => setDeleteContactItem(item)}
                        >
                          Delete
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
        {contactTotalPages > 1 && (
          <div className="pagination">
            <button
              className="btn-outline"
              disabled={contactPage === 1}
              onClick={() => setContactPage(contactPage - 1)}
            >
              ← Prev
            </button>
            <span>
              Page {contactPage} of {contactTotalPages}
            </span>
            <button
              className="btn-outline"
              disabled={contactPage === contactTotalPages}
              onClick={() => setContactPage(contactPage + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Contact View Modal */}
      {viewContactItem && (
        <div
          className="bm-modal-overlay"
          onClick={() => setViewContactItem(null)}
        >
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bm-modal-header">
              <h3>{viewContactItem.name}</h3>
              <button
                type="button"
                className="bm-close-btn"
                onClick={() => setViewContactItem(null)}
              >
                <IconClose />
              </button>
            </div>
            <div className="bm-modal-body">
              <div className="details-grid">
                <div>
                  <label>Email</label>
                  <p>{viewContactItem.email}</p>
                </div>
                <div>
                  <label>Phone</label>
                  <p>{viewContactItem.phone || "—"}</p>
                </div>
                <div>
                  <label>City</label>
                  <p>{viewContactItem.city || "—"}</p>
                </div>
                <div>
                  <label>Status</label>
                  <select
                    className="bm-input"
                    value={editContactStatus}
                    onChange={(e) =>
                      setEditContactStatus(e.target.value as ContactStatus)
                    }
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              {viewContactItem.interests && (
                <div className="description-section">
                  <label>Interests</label>
                  <p>{viewContactItem.interests}</p>
                </div>
              )}
              {viewContactItem.message && (
                <div className="description-section">
                  <label>Message</label>
                  <p>{viewContactItem.message}</p>
                </div>
              )}
              <div className="description-section">
                <label>Notes</label>
                <textarea
                  className="bm-input"
                  rows={3}
                  value={editContactNotes}
                  onChange={(e) => setEditContactNotes(e.target.value)}
                  placeholder="Add internal notes..."
                />
              </div>
              {contactSaveError && (
                <div className="bm-alert bm-alert-error">
                  {contactSaveError}
                </div>
              )}
            </div>
            <div className="bm-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setViewContactItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-accent"
                onClick={handleContactSave}
                disabled={contactSaving}
              >
                {contactSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Delete Confirmation */}
      {deleteContactItem && (
        <div
          className="bm-modal-overlay"
          onClick={() => setDeleteContactItem(null)}
        >
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bm-modal-header">
              <h3>Delete Contact Request?</h3>
              <button
                type="button"
                className="bm-close-btn"
                onClick={() => setDeleteContactItem(null)}
              >
                <IconClose />
              </button>
            </div>
            <div className="bm-modal-body">
              <p>
                Are you sure you want to delete the request from{" "}
                <strong>{deleteContactItem.name}</strong>? This action
                cannot be undone.
              </p>
            </div>
            <div className="bm-modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setDeleteContactItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleContactDelete}
                disabled={contactDeleting}
              >
                {contactDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .bm-page {
          --bg-card: var(--panel);
          --border-color: var(--panel-border);
          --text-primary: var(--text);
          --text-secondary: var(--text-soft);
          --bg-secondary: var(--bg-soft);
          --accent-rgb: 201, 168, 76;
          --success-rgb: 5, 150, 105;
        }
        .bm-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(14, 16, 25, 0.58);
          backdrop-filter: blur(3px);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .bm-modal {
          width: min(720px, 96vw);
          max-height: calc(100vh - 2rem);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: var(--panel);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32);
          animation: modal-pop 0.2s ease-out;
        }
        .bm-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.15rem;
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--panel);
        }
        .bm-modal-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .bm-close-btn {
          width: 2rem;
          height: 2rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .bm-close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }
        .bm-modal-body {
          padding: 1rem 1.15rem;
          overflow: auto;
          max-height: calc(100vh - 12rem);
          background: var(--panel);
        }
        .bm-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.65rem;
          padding: 1rem 1.15rem;
          border-top: 1px solid var(--border-color);
          background: var(--bg-soft);
        }
        @keyframes modal-pop {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .filter-bar {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          flex-wrap: wrap;
        }
        .filter-bar .bm-input {
          flex: 1;
          min-width: 200px;
        }
        .pagination {
          padding: 1rem;
          text-align: center;
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          align-items: center;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .description-section {
          margin-top: 1rem;
        }
        .description-section label {
          font-weight: 600;
          margin-bottom: 0.5rem;
          display: block;
        }
        .interests-cell {
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .display-id {
          font-family: monospace;
          font-size: 0.78rem;
        }
        .bm-actions {
          display: flex;
          gap: 0.5rem;
        }
        .bm-action-btn.delete {
          color: var(--danger);
        }
        @media (max-width: 900px) {
          .details-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
