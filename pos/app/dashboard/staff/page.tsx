"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconUsers } from "../../lib/icons";
import { ROLE_LABELS } from "../../lib/roles";
import type { PosAdminRole } from "../../lib/types";

type StaffAccount = {
  id: number;
  name: string;
  email: string;
  role: PosAdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
};

const ROLES: PosAdminRole[] = ["CASHIER", "INVENTORY_MANAGER", "ACCOUNTANT", "ADMIN"];

export default function StaffPage() {
  const { admin, token, logout } = useAdmin();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PosAdminRole>("CASHIER");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const auth = { Authorization: `Bearer ${token}` };

  const loadStaff = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/pos/auth/staff`, { headers: auth, cache: "no-store" });
    if (response.status === 401) return logout();
    const payload = await response.json() as { data?: StaffAccount[]; message?: string };
    if (!response.ok) throw new Error(payload.message ?? "Unable to load staff accounts");
    setStaff(payload.data ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadStaff().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load staff accounts"));
  }, [loadStaff]);

  const createStaff = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/auth/staff`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to create staff account");
      setName(""); setEmail(""); setPassword(""); setRole("CASHIER");
      setMessage("Staff account created. They can sign in immediately.");
      await loadStaff();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create staff account");
    } finally {
      setSaving(false);
    }
  };

  const updateStaff = async (account: StaffAccount, changes: Partial<StaffAccount>) => {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/pos/auth/staff/${account.id}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to update staff account");
      setMessage("Staff access updated.");
      await loadStaff();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update staff account");
    }
  };

  return (
    <div className="bm-page">
      <div className="page-title-row">
        <div className="page-title-icon"><IconUsers /></div>
        <div>
          <h2 className="page-title">Staff & Role Management</h2>
          <p className="page-subtitle">Give each employee only the tools needed for their job.</p>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}
      {message && <div className="bm-alert bm-alert-success">{message}</div>}

      <div className="bm-manage-grid">
        <form className="bm-manage-col" onSubmit={createStaff}>
          <div className="bm-col-header"><span className="bm-col-title">Add staff account</span></div>
          <div className="bm-field-group"><label>Full name</label><input className="bm-input" value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div className="bm-field-group"><label>Email</label><input className="bm-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="bm-field-group"><label>Temporary password</label><input className="bm-input" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          <div className="bm-field-group"><label>Job role</label><select className="bm-select" value={role} onChange={(event) => setRole(event.target.value as PosAdminRole)}>{ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create staff account"}</button>
        </form>

        <div className="bm-manage-col">
          <div className="bm-col-header"><span className="bm-col-title">Current staff</span><span className="bm-col-count">{staff.length}</span></div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Access</th></tr></thead>
              <tbody>{staff.map((account) => (
                <tr key={account.id}>
                  <td><strong>{account.name}</strong><br /><small>{account.email}</small></td>
                  <td><select className="bm-select bm-input-sm" value={account.role} disabled={account.id === admin.id} onChange={(event) => void updateStaff(account, { role: event.target.value as PosAdminRole })}>{ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></td>
                  <td><span className={`badge ${account.isActive ? "badge-success" : "badge-warning"}`}>{account.isActive ? "Active" : "Disabled"}</span></td>
                  <td><button type="button" className="btn-outline" disabled={account.id === admin.id} onClick={() => void updateStaff(account, { isActive: !account.isActive })}>{account.isActive ? "Disable" : "Enable"}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
