"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../lib/constants";
import { IconPlus, IconSearch, IconUsers } from "../../lib/icons";

export type LoyaltyMember = {
  id: number;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  loyaltyPoints: number;
  visits: number;
};

export const memberName = (member: Pick<LoyaltyMember, "firstName" | "lastName">) =>
  [member.firstName, member.lastName].filter(Boolean).join(" ");

type MemberPickerProps = {
  token: string;
  member: LoyaltyMember | null;
  onChange: (member: LoyaltyMember | null) => void;
  onAuthExpired: () => void;
};

/**
 * Counter customer selector: every sale is "Walk-in" unless a loyalty member is attached.
 * Find a member by mobile or name, or register a new one with just a name and mobile.
 */
export function MemberPicker({ token, member, onChange, onAuthExpired }: MemberPickerProps) {
  const base = `${API_URL}/api/pos/user-management`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LoyaltyMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", mobileNumber: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || creating) return;
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${base}?limit=6&search=${encodeURIComponent(term)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (response.status === 401) { onAuthExpired(); return; }
        const payload = (await response.json()) as { data?: { users?: LoyaltyMember[] } };
        setResults(payload.data?.users ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [base, creating, onAuthExpired, open, query, token]);

  const close = () => { setOpen(false); setCreating(false); setQuery(""); setResults([]); setError(null); };

  const pick = (selected: LoyaltyMember) => { onChange(selected); close(); };

  const startCreate = () => {
    const digits = query.replace(/\D/g, "");
    setForm({ firstName: digits.length >= 7 ? "" : query.trim(), lastName: "", mobileNumber: digits.length >= 7 ? query.trim() : "" });
    setCreating(true);
    setError(null);
  };

  const saveMember = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.status === 401) { onAuthExpired(); return; }
      const payload = (await response.json()) as { data?: LoyaltyMember; message?: string; errors?: Record<string, string[]> };
      if (!response.ok || !payload.data) {
        const firstFieldError = payload.errors ? Object.values(payload.errors)[0]?.[0] : undefined;
        setError(firstFieldError ?? payload.message ?? "Could not register the member");
        return;
      }
      pick(payload.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pos-member">
      {member ? (
        <div className="pos-member-selected">
          <span className="pos-member-avatar">{member.firstName.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{memberName(member)}</strong>
            <span>{member.mobileNumber} · {member.loyaltyPoints} pts</span>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove member, sell to walk-in">Walk-in</button>
        </div>
      ) : (
        <div className="pos-member-walkin">
          <span className="pos-member-avatar muted"><IconUsers /></span>
          <div>
            <strong>Walk-in customer</strong>
            <span>Add a loyalty member to give points</span>
          </div>
          <button type="button" onClick={() => { setOpen(true); window.setTimeout(() => searchRef.current?.focus(), 30); }}>
            <IconPlus /> Member
          </button>
        </div>
      )}

      {open && (
        <div className="pos-member-panel">
          {!creating ? (
            <>
              <div className="pos-search-field">
                <IconSearch />
                <input
                  ref={searchRef}
                  className="bm-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") close();
                    if (event.key === "Enter" && results.length === 1) pick(results[0]);
                  }}
                  placeholder="Mobile number or name"
                  autoComplete="off"
                />
              </div>
              <div className="pos-member-results">
                {results.map((result) => (
                  <button key={result.id} type="button" onClick={() => pick(result)}>
                    <span className="pos-member-avatar">{result.firstName.charAt(0).toUpperCase()}</span>
                    <span><strong>{memberName(result)}</strong><em>{result.mobileNumber}</em></span>
                    <span className="pos-member-points">{result.loyaltyPoints} pts</span>
                  </button>
                ))}
                {query.trim().length >= 2 && !searching && results.length === 0 && <p>No member found.</p>}
              </div>
              <div className="pos-member-actions">
                <button type="button" className="btn-outline" onClick={close}>Cancel</button>
                <button type="button" className="btn-accent" onClick={startCreate}><IconPlus /> New member</button>
              </div>
            </>
          ) : (
            <form
              className="pos-member-form"
              onSubmit={(event) => { event.preventDefault(); void saveMember(); }}
            >
              <strong>New loyalty member</strong>
              <input className="bm-input" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="First name *" autoFocus={!form.firstName} required />
              <input className="bm-input" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Last name" />
              <input className="bm-input" value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} placeholder="Mobile number *" inputMode="tel" autoFocus={Boolean(form.firstName)} required />
              {error && <div className="bm-alert bm-alert-error">{error}</div>}
              <div className="pos-member-actions">
                <button type="button" className="btn-outline" onClick={() => setCreating(false)}>Back</button>
                <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving…" : "Register & add"}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
