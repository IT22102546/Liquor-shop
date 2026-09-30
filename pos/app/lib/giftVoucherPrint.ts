import { THERMAL_BASE_CSS, escapeHtml as esc, printA4, printThermal } from "./print";
import { SHOP } from "./shop";
import { code128Svg } from "./code128";

/** A gift voucher as the API returns it right after issuing (with the full code). */
export type GiftVoucherPrint = {
  voucherNo: string;
  code: string;
  amount: number;
  kind: "SOLD" | "FREE";
  expiresAt: string | null;
  issuedTo: string | null;
  issuedAt: string;
  issuedBy: string;
  issueBranch: string;
};

const rupees = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
const money = (value: number) => `Rs. ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fileNameOf = (vouchers: GiftVoucherPrint[]) => (vouchers.length === 1 ? vouchers[0].voucherNo : `${vouchers[0].voucherNo}-${vouchers[vouchers.length - 1].voucherNo}`);

/** The gift bow drawn in gold (inline SVG, prints sharp at any size). */
const BOW = `<svg class="bow" viewBox="0 0 120 80" aria-hidden="true">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a6"/><stop offset="0.5" stop-color="#d9a441"/><stop offset="1" stop-color="#a8721f"/></linearGradient></defs>
  <path d="M60 40 C40 8 8 10 10 30 C12 48 40 46 60 40Z" fill="url(#g)"/>
  <path d="M60 40 C80 8 112 10 110 30 C108 48 80 46 60 40Z" fill="url(#g)"/>
  <path d="M56 42 L40 78 L50 74 L55 80 L60 46Z" fill="url(#g)"/>
  <path d="M64 42 L80 78 L70 74 L65 80 L60 46Z" fill="url(#g)"/>
  <circle cx="60" cy="40" r="8" fill="#f6d77f" stroke="#a8721f" stroke-width="1.5"/>
