"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "../../lib/constants";
import {
  connectSerialPort,
  connectUsbPrinter,
  drawerSupport,
  kickDrawer,
  loadDrawerSetup,
  saveDrawerSetup,
  type DrawerMode,
  type DrawerSetup,
} from "../../lib/cashDrawer";

type CashDrawerModalProps = {
  token: string;
  staffName: string;
  branchName?: string;
  onClose: () => void;
  /** Called after the opening is recorded; `warning` is set when the drawer itself didn't open. */
  onOpened: (result: { openNo: string; warning?: string }) => void;
};

const REASONS = ["Give change (break a note)", "Check the cash", "Wrong change given", "Testing the drawer"];

const MODES: Array<{ mode: DrawerMode; title: string; text: string }> = [
  { mode: "usb", title: "USB receipt printer", text: "The drawer cable plugs into the receipt printer, and the printer's USB cable into this computer. Chrome or Edge sends the open signal straight to the printer." },
  { mode: "print", title: "Printer opens it when printing", text: "Turn on “Open cash drawer” in the printer's own driver settings. The drawer then opens with every receipt; “Open drawer” prints a small NO SALE slip. Works with any printer, including network printers." },
  { mode: "serial", title: "COM port", text: "A serial printer, or a drawer with its own USB cable that shows as a COM port." },
  { mode: "off", title: "No drawer on this computer", text: "Openings are still recorded; the drawer is opened with its key." },
];

/** "Open drawer" (no sale) with a reason, and this computer's drawer setup. */
export function CashDrawerModal({ token, staffName, branchName, onClose, onOpened }: CashDrawerModalProps) {
  const [setup, setSetup] = useState<DrawerSetup>(() => loadDrawerSetup());
  const [view, setView] = useState<"open" | "setup">(() => (loadDrawerSetup().mode === "off" ? "setup" : "open"));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = drawerSupport();

  const chooseMode = async (mode: DrawerMode) => {
    setError(null);
    try {
      // USB and COM ports need the browser's permission once per computer, from a click.
      const next = mode === "usb" ? await connectUsbPrinter() : mode === "serial" ? await connectSerialPort() : { mode };
      saveDrawerSetup(next);
      setSetup(next);
    } catch (connectError) {
      if (connectError instanceof DOMException && connectError.name === "NotFoundError") return; // closed the picker
      setError(connectError instanceof Error ? connectError.message : "Could not connect");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) { setError("Say why the drawer is being opened"); return; }
    setSaving(true);
    setError(null);
    try {
      // Recorded first: the drawer only opens once the reason is on file.
      const response = await fetch(`${API_URL}/api/pos/shifts/drawer-open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: { openNo: string }; message?: string; errors?: Record<string, string[]> } | null;
      if (!response.ok || !payload?.data) {
        setError((payload?.errors && Object.values(payload.errors)[0]?.[0]) ?? payload?.message ?? "Could not open the drawer");
        return;
      }
      const { openNo } = payload.data;
      let warning: string | undefined;
      try {
        await kickDrawer({ openNo, reason: reason.trim(), by: staffName, branch: branchName });
      } catch (kickError) {
        warning = kickError instanceof Error ? kickError.message : "The drawer didn't open";
      }
      onOpened({ openNo, warning });
    } finally {
      setSaving(false);
    }
  };

  const current = MODES.find((item) => item.mode === setup.mode)!;

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <form className="bm-modal lx-member-modal lx-entry-modal cd-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h3 className="bm-modal-title">{view === "open" ? "Open the cash drawer" : "Cash drawer setup"}</h3>
        <div className="lx-seg-plain cd-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === "open"} className={view === "open" ? "active" : ""} onClick={() => setView("open")}>Open drawer</button>
          <button type="button" role="tab" aria-selected={view === "setup"} className={view === "setup" ? "active" : ""} onClick={() => setView("setup")}>Drawer setup</button>
        </div>

        {view === "open" ? (
          <>
            <p className="lx-card-sub">For opening the drawer without a bill (“no sale”). It is recorded with your name, the time and the reason, and shows in the Day End. Cash bills open the drawer by themselves.</p>
            <div className="lx-entry-cats" role="radiogroup" aria-label="Reason">
              {REASONS.map((item) => (
                <button key={item} type="button" role="radio" aria-checked={reason === item} className={reason === item ? "active" : ""} onClick={() => setReason(item)}>{item}</button>
              ))}
            </div>
            <div className="lx-member-grid">
              <label className="wide">Reason *<input className="bm-input" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="e.g. customer needed change for Rs. 5,000" autoFocus /></label>
            </div>
            <p className="cd-status"><span className={`cd-dot ${setup.mode === "off" ? "off" : "on"}`} />This computer: <b>{current.title}</b>{setup.device ? ` · ${setup.device}` : ""}</p>
            <p className="td-muted cd-hint">Putting cash in or taking it out? Record it as <b>Money in</b> or an <b>Expense</b> in Day End, so the drawer total stays right.</p>
          </>
        ) : (
          <>
            <p className="lx-card-sub">How this computer opens the drawer. Set it once on each counter computer.</p>
            <div className="cd-modes" role="radiogroup" aria-label="Drawer connection">
              {MODES.map((item) => {
                const unsupported = (item.mode === "usb" && !support.usb) || (item.mode === "serial" && !support.serial);
                return (
                  <button key={item.mode} type="button" role="radio" aria-checked={setup.mode === item.mode} className={`cd-mode${setup.mode === item.mode ? " active" : ""}`} disabled={unsupported} onClick={() => void chooseMode(item.mode)}>
                    <strong>{item.title}{setup.mode === item.mode && setup.device ? <em> · {setup.device}</em> : null}</strong>
                    <span>{unsupported ? "Needs Google Chrome or Microsoft Edge." : item.text}</span>
                  </button>
                );
              })}
            </div>
            <p className="td-muted cd-hint">To test: go to <b>Open drawer</b> and choose “Testing the drawer”.</p>
          </>
        )}

        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        <div className="bm-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>{view === "open" ? "Cancel" : "Close"}</button>
          {view === "open"
            ? <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Opening…" : "Open drawer"}</button>
            : <button type="button" className="btn-accent" onClick={() => setView("open")}>Done</button>}
        </div>
      </form>
    </div>
  );
}
