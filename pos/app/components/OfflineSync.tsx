"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "./AdminContext";
import { loadOfflineBills, onOfflineBillsChange, uploadOfflineBills, type OfflineBill } from "../lib/offlineSales";

const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Bills sold while the till was offline: shows how many are waiting, and uploads them as soon as
 * the connection is back (checked every 15 seconds, and whenever the browser says it's online).
 */
export function OfflineSync() {
  const { admin, token } = useAdmin();
  const [bills, setBills] = useState<OfflineBill[]>([]);
  const [uploading, setUploading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setBills(loadOfflineBills());
    refresh();
    return onOfflineBillsChange(refresh);
  }, []);

  const mine = bills.filter((bill) => bill.adminId === admin.id);
  const others = bills.filter((bill) => bill.adminId !== admin.id);
  const problems = mine.filter((bill) => bill.problem);

  const upload = useCallback(async () => {
    if (!loadOfflineBills().some((bill) => bill.adminId === admin.id)) return;
    setUploading(true);
    try {
      const result = await uploadOfflineBills(token, admin.id);
      setOffline(result.stillOffline);
      if (result.saved > 0) {
        setDone(result.saved);
        window.setTimeout(() => setDone(null), 6000);
      }
    } finally {
      setUploading(false);
    }
  }, [admin.id, token]);

  useEffect(() => {
    void upload();
    const timer = window.setInterval(() => void upload(), 15000);
    const online = () => void upload();
    window.addEventListener("online", online);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); };
  }, [upload]);

  if (bills.length === 0 && done == null) return null;

  if (bills.length === 0) {
    return <div className="os-pill ok" role="status">✓ {done} offline bill{done === 1 ? "" : "s"} uploaded</div>;
  }

  const label = mine.length === 0
    ? `${others.length} offline bill${others.length === 1 ? "" : "s"} from other staff waiting`
    : uploading ? `Uploading ${mine.length} offline bill${mine.length === 1 ? "" : "s"}…`
    : problems.length ? `${problems.length} offline bill${problems.length === 1 ? "" : "s"} need${problems.length === 1 ? "s" : ""} attention`
    : `${offline ? "Offline · " : ""}${mine.length} bill${mine.length === 1 ? "" : "s"} waiting to upload`;

  return (
    <div className="os-wrap">
      {open && (
        <div className="os-panel" role="dialog" aria-label="Offline bills">
          <div className="os-panel-head">
            <strong>Bills sold offline</strong>
            <button type="button" className="po-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <p className="td-muted">Saved on this computer. They upload by themselves when the connection is back — don't clear this browser's data until they're gone from this list.</p>
          <div className="os-list">
            {[...mine, ...others].map((bill) => (
              <div key={bill.ref} className={`os-row${bill.problem ? " problem" : ""}`}>
                <div><strong>{bill.billNo}</strong><span>{time(bill.soldAt)} · {bill.cashierName} · {bill.items}</span>{bill.problem && <em>Not accepted: {bill.problem}</em>}</div>
                <b>{money(bill.total)}</b>
              </div>
            ))}
          </div>
          {others.length > 0 && <p className="td-muted">Bills from other staff upload when they sign in on this computer.</p>}
          {mine.length > 0 && <button type="button" className="btn-accent" disabled={uploading} onClick={() => void upload()}>{uploading ? "Uploading…" : "Upload now"}</button>}
        </div>
      )}
      <button type="button" className={`os-pill${problems.length ? " bad" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <i className={uploading ? "spin" : ""} /> {label}
      </button>
    </div>
  );
}
