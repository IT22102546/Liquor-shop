"use client";

import { useEffect, useRef } from "react";

// USB/Bluetooth barcode readers behave like a keyboard that types very fast and ends with Enter.
const MAX_KEY_GAP_MS = 60;
const MIN_CODE_LENGTH = 3;

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Calls `onScan` when a barcode reader scans while no text field is focused.
 * When a field *is* focused, the scanner types into it and that field's own Enter handler
 * decides what to do, so manual typing and scanning both work everywhere.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let lastKeyAt = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
      const now = performance.now();
      const fast = now - lastKeyAt <= MAX_KEY_GAP_MS;

      if (event.key === "Enter") {
        if (fast && buffer.length >= MIN_CODE_LENGTH) {
          event.preventDefault();
          onScanRef.current(buffer);
        }
        buffer = "";
        return;
      }

      if (event.key.length !== 1) return;
      buffer = fast ? buffer + event.key : event.key;
      lastKeyAt = now;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}

/** Normalises a scanned or typed barcode for comparison. */
export function normalizeBarcode(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/** True when text looks like a barcode rather than a product name (no spaces, 4+ chars). */
export function looksLikeBarcode(value: string) {
  return /^[0-9A-Za-z-]{4,}$/.test(value.trim()) && /\d/.test(value);
}
