"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../../lib/constants";
import { useAdmin } from "../../components/AdminContext";
import { useSaveShopSettings, useShopSettings, type ShopSettings } from "../../lib/useShopSettings";
import { IconAccess, IconBottle, IconCheck, IconSupplier, IconUsers } from "../../lib/icons";

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`lx-switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export default function ShopSettingsPage() {
  const { token } = useAdmin();
  const { settings, loaded } = useShopSettings(token);
  const save = useSaveShopSettings(token);
  const [saving, setSaving] = useState<keyof ShopSettings | null>(null);
  const [savedKey, setSavedKey] = useState<keyof ShopSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxPercent, setMaxPercent] = useState(String(settings.maxCashierDiscountPercent));
  const [earnRate, setEarnRate] = useState(String(settings.loyaltyRupeesPerPoint));
  const [pointValue, setPointValue] = useState(String(settings.loyaltyPointValue));

  const [business, setBusiness] = useState({ businessName: "", businessAddress: "", businessPhone: "", businessEmail: "" });
  const [mail, setMail] = useState<{ configured: boolean; sender: string | null } | null>(null);
  useEffect(() => {
    setBusiness({ businessName: settings.businessName, businessAddress: settings.businessAddress, businessPhone: settings.businessPhone, businessEmail: settings.businessEmail });
  }, [settings.businessName, settings.businessAddress, settings.businessPhone, settings.businessEmail]);
  useEffect(() => {
    void fetch(`${API_URL}/api/pos/purchase-orders/email-status`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { configured: boolean; sender: string | null } } | null) => setMail(payload?.data ?? null))
      .catch(() => setMail(null));
  }, [token]);
  const businessChanged = (Object.keys(business) as Array<keyof typeof business>).some((key) => business[key].trim() !== settings[key]);
  const saveBusiness = async () => {
    if (!business.businessName.trim()) { setError("Enter the business name."); return; }
    setSaving("businessName");
    setError(null);
    try {
      await save({ businessName: business.businessName.trim(), businessAddress: business.businessAddress.trim(), businessPhone: business.businessPhone.trim(), businessEmail: business.businessEmail.trim() });
      setSavedKey("businessName");
      window.setTimeout(() => setSavedKey((current) => (current === "businessName" ? null : current)), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the business details");
    } finally {
      setSaving(null);
    }
  };
  const [hardLimit, setHardLimit] = useState(String(settings.hardLiquorLimit));
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  useEffect(() => { setHardLimit(String(settings.hardLiquorLimit)); }, [settings.hardLiquorLimit]);
  useEffect(() => {
    void fetch(`${API_URL}/api/pos/inventory-management/product-categories`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: Array<{ id: number; name: string }> } | null) => setCategories(payload?.data ?? []))
      .catch(() => setCategories([]));
  }, [token]);
  const effectiveHard = new Set(settings.hardLiquorCategoryIdsEffective ?? []);
  useEffect(() => { setMaxPercent(String(settings.maxCashierDiscountPercent)); }, [settings.maxCashierDiscountPercent]);
  useEffect(() => { setEarnRate(String(settings.loyaltyRupeesPerPoint)); }, [settings.loyaltyRupeesPerPoint]);
  useEffect(() => { setPointValue(String(settings.loyaltyPointValue)); }, [settings.loyaltyPointValue]);

  const earnNumber = Number(earnRate);
  const valueNumber = Number(pointValue);
  const ratesValid = Number.isFinite(earnNumber) && earnNumber >= 1 && Number.isFinite(valueNumber) && valueNumber >= 0.01;
  const ratesChanged = earnNumber !== settings.loyaltyRupeesPerPoint || valueNumber !== settings.loyaltyPointValue;
  const rupees = (value: number) => `Rs. ${value.toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
  const examplePoints = ratesValid ? Math.floor(2500 / earnNumber) : 0;

  const saveRates = async () => {
    if (!ratesValid) {
      setError("Enter at least Rs. 1 for earning and more than Rs. 0 for a point's value.");
      return;
    }
    setSaving("loyaltyRupeesPerPoint");
    setError(null);
    try {
      await save({ loyaltyRupeesPerPoint: earnNumber, loyaltyPointValue: valueNumber });
      setSavedKey("loyaltyRupeesPerPoint");
      window.setTimeout(() => setSavedKey((current) => (current === "loyaltyRupeesPerPoint" ? null : current)), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the loyalty rates");
    } finally {
      setSaving(null);
    }
  };

  const update = async (key: keyof ShopSettings, value: ShopSettings[keyof ShopSettings]) => {
    setSaving(key);
    setError(null);
    try {
      await save({ [key]: value });
      setSavedKey(key);
      window.setTimeout(() => setSavedKey((current) => (current === key ? null : current)), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the setting");
    } finally {
      setSaving(null);
    }
  };

  const saved = (key: keyof ShopSettings) => savedKey === key && <span className="lx-saved"><IconCheck size={14} /> Saved</span>;

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconAccess /></div>
          <div>
            <h2 className="page-title">Shop Settings</h2>
            <p className="page-subtitle">Turn counter features on only when you need them. Changes apply to every till straight away.</p>
          </div>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="lx-settings">
        <section className="lx-card lx-setting">
          <div className="lx-setting-icon" style={{ ["--kpi-color" as string]: "var(--c4)" }}><IconUsers /></div>
          <div className="lx-setting-body">
            <h3>Loyalty points {saved("loyaltyRedemptionEnabled")}</h3>
            <p>Registered loyalty members earn points on every bill. Switch this on to let them <strong>spend</strong> their points at the counter. Walk-in customers never see this.</p>
            <form className="lx-setting-extra" onSubmit={(event) => { event.preventDefault(); void saveRates(); }}>
              <label>Points rates</label>
              <div className="lx-rate-grid">
                <div className="lx-setting-input">
                  <span>Earn 1 point for every</span>
                  <b>Rs.</b>
                  <input className="bm-input" type="number" min={1} step="1" value={earnRate} onChange={(event) => setEarnRate(event.target.value)} aria-label="Rupees spent to earn 1 point" />
                  <span>spent</span>
                </div>
                <div className="lx-setting-input">
                  <span>1 point is worth</span>
                  <b>Rs.</b>
                  <input className="bm-input" type="number" min={0.01} step="0.01" value={pointValue} onChange={(event) => setPointValue(event.target.value)} aria-label="Rupee value of 1 point" />
                  <span>off the bill</span>
                </div>
              </div>
              <small>
                {ratesValid
                  ? `Example: a Rs. 2,500 bill earns ${examplePoints} point${examplePoints === 1 ? "" : "s"}, worth ${rupees(examplePoints * valueNumber)} when spent (${((valueNumber / earnNumber) * 100).toLocaleString("en-LK", { maximumFractionDigits: 2 })}% back).`
                  : "Enter at least Rs. 1 for earning and more than Rs. 0 for a point's value."}
                {" "}New rates apply to bills from now on; earlier bills keep the values they had.
              </small>
              <div className="lx-setting-input">
                <button type="submit" className="btn-outline" disabled={saving !== null || !ratesValid || !ratesChanged}>Save rates</button>
                {saved("loyaltyRupeesPerPoint")}
              </div>
            </form>
          </div>
          <Switch label="Loyalty points redemption" checked={settings.loyaltyRedemptionEnabled} disabled={!loaded || saving !== null} onChange={(value) => void update("loyaltyRedemptionEnabled", value)} />
        </section>

        <section className="lx-card lx-setting">
          <div className="lx-setting-icon" style={{ ["--kpi-color" as string]: "var(--c3)" }}>%</div>
          <div className="lx-setting-body">
            <h3>Bill discounts {saved("discountsEnabled")}</h3>
            <p>Give a discount on any bill — as a <strong>percentage</strong> or a <strong>fixed amount</strong> — for walk-in customers and members alike. Every discount is recorded in the Activity Log with who gave it.</p>
            {settings.discountsEnabled && (
              <form
                className="lx-setting-extra"
                onSubmit={(event) => { event.preventDefault(); const value = Number(maxPercent); if (Number.isFinite(value) && value >= 0 && value <= 100) void update("maxCashierDiscountPercent", value); }}
              >
                <label htmlFor="max-discount">Most a cashier can give</label>
                <div className="lx-setting-input">
                  <input id="max-discount" className="bm-input" type="number" min={0} max={100} step="0.5" value={maxPercent} onChange={(event) => setMaxPercent(event.target.value)} />
                  <span>% of the bill</span>
                  <button type="submit" className="btn-outline" disabled={saving !== null || Number(maxPercent) === settings.maxCashierDiscountPercent}>Save</button>
                  {saved("maxCashierDiscountPercent")}
                </div>
                <small>Administrators can give any discount.</small>
              </form>
            )}
          </div>
          <Switch label="Bill discounts" checked={settings.discountsEnabled} disabled={!loaded || saving !== null} onChange={(value) => void update("discountsEnabled", value)} />
        </section>

        <section className="lx-card lx-setting">
          <div className="lx-setting-icon" style={{ ["--kpi-color" as string]: "var(--c6)" }}><IconBottle /></div>
          <div className="lx-setting-body">
            <h3>Hard liquor limit per bill {saved("hardLiquorLimitEnabled")}{saved("hardLiquorLimit")}{saved("hardLiquorCategoryIds")}</h3>
            <p>Sri Lankan law: one bill may have at most <strong>{settings.hardLiquorLimit} bottles of hard liquor</strong>. The counter stops at the limit and the server refuses bigger bills. <strong>Beer is not counted.</strong></p>
            {settings.hardLiquorLimitEnabled && (
              <div className="lx-setting-extra">
                <form className="lx-setting-input" onSubmit={(event) => { event.preventDefault(); const value = Math.floor(Number(hardLimit)); if (value >= 1) void update("hardLiquorLimit", value); }}>
                  <label htmlFor="hard-limit">Most bottles per bill</label>
                  <input id="hard-limit" className="bm-input" type="number" min={1} step="1" value={hardLimit} onChange={(event) => setHardLimit(event.target.value)} />
                  <button type="submit" className="btn-outline" disabled={saving !== null || Math.floor(Number(hardLimit)) === settings.hardLiquorLimit || !(Number(hardLimit) >= 1)}>Save</button>
                </form>
                <label>Categories counted as hard liquor</label>
                <div className="bulk-cats" style={{ paddingLeft: 0 }}>
                  {categories.map((category) => {
                    const on = effectiveHard.has(category.id);
                    return (
                      <button key={category.id} type="button" aria-pressed={on} className={on ? "on" : ""} disabled={saving !== null}
                        onClick={() => { const next = new Set(effectiveHard); if (on) next.delete(category.id); else next.add(category.id); void update("hardLiquorCategoryIds", [...next]); }}>
                        {category.name}
                      </button>
                    );
                  })}
                  {categories.length === 0 && <span className="lx-card-sub">No categories yet.</span>}
                </div>
                <small>
                  {settings.hardLiquorCategoryIds === null
                    ? "Chosen automatically from category names (arrack, whisky, brandy, rum, gin, vodka…). Tap a category to change it."
                    : "Chosen by you. "}
                  {settings.hardLiquorCategoryIds !== null && <button type="button" className="lx-link-btn" onClick={() => void update("hardLiquorCategoryIds", null)}>Go back to automatic</button>}
                </small>
              </div>
            )}
          </div>
          <Switch label="Hard liquor limit per bill" checked={settings.hardLiquorLimitEnabled} disabled={!loaded || saving !== null} onChange={(value) => void update("hardLiquorLimitEnabled", value)} />
        </section>

        <section className="lx-card lx-setting">
          <div className="lx-setting-icon" style={{ ["--kpi-color" as string]: "var(--c1)" }}><IconSupplier /></div>
          <div className="lx-setting-body">
            <h3>Business details for purchase orders {saved("businessName")}</h3>
            <p>Shown at the top of every purchase order and in emails to suppliers. Supplier replies go to the email address below.</p>
            <form className="lx-setting-extra" onSubmit={(event) => { event.preventDefault(); void saveBusiness(); }}>
              <div className="lx-member-grid">
                <label>Business name *<input id="biz-name" className="bm-input" value={business.businessName} onChange={(event) => setBusiness({ ...business, businessName: event.target.value })} /></label>
                <label>Phone<input id="biz-phone" className="bm-input" value={business.businessPhone} onChange={(event) => setBusiness({ ...business, businessPhone: event.target.value })} placeholder="e.g. 037 222 3456" /></label>
                <label className="wide">Address<input id="biz-address" className="bm-input" value={business.businessAddress} onChange={(event) => setBusiness({ ...business, businessAddress: event.target.value })} /></label>
                <label className="wide">Email for supplier replies<input id="biz-email" className="bm-input" type="email" value={business.businessEmail} onChange={(event) => setBusiness({ ...business, businessEmail: event.target.value })} placeholder="e.g. orders@yourshop.lk" /></label>
              </div>
              <div className="lx-setting-input">
                <button type="submit" className="btn-outline" disabled={saving !== null || !businessChanged}>Save details</button>
              </div>
              <small className={mail?.configured ? "lx-ok-text" : "lx-warn-text"}>
                {mail == null ? "Checking email set-up…" : mail.configured ? `Email is set up. Orders are sent from ${mail.sender}.` : "Email sending isn't set up on the server yet, so orders can be saved and printed but not emailed."}
              </small>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
