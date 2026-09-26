"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminContext";
import { useSaveShopSettings, useShopSettings, type ShopSettings } from "../../lib/useShopSettings";
import { IconAccess, IconCheck, IconUsers } from "../../lib/icons";

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
      </div>
    </div>
  );
}
