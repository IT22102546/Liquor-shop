/**
 * Prints an 80mm thermal document (receipt, voucher, Z report) through a hidden frame.
 * Browsers ignore "auto" page height and fall back to A4/Letter (which leaves the slip in the corner
 * of a big page when saved as PDF), so the document is measured after it renders and the page is set
 * to exactly 80mm × its height. The saved PDF is named `fileName` (Chrome uses the main page's title).
 */
export function printThermal(html: string, fileName: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Laid out at slip width (off-screen) so its height can be measured accurately.
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "80mm", height: "100px", border: "0", opacity: "0" });
  frame.srcdoc = html;
  frame.onload = () => {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) return;
    const pxToMm = (px: number) => (px * 25.4) / 96;
    const heightMm = Math.ceil(pxToMm(doc.body.getBoundingClientRect().height)) + 2;
    const pageStyle = doc.createElement("style");
    pageStyle.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; } @media print { html, body { width: 80mm; height: ${heightMm}mm; margin: 0; overflow: hidden; } }`;
    doc.head.appendChild(pageStyle);
    const pageTitle = document.title;
    document.title = fileName;
    const restoreTitle = () => { document.title = pageTitle; };
    win.addEventListener("afterprint", restoreTitle, { once: true });
    win.focus();
    win.print();
    window.setTimeout(() => { restoreTitle(); frame.remove(); }, 1000);
  };
  document.body.appendChild(frame);
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

/** Shared look for all 80mm slips (receipt, voucher, Z report). */
export const THERMAL_BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { width: 80mm; padding: 5mm 4mm 6mm; font: 12px/1.35 "Helvetica Neue", Arial, sans-serif; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { margin: 0 auto; } }
  .center { text-align: center; }
  .shop { font-size: 21px; font-weight: 800; letter-spacing: 0.08em; }
  .tagline { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 1px; }
  .addr { font-size: 11px; margin-top: 4px; }
  .band { margin: 8px 0 6px; padding: 4px 0; background: #000; color: #fff; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; }
  .rule { border-top: 1px dashed #000; margin: 7px 0; }
  .rule.solid { border-top: 1.5px solid #000; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .meta .row { font-size: 11.5px; padding: 1px 0; }
  .meta .row span:first-child { color: #333; }
  .meta .row span:last-child { font-weight: 700; }
  .head { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin: 8px 0 3px; }
  .box { margin: 7px 0; padding: 6px 7px; border: 2px solid #000; border-radius: 4px; }
  .box .row { font-size: 16px; font-weight: 800; align-items: baseline; }
  .strong { font-weight: 800; }
  .small { font-size: 10.5px; color: #333; }
  .sign { display: flex; gap: 10px; margin-top: 22px; }
  .sign div { flex: 1; border-top: 1px solid #000; padding-top: 3px; font-size: 10px; text-align: center; }
  .printed { margin-top: 10px; text-align: center; font-size: 9px; color: #444; }
`;