</svg>`;

/**
 * Colour gift-card vouchers, printed at their real size: each page IS one voucher (190 × 86 mm),
 * edge to edge — no A4 sheet around it. Several vouchers = several voucher-sized pages.
 * Wine-red card with gold ribbon and bow on the left, a cream stub with the code on the right.
 */
export function buildGiftVoucherCardHtml(vouchers: GiftVoucherPrint[]) {
  const card = (voucher: GiftVoucherPrint) => {
    const free = voucher.kind === "FREE";
    return `
    <div class="cut"><div class="voucher${free ? " free" : ""}">
      <div class="face">
        <div class="glow"></div>
        <div class="ribbon-v"></div><div class="ribbon-h"></div>${BOW}
        <div class="brand"><div class="shop">${esc(SHOP.name)}</div><div class="tag">${esc(SHOP.tagline)}</div></div>
        <div class="title">${free ? "Complimentary" : "Gift"} Voucher</div>
        <div class="value"><span class="rs">Rs.</span>${rupees(voucher.amount)}</div>
        <div class="line">${free ? "With our compliments — enjoy!" : "A gift to enjoy at any of our branches"}</div>
      </div>
      <div class="stub">
        <div class="stub-label">Voucher code</div>
        <div class="code">${esc(voucher.code)}</div>
        <div class="bc">${code128Svg(voucher.code, { height: 34 })}</div>
        <div class="facts">
          <div><span>Voucher no</span><b>${esc(voucher.voucherNo)}</b></div>
          <div><span>Value</span><b>${money(voucher.amount)}</b></div>
          <div><span>Valid until</span><b>${voucher.expiresAt ? day(voucher.expiresAt) : "No expiry"}</b></div>
          <div><span>Issued</span><b>${day(voucher.issuedAt)} · ${esc(voucher.issueBranch)}</b></div>
        </div>
        <div class="sign"><span>Authorised by</span></div>
        <div class="terms">Use once, for the full amount, at any branch. The bill must be at least ${money(voucher.amount)}; pay the rest any way. No cash back or change. Keep the code private.</div>
      </div>
    </div></div>`;
  };

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileNameOf(vouchers))}</title><style>
  @page { size: 190mm 86mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 10pt/1.35 "Helvetica Neue", Arial, sans-serif; color: #2a1a12; }
  /* One voucher per page, the page the size of the voucher */
  .cut { width: 190mm; height: 86mm; overflow: hidden; break-after: page; }
  .cut:last-child { break-after: auto; }

  .voucher { width: 190mm; height: 86mm; display: flex; overflow: hidden; }
  /* Face: wine red with warm glows */
  .face { position: relative; flex: 1; padding: 8mm 10mm; color: #fff; overflow: hidden;
    background: radial-gradient(120% 140% at 85% 10%, #b3264f 0%, #7a0f33 38%, #4a0820 70%, #2b0414 100%); }
  .voucher.free .face { background: radial-gradient(120% 140% at 85% 10%, #1f8a7a 0%, #0f5d57 38%, #0a3b3c 70%, #062426 100%); }
  .glow { position: absolute; inset: 0; background:
    radial-gradient(30mm 30mm at 18% 88%, rgba(255,214,120,0.22), transparent 70%),
    radial-gradient(45mm 25mm at 70% 60%, rgba(255,255,255,0.08), transparent 70%); }
  .ribbon-v { position: absolute; top: 0; bottom: 0; left: 30mm; width: 9mm; background: linear-gradient(90deg, #a8721f, #f6d77f 45%, #fbe7a6 55%, #c08a2e); opacity: 0.95; }
  .ribbon-h { position: absolute; left: 0; right: 0; top: 58mm; height: 7mm; background: linear-gradient(180deg, #a8721f, #f6d77f 45%, #fbe7a6 55%, #c08a2e); opacity: 0.95; }
  .bow { position: absolute; left: 20.5mm; top: 49mm; width: 28mm; height: 19mm; filter: drop-shadow(0 0.6mm 0.8mm rgba(0,0,0,0.35)); }
  .brand { position: relative; margin-left: 32mm; }
  .shop { font: 700 15pt/1 Georgia, "Times New Roman", serif; letter-spacing: 0.18em; color: #fbe7a6; }
  .tag { margin-top: 1.2mm; font-size: 6.5pt; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(255,255,255,0.75); }
  .title { position: relative; margin: 6mm 0 0 32mm; font: italic 400 20pt/1 Georgia, "Times New Roman", serif; color: #fff; }
  .voucher.free .title { font-size: 17pt; white-space: nowrap; }
  .sign { margin-top: 1mm; padding-top: 7mm; border-bottom: 0.3mm solid #c79a3e; font-size: 6.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #8a6a3a; position: relative; }
  .sign span { position: absolute; left: 0; top: 0; }
  .value { position: relative; margin: 2.5mm 0 0 32mm; font: 700 34pt/1 Georgia, "Times New Roman", serif; letter-spacing: 0.01em;
    background: linear-gradient(180deg, #fff3c4 0%, #f2c96a 55%, #c48f2f 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .value .rs { font-size: 15pt; margin-right: 2mm; vertical-align: 0.35em; }
  .line { position: absolute; left: 42mm; right: 8mm; bottom: 7mm; font-size: 8pt; letter-spacing: 0.06em; color: rgba(255,255,255,0.85); text-align: right; }
  /* Stub: cream with a perforated edge */
  .stub { width: 62mm; padding: 5mm 5mm 4mm; background: linear-gradient(180deg, #fffaf0, #f7ecd6); border-left: 0.5mm dashed #c79a3e; display: flex; flex-direction: column; gap: 1.6mm; }
  .stub-label { font-size: 6.5pt; letter-spacing: 0.25em; text-transform: uppercase; color: #8a6a3a; }
  .code { font: 700 13pt/1.15 "Courier New", monospace; letter-spacing: 0.06em; color: #2a1a12; padding: 2mm 1.5mm; border: 0.4mm solid #c79a3e; border-radius: 2mm; background: #fff; text-align: center; }
  .bc { background: #fff; padding: 1mm 0.5mm; border-radius: 1mm; }
  .bc svg { display: block; width: 100%; height: 9mm; }
  .facts { display: grid; gap: 0.9mm; font-size: 7.4pt; }
  .facts div { display: flex; justify-content: space-between; gap: 2mm; }
  .facts span { color: #8a6a3a; }
  .facts b { color: #2a1a12; text-align: right; }
  .terms { margin-top: auto; font-size: 6.2pt; line-height: 1.35; color: #6b5a44; }
  @media screen { body { padding: 8mm; background: #eee; display: grid; gap: 6mm; justify-content: center; } .voucher { border-radius: 4mm; box-shadow: 0 2mm 6mm rgba(0,0,0,0.18); } }
  </style></head><body>${vouchers.map(card).join("")}</body></html>`;
}

