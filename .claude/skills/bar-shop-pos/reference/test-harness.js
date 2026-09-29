// Test harness for the Bar Shop POS. Copy into a scratch folder that has `npm i puppeteer-core`,
// append your test body, and run with node. It talks to the TEMPORARY backend on :5030 and drives the
// user's real UI on :3001, redirecting the UI's API calls (to :5010) to :5030 — so the real database is
// never touched and no second `next dev` is started.
const puppeteer = require("puppeteer-core");
const BASE = "http://localhost:3001", REAL = "http://localhost:5010", TMP = "http://localhost:5030";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (label, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra !== "" ? `  (${extra})` : ""}`); };
const call = (path, { method = "GET", token, body } = {}) =>
  fetch(`${TMP}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: body && JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
/** Returns { accessToken, admin } — pass it to openAs. */
const login = async (email, password) => (await call("/api/pos/auth/login", { method: "POST", body: { email, password } })).json.data;

/** Opens a page of the user's :3001 app signed in as `session`, with API calls sent to the temp backend. */
async function openAs(browser, session, path, { width = 1440, height = 900, theme = "dark" } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.evaluateOnNewDocument(() => { window.print = () => {}; });
  page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const url = req.url();
    if (!url.startsWith(REAL)) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: { "Access-Control-Allow-Origin": BASE, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE" } });
    try {
      const r = await fetch(url.replace(REAL, TMP), { method: req.method(), headers: req.headers(), body: req.postData() });
      req.respond({ status: r.status, headers: { "Access-Control-Allow-Origin": BASE, "content-type": r.headers.get("content-type") ?? "application/json" }, body: Buffer.from(await r.arrayBuffer()) });
    } catch { req.abort(); }
  });
  await page.goto(`${BASE}/signin`, { waitUntil: "load", timeout: 120000 });
  await page.evaluate((token, admin, t) => {
    localStorage.setItem("pos_theme", t);
    localStorage.setItem("pos_access_token", token);
    localStorage.setItem("pos_admin_profile", JSON.stringify(admin));
  }, session.accessToken, session.admin, theme);
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
  await sleep(3000);
  return page;
}
/** Clicks the first element matching `selector` whose text contains `text`. */
const clickText = (page, selector, text) => page.evaluate((s, t) => {
  const el = [...document.querySelectorAll(s)].find((e) => e.textContent.includes(t));
  if (el) el.click();
  return Boolean(el);
}, selector, text);
/** A barcode reader: fast typing + Enter. */
const scan = async (page, code) => { await page.keyboard.type(code, { delay: 5 }); await page.keyboard.press("Enter"); await sleep(500); };
/** Renders an HTML print (receipt / A4) to a PNG you can look at. */
async function renderHtml(browser, html, file, width = 900) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1100 });
  await page.setContent(html);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

// ── Example body ─────────────────────────────────────────────────────────────
// (async () => {
//   for (let i = 0; i < 40; i++) { try { if ((await fetch(`${TMP}/health`)).ok) break; } catch {} await sleep(500); }
//   const admin = await login("manager@barshop.local", "liquorshop@2026");
//   const A = admin.accessToken;
//   await call("/api/pos/auth/staff", { method: "POST", token: A, body: { name: "Nimal Perera", email: "nimal@barshop.local", password: "Cashier@123", role: "CASHIER", branchId: 1 } });
//   const inv = (path, body) => call(`/api/pos/inventory-management${path}`, { method: "POST", token: A, body }).then((r) => r.json.data);
//   const brand = await inv("/product-brands", { name: "Lion" });
//   const beer = await inv("/product-categories", { name: "Beer" });
//   // purchasePrice on create is the BATCH total (100 bottles for Rs 30,000 = Rs 300 each)
//   const stout = await inv("/products", { brandId: brand.id, categoryId: beer.id, name: "Lion Stout", quantity: 100, purchasePrice: 30000, sellingPrice: 850 });
//   const shift = (await call("/api/pos/shifts/open", { method: "POST", token: A, body: { openingFloat: 5000 } })).json.data;
//   const r = await call("/api/pos/user-management/checkout", { method: "POST", token: A, body: { paymentMethod: "CASH", items: [{ productId: stout.id, quantity: 2, unitPrice: 850 }], amountReceived: 2000 } });
//   check("sale saved", r.status === 201, r.status);
//   const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
//   const page = await openAs(browser, admin, "/dashboard/day-end");
//   await page.screenshot({ path: "dayend.png" });
//   await browser.close();
//   console.log(`\n${pass} passed, ${fail} failed`);
// })();
