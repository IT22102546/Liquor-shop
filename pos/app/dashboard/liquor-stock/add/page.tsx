"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "../../../components/AdminContext";
import { API_URL } from "../../../lib/constants";
import { IconBike } from "../../../lib/icons";

type Brand = { id: number; name: string };
type Model = { id: number; name: string; brandId: number };

const EMPTY_FORM = {
  brandId: "",
  modelId: "",
  colour: "",
  condition: "brandnew",
  mileage: "0",
  description: "",
  registerNo: "",
  chassisNo: "",
  engineNo: "",
  fileNo: "",
  manufactureDate: "",
  registrationType: "unregistered",
  purchasePrice: "",
  taxAmount: "",
  sellingPrice: "",
};

export default function AddBikePage() {
  const { token } = useAdmin();
  const [brands, setBrands]   = useState<Brand[]>([]);
  const [models, setModels]   = useState<Model[]>([]);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [expenses, setExpenses] = useState<{ description: string; amount: string }[]>([]);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // New brand / model inline-add controls
  const [newBrand, setNewBrand]           = useState("");
  const [addingBrand, setAddingBrand]     = useState(false);
  const [newModel, setNewModel]           = useState("");
  const [addingModel, setAddingModel]     = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };
  const base = `${API_URL}/api/pos/bike-management`;

  const loadBrands = useCallback(async () => {
    const res = await fetch(`${base}/brands`, { headers: authHeader });
    const json = await res.json() as { data: Brand[] };
    setBrands(json.data ?? []);
  }, [base, token]);

  useEffect(() => { void loadBrands(); }, [loadBrands]);

  useEffect(() => {
    if (!form.brandId) { setModels([]); return; }
    void (async () => {
      const res = await fetch(`${base}/brands/${form.brandId}/models`, { headers: authHeader });
      const json = await res.json() as { data: Model[] };
      setModels(json.data ?? []);
      setForm((f) => ({ ...f, modelId: "" }));
    })();
  }, [form.brandId]);

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAddBrand = async () => {
    if (!newBrand.trim()) return;
    setAddingBrand(true);
    try {
      const res = await fetch(`${base}/brands`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBrand.trim() }),
      });
      if (!res.ok) {
        const j = await res.json() as { message: string };
        setError(j.message);
        return;
      }
      const j = await res.json() as { data: Brand };
      setBrands((b) => [...b, j.data].sort((a, z) => a.name.localeCompare(z.name)));
      setForm((f) => ({ ...f, brandId: String(j.data.id) }));
      setNewBrand("");
    } finally {
      setAddingBrand(false);
    }
  };

  const handleAddModel = async () => {
    if (!newModel.trim() || !form.brandId) return;
    setAddingModel(true);
    try {
      const res = await fetch(`${base}/brands/${form.brandId}/models`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newModel.trim() }),
      });
      if (!res.ok) {
        const j = await res.json() as { message: string };
        setError(j.message);
        return;
      }
      const j = await res.json() as { data: Model };
      setModels((m) => [...m, j.data].sort((a, z) => a.name.localeCompare(z.name)));
      setForm((f) => ({ ...f, modelId: String(j.data.id) }));
      setNewModel("");
    } finally {
      setAddingModel(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.brandId || !form.modelId) { setError("Please select a brand and model."); return; }
    setSaving(true);
    try {
      const validExpenses = expenses.filter((ex) => ex.description.trim() && ex.amount);
      const payload = {
        brandId:          Number(form.brandId),
        modelId:          Number(form.modelId),
        colour:           form.colour,
        condition:        form.condition,
        mileage:          form.mileage ? Number(form.mileage) : 0,
        description:      form.description || undefined,
        registerNo:       form.registerNo,
        chassisNo:        form.chassisNo,
        engineNo:         form.engineNo,
        fileNo:           form.fileNo || undefined,
        manufactureDate:  form.manufactureDate || undefined,
        registrationType: form.registrationType,
        purchasePrice:    form.purchasePrice ? Number(form.purchasePrice) : undefined,
        taxAmount:        form.taxAmount ? Number(form.taxAmount) : undefined,
        sellingPrice:     form.sellingPrice ? Number(form.sellingPrice) : undefined,
        expenses:         validExpenses.length > 0
          ? validExpenses.map((ex) => ({ description: ex.description.trim(), amount: Number(ex.amount) }))
          : undefined,
      };
      const res = await fetch(`${base}/vehicles`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data: { displayId: string }; message?: string };
      if (!res.ok) { setError((json as { message: string }).message ?? "Failed to add product"); return; }
      setSuccess(`Bike added successfully — ID: ${json.data.displayId}`);
      setForm(EMPTY_FORM);
      setExpenses([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-page">
      {/* Header */}
      <div className="page-title-row">
        <div className="page-title-icon">
          <IconBike />
        </div>
        <div>
          <h2 className="page-title">Add Liquor Product</h2>
          <p className="page-subtitle">Add a bottle, can, keg, mixer, or bar product to stock</p>
        </div>
      </div>

      <form className="bm-form-card" onSubmit={handleSubmit}>

        {/* Feedback banners */}
        {error   && <div className="bm-alert bm-alert-error">{error}</div>}
        {success && <div className="bm-alert bm-alert-success">{success}</div>}

        {/* Brand */}
        <div className="bm-form-section">
          <h3 className="bm-section-label">Brand</h3>
          <div className="bm-inline-add-row">
            <select className="bm-select" value={form.brandId} onChange={set("brandId")} required>
              <option value="">— Select Brand —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="bm-quick-add-row">
            <input
              className="bm-input bm-input-sm"
              placeholder="New brand name…"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddBrand(); }}}
            />
            <button type="button" className="btn-accent bm-add-btn" onClick={handleAddBrand} disabled={addingBrand || !newBrand.trim()}>
              {addingBrand ? "Adding…" : "+ Add Brand"}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="bm-form-section">
          <h3 className="bm-section-label">Model</h3>
          <div className="bm-inline-add-row">
            <select className="bm-select" value={form.modelId} onChange={set("modelId")} required disabled={!form.brandId}>
              <option value="">— Select Model —</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {form.brandId && (
            <div className="bm-quick-add-row">
              <input
                className="bm-input bm-input-sm"
                placeholder="New model name…"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddModel(); }}}
              />
              <button type="button" className="btn-accent bm-add-btn" onClick={handleAddModel} disabled={addingModel || !newModel.trim()}>
                {addingModel ? "Adding…" : "+ Add Model"}
              </button>
            </div>
          )}
        </div>

        {/* Vehicle details */}
        <div className="bm-form-section">
          <h3 className="bm-section-label">Vehicle Details</h3>
          <div className="bm-fields-grid">
            <div className="bm-field-group">
              <label>Chassis Number *</label>
              <input className="bm-input" value={form.chassisNo} onChange={set("chassisNo")} required placeholder="e.g. ABC123456" />
            </div>
            <div className="bm-field-group">
              <label>Engine Number *</label>
              <input className="bm-input" value={form.engineNo} onChange={set("engineNo")} required placeholder="e.g. ENG789012" />
            </div>
            <div className="bm-field-group">
              <label>Register Number *</label>
              <input className="bm-input" value={form.registerNo} onChange={set("registerNo")} required placeholder="e.g. WP-CAB-1234" />
            </div>
            <div className="bm-field-group">
              <label>Colour *</label>
              <input className="bm-input" value={form.colour} onChange={set("colour")} required placeholder="e.g. Red" />
            </div>
            <div className="bm-field-group">
              <label>Condition *</label>
              <select className="bm-select" value={form.condition} onChange={set("condition")} required>
                <option value="brandnew">Brand New</option>
                <option value="used">Used</option>
              </select>
            </div>
            <div className="bm-field-group">
              <label>Registration Type *</label>
              <select className="bm-select" value={form.registrationType} onChange={set("registrationType")} required>
                <option value="unregistered">Unregistered</option>
                <option value="registered">Registered</option>
              </select>
            </div>
            <div className="bm-field-group">
              <label>Mileage</label>
              <div className="bm-quick-add-row">
                <input className="bm-input" type="number" min={0} value={form.mileage} onChange={set("mileage")} />
                <button type="button" className="btn-outline" onClick={() => setForm((f) => ({ ...f, mileage: "0" }))}>Set 0</button>
              </div>
            </div>
            <div className="bm-field-group">
              <label>File No</label>
              <input className="bm-input" value={form.fileNo} onChange={set("fileNo")} placeholder="Optional" />
            </div>
            <div className="bm-field-group">
              <label>Manufacture Date</label>
              <input className="bm-input" type="date" value={form.manufactureDate} onChange={set("manufactureDate")} />
            </div>
            <div className="bm-field-group" style={{ gridColumn: "1 / -1" }}>
              <label>Description</label>
              <textarea className="bm-input" rows={3} value={form.description} onChange={set("description")} placeholder="Add product description" />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bm-form-section">
          <h3 className="bm-section-label">Pricing</h3>
          <div className="bm-fields-grid">
            <div className="bm-field-group">
              <label>Purchase Price</label>
              <input className="bm-input" type="number" min={0} step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} placeholder="e.g. 350000" />
            </div>
            <div className="bm-field-group">
              <label>Tax Amount</label>
              <input className="bm-input" type="number" min={0} step="0.01" value={form.taxAmount} onChange={set("taxAmount")} placeholder="e.g. 25000" />
            </div>
            <div className="bm-field-group">
              <label>Selling Price</label>
              <input className="bm-input" type="number" min={0} step="0.01" value={form.sellingPrice} onChange={set("sellingPrice")} placeholder="e.g. 450000" />
            </div>
          </div>
        </div>

        {/* Additional Expenses */}
        <div className="bm-form-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 className="bm-section-label">Additional Expenses</h3>
            <button type="button" className="btn-accent bm-add-btn" onClick={() => setExpenses((prev) => [...prev, { description: "", amount: "" }])}>+</button>
          </div>
          {expenses.map((ex, i) => (
            <div key={i} className="bm-quick-add-row" style={{ marginBottom: 6 }}>
              <input className="bm-input bm-input-sm" placeholder="Cost description" value={ex.description}
                onChange={(e) => setExpenses((prev) => prev.map((p, j) => j === i ? { ...p, description: e.target.value } : p))} />
              <input className="bm-input bm-input-sm" type="number" min={0} step="0.01" placeholder="Amount" value={ex.amount}
                onChange={(e) => setExpenses((prev) => prev.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))} style={{ maxWidth: 140 }} />
              <button type="button" className="bm-action-btn bm-del-btn" onClick={() => setExpenses((prev) => prev.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {expenses.length > 0 && (
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>
              Total Additional: {expenses.reduce((s, ex) => s + (Number(ex.amount) || 0), 0).toLocaleString()}
            </div>
          )}
        </div>

        <div className="bm-form-footer">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" />Saving…</> : "Save Vehicle"}
          </button>
        </div>
      </form>
    </div>
  );
}