/** Colour print at the voucher's real size (one voucher per page) — to hand to the customer. */
export function printGiftVouchers(vouchers: GiftVoucherPrint[]) {
  if (!vouchers.length) return;
  printA4(buildGiftVoucherCardHtml(vouchers), fileNameOf(vouchers));
}

/** 80mm till-slip version (for a counter without a colour printer). */
export function buildGiftVoucherSlipHtml(vouchers: GiftVoucherPrint[]) {
  const one = (voucher: GiftVoucherPrint) => `
    <div class="gv">
      <div class="center shop">${esc(SHOP.name)}</div>
      <div class="center tagline">${esc(SHOP.tagline)}</div>
      <div class="band">${voucher.kind === "FREE" ? "COMPLIMENTARY VOUCHER" : "GIFT VOUCHER"}</div>
      <div class="center amount">${money(voucher.amount)}</div>
      <div class="codebox"><div class="label">Voucher code</div><div class="code">${esc(voucher.code)}</div><div class="bc">${code128Svg(voucher.code, { height: 48 })}</div></div>
      <div class="meta">
        <div class="row"><span>Voucher no</span><span>${esc(voucher.voucherNo)}</span></div>
        <div class="row"><span>Issued</span><span>${new Date(voucher.issuedAt).toLocaleDateString("en-GB")} · ${esc(voucher.issueBranch)}</span></div>
        <div class="row"><span>Valid until</span><span>${voucher.expiresAt ? new Date(voucher.expiresAt).toLocaleDateString("en-GB") : "No expiry"}</span></div>
      </div>
      <div class="rule"></div>
      <div class="small terms">Use once, for the full amount, at any of our branches. The bill must be at least ${money(voucher.amount)}; pay the rest any way. No cash back or change. Keep the code private — whoever has it can use it.</div>
      <div class="printed">${esc(voucher.voucherNo)} · issued by ${esc(voucher.issuedBy)}</div>
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileNameOf(vouchers))}</title><style>${THERMAL_BASE_CSS}
    .amount { font-size: 26px; font-weight: 800; margin: 6px 0 2px; }
    .codebox { margin: 8px 0; padding: 7px 6px; border: 2px dashed #000; border-radius: 6px; text-align: center; }
    .codebox .label { font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; }
    .codebox .code { font: 800 19px/1.2 "Courier New", monospace; letter-spacing: 0.08em; margin-top: 2px; }
    .codebox .bc svg { display: block; width: 100%; height: 13mm; margin-top: 4px; }
    .terms { line-height: 1.4; }
    .cut { border-top: 1px dashed #000; margin: 12px 0; text-align: center; font-size: 9px; }
  </style></head><body>${vouchers.map(one).join(`<div class="cut">✂ cut here</div>`)}</body></html>`;
}

export function printGiftVoucherSlips(vouchers: GiftVoucherPrint[]) {
  if (!vouchers.length) return;
  printThermal(buildGiftVoucherSlipHtml(vouchers), fileNameOf(vouchers));
}
