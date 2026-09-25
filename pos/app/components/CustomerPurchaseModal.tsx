"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_URL } from "../lib/constants";

type ProvinceMeta = { name: string; districts: string[] };
type PosUser = {
  id: number;
  firstName: string;
  lastName: string;
  nic: string;
  mobileNumber: string;
  email?: string | null;
  province: string;
  district: string;
  address: string;
};

type UserFormState = {
  firstName: string;
  lastName: string;
  nic: string;
  mobileNumber: string;
  email: string;
  province: string;
  district: string;
  address: string;
};

const CUSTOM_CATEGORIES = [
  "Utility Bill Collection",
  "Service Charge",
  "Advance Payment",
  "Registration Fee",
  "Booking Fee",
  "Miscellaneous",
] as const;

const EXTRA_COST_OPTIONS = [
  "VIP Number Plate",
  "Helmet",
  "Accessories",
  "Other",
] as const;

type ExtraCost = {
  id: string;
  label: string;
  amount: number;
};

type CustomerPurchaseModalProps = {
  token: string;
  itemType: "INVENTORY" | "CUSTOM";
  itemId: number;
  itemLabel: string;
  currentSellingPrice?: number | null;
  maxQuantity?: number;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_USER_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  nic: "",
  mobileNumber: "",
  email: "",
  province: "",
  district: "",
  address: "",
};

function parsePositiveInt(value: string, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export default function CustomerPurchaseModal(props: CustomerPurchaseModalProps) {
  const {
    token,
    itemType,
    itemId,
    itemLabel,
    currentSellingPrice,
    maxQuantity = 1,
    onClose,
    onSaved,
  } = props;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<PosUser[]>([]);
  const [provinces, setProvinces] = useState<ProvinceMeta[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [paymentChequeNo, setPaymentChequeNo] = useState("");
  const [paymentChequeBank, setPaymentChequeBank] = useState("");
  const [paymentChequeDate, setPaymentChequeDate] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);

  const [quantity, setQuantity] = useState("1");
  const [finalSellingPrice, setFinalSellingPrice] = useState(
    currentSellingPrice != null ? String(currentSellingPrice) : ""
  );
  const [paymentType, setPaymentType] = useState<"DIRECT" | "DOWNPAYMENT">("DIRECT");
  const [downPaymentAmount, setDownPaymentAmount] = useState("");
  const [extraCostType, setExtraCostType] = useState<(typeof EXTRA_COST_OPTIONS)[number]>("VIP Number Plate");
  const [customExtraCostLabel, setCustomExtraCostLabel] = useState("");
  const [extraCostAmount, setExtraCostAmount] = useState("");
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);
  const [interestRate, setInterestRate] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState("");

  const [customCategory, setCustomCategory] = useState<string>("Miscellaneous");
  const [customCategoryOther, setCustomCategoryOther] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const base = `${API_URL}/api/pos/user-management`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const districtsForProvince = useMemo(
    () => provinces.find((province) => province.name === userForm.province)?.districts ?? [],
    [provinces, userForm.province]
  );

  const computedInvoiceTotal = useMemo(() => {
    const parsed = Number(finalSellingPrice);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [finalSellingPrice]);

  const computedInvoiceGrandTotal = useMemo(
    () => computedInvoiceTotal + extraCosts.reduce((sum, cost) => sum + cost.amount, 0),
    [computedInvoiceTotal, extraCosts]
  );

  const computedExtraCostsTotal = useMemo(
    () => roundCurrency(extraCosts.reduce((sum, cost) => sum + cost.amount, 0)),
    [extraCosts]
  );

  const parsedDownPayment = Number(downPaymentAmount || "0");
  const parsedInterestRate = Number(interestRate || "0");
  const parsedInstallmentMonths = Number(installmentMonths || "0");

  const computedTotalWithInterest = useMemo(() => {
    if (paymentType !== "DOWNPAYMENT" || !Number.isFinite(parsedInterestRate) || parsedInterestRate <= 0) return null;
    if (!Number.isInteger(parsedInstallmentMonths) || parsedInstallmentMonths <= 0) return null;
    return roundCurrency(computedInvoiceTotal * (1 + parsedInterestRate / 100));
  }, [computedInvoiceTotal, parsedInterestRate, parsedInstallmentMonths, paymentType]);

  const computedMonthlyInstallment = useMemo(() => {
    if (computedTotalWithInterest == null || parsedInstallmentMonths <= 0) return null;
    return roundCurrency(computedTotalWithInterest / parsedInstallmentMonths);
  }, [computedTotalWithInterest, parsedInstallmentMonths]);

  const effectiveTotal = computedTotalWithInterest ?? computedInvoiceTotal;

  const computedDownPayment = paymentType === "DIRECT"
    ? computedInvoiceTotal
    : (Number.isFinite(parsedDownPayment) && parsedDownPayment >= 0 ? parsedDownPayment : 0);
  const computedRemaining = Math.max(0, Math.round((effectiveTotal - computedDownPayment) * 100) / 100);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, provincesRes] = await Promise.all([
          fetch(`${base}?page=1&limit=500`, { headers: auth, cache: "no-store" }),
          fetch(`${base}/meta/provinces`, { headers: auth, cache: "no-store" }),
        ]);

        const usersJson = (await usersRes.json()) as { data?: { users?: PosUser[] }; message?: string };
        const provincesJson = (await provincesRes.json()) as { data?: { provinces?: ProvinceMeta[] }; message?: string };

        if (!usersRes.ok) throw new Error(usersJson.message ?? "Failed to load users");
        if (!provincesRes.ok) throw new Error(provincesJson.message ?? "Failed to load provinces");

        setUsers(usersJson.data?.users ?? []);
        setProvinces(provincesJson.data?.provinces ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load customer data");
      } finally {
        setLoading(false);
      }
    })();
  }, [auth, base]);

  useEffect(() => {
    if (paymentType === "DIRECT") {
      setDownPaymentAmount(String(computedInvoiceTotal));
    }
  }, [computedInvoiceTotal, paymentType]);

  const addExtraCost = () => {
    const label = extraCostType === "Other" ? customExtraCostLabel.trim() : extraCostType;
    const amount = Number(extraCostAmount);
    if (!label) {
      setError("Please enter an extra cost name");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid extra cost amount");
      return;
    }
    setExtraCosts((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label, amount: roundCurrency(amount) },
    ]);
    setExtraCostAmount("");
    setCustomExtraCostLabel("");
    setError(null);
  };

  const createCustomer = async () => {
    const response = await fetch(base, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        nic: userForm.nic,
        mobileNumber: userForm.mobileNumber,
        email: userForm.email.trim() || undefined,
        province: userForm.province,
        district: userForm.district,
        address: userForm.address,
      }),
    });

    const payload = (await response.json()) as { data?: PosUser; message?: string };
    if (!response.ok || !payload.data) {
      throw new Error(payload.message ?? "Failed to create user");
    }

    return payload.data.id;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const resolvedUserId = showAddUser ? await createCustomer() : selectedUserId;
      if (!resolvedUserId) {
        throw new Error("Please select a user or add a new user");
      }

      const parsedFinalPrice = Number(finalSellingPrice);

      const parsedQty = itemType === "INVENTORY" ? Number(quantity) : 1;
      if (itemType === "INVENTORY") {
        if (!Number.isInteger(parsedQty) || parsedQty < 1) {
          throw new Error("Please enter a valid quantity");
        }
        if (parsedQty > maxQuantity) {
          throw new Error(`Only ${maxQuantity} items are available`);
        }
      }

      if (itemType === "CUSTOM" && !customDescription.trim()) {
        throw new Error("Please enter a description for the custom invoice");
      }

      if (paymentType === "DOWNPAYMENT") {
        if (!Number.isFinite(parsedDownPayment) || parsedDownPayment <= 0) {
          throw new Error("Please enter a valid downpayment amount");
        }
        if (parsedDownPayment > computedInvoiceTotal) {
          throw new Error("Downpayment amount cannot exceed total invoice amount");
        }
      }

      if (!Number.isFinite(parsedFinalPrice) || parsedFinalPrice < 0) {
        throw new Error("Please enter a valid final selling price");
      }

      const response = await fetch(`${base}/${resolvedUserId}/purchases`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: itemType,
          purchaseMode: "SINGLE",
          inventoryProductId: itemType === "INVENTORY" ? itemId : undefined,
          customCategory: itemType === "CUSTOM"
            ? (customCategory === "Other" ? customCategoryOther.trim() || "Miscellaneous" : customCategory)
            : undefined,
          customDescription: itemType === "CUSTOM" ? customDescription.trim() : undefined,
          quantity: itemType === "INVENTORY" ? parsedQty : undefined,
          finalSellingPrice: parsedFinalPrice,
          paymentType,
          downPaymentAmount: paymentType === "DOWNPAYMENT" ? parsedDownPayment : undefined,
          extraCosts: extraCosts.map(({ label, amount }) => ({ label, amount })),
          interestRate: paymentType === "DOWNPAYMENT" && parsedInterestRate > 0 ? parsedInterestRate : undefined,
          installmentMonths: paymentType === "DOWNPAYMENT" && parsedInstallmentMonths >= 1 ? parsedInstallmentMonths : undefined,
          paymentMethod,
          chequeNo: paymentMethod === "CHEQUE" ? paymentChequeNo || undefined : undefined,
          chequeBank: paymentMethod === "CHEQUE" ? paymentChequeBank || undefined : undefined,
          chequeDate: paymentMethod === "CHEQUE" ? paymentChequeDate || undefined : undefined,
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to create sale");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <form className="bm-modal bm-modal-lg" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <button type="button" className="bm-modal-close" onClick={onClose}>x</button>
        <h3 className="bm-modal-title">{itemType === "CUSTOM" ? "Generate Bar Invoice" : "Record Product Sale"}</h3>

        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        {loading && <p className="users-muted">Loading users...</p>}

        {!loading && (
          <>
            <div className="users-form-grid">
              <div className="bm-field-group users-span-2">
                <label>Item</label>
                <input className="bm-input" value={itemLabel} readOnly />
              </div>

              <div className="bm-field-group users-span-2">
                <label>Customer Lookup</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    className="bm-input"
                    value={selectedUserId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedUserId(value ? Number(value) : "");
                      if (value) setShowAddUser(false);
                    }}
                    disabled={showAddUser}
                  >
                    <option value="">Search registered customer</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} | {user.nic} | {user.mobileNumber}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="bm-plus-btn"
                    title="Add new customer"
                    onClick={() => {
                      setShowAddUser((value) => !value);
                      setSelectedUserId("");
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {itemType === "CUSTOM" && (
                <>
                  <div className="bm-field-group users-span-2">
                    <label>Category</label>
                    <select
                      className="bm-input"
                      value={customCategory}
                      onChange={(event) => setCustomCategory(event.target.value)}
                    >
                      {CUSTOM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="Other">Other (specify below)</option>
                    </select>
                  </div>
                  {customCategory === "Other" && (
                    <div className="bm-field-group users-span-2">
                      <label>Specify Category</label>
                      <input
                        className="bm-input"
                        value={customCategoryOther}
                        onChange={(event) => setCustomCategoryOther(event.target.value)}
                        placeholder="e.g. Equipment rental"
                      />
                    </div>
                  )}
                  <div className="bm-field-group users-span-2">
                    <label>Description *</label>
                    <input
                      className="bm-input"
                      value={customDescription}
                      onChange={(event) => setCustomDescription(event.target.value)}
                      placeholder="Enter invoice description"
                      required
                    />
                  </div>
                </>
              )}

              {showAddUser && (
                <>
                  <div className="bm-field-group">
                    <label>First Name</label>
                    <input className="bm-input" value={userForm.firstName} onChange={(event) => setUserForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
                  </div>
                  <div className="bm-field-group">
                    <label>Last Name</label>
                    <input className="bm-input" value={userForm.lastName} onChange={(event) => setUserForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
                  </div>
                  <div className="bm-field-group">
                    <label>NIC</label>
                    <input className="bm-input" value={userForm.nic} onChange={(event) => setUserForm((prev) => ({ ...prev, nic: event.target.value }))} required />
                  </div>
                  <div className="bm-field-group">
                    <label>Mobile Number</label>
                    <input className="bm-input" value={userForm.mobileNumber} onChange={(event) => setUserForm((prev) => ({ ...prev, mobileNumber: event.target.value }))} required />
                  </div>
                  <div className="bm-field-group">
                    <label>Email (Optional)</label>
                    <input type="email" className="bm-input" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
                  </div>
                  <div className="bm-field-group">
                    <label>Province</label>
                    <select
                      className="bm-input"
                      value={userForm.province}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, province: event.target.value, district: "" }))}
                      required
                    >
                      <option value="">Select province</option>
                      {provinces.map((province) => <option key={province.name} value={province.name}>{province.name}</option>)}
                    </select>
                  </div>
                  <div className="bm-field-group">
                    <label>District</label>
                    <select
                      className="bm-input"
                      value={userForm.district}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, district: event.target.value }))}
                      required
                      disabled={!userForm.province}
                    >
                      <option value="">Select district</option>
                      {districtsForProvince.map((district) => <option key={district} value={district}>{district}</option>)}
                    </select>
                  </div>
                  <div className="bm-field-group users-span-2">
                    <label>Address</label>
                    <textarea className="bm-input users-textarea" value={userForm.address} onChange={(event) => setUserForm((prev) => ({ ...prev, address: event.target.value }))} required />
                  </div>
                </>
              )}

              {itemType === "INVENTORY" && (
                <div className="bm-field-group">
                  <label>Quantity</label>
                  <input
                    className="bm-input"
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    onChange={(event) => {
                      const nextQuantityRaw = event.target.value;
                      const previousQuantity = parsePositiveInt(quantity, 1);
                      const nextQuantity = parsePositiveInt(nextQuantityRaw, previousQuantity);

                      const previousTotal = Number(finalSellingPrice);
                      const fallbackUnitPrice = currentSellingPrice ?? 0;
                      const inferredUnitPrice = Number.isFinite(previousTotal) && previousTotal > 0
                        ? previousTotal / previousQuantity
                        : fallbackUnitPrice;
                      const nextTotal = inferredUnitPrice > 0
                        ? roundCurrency(inferredUnitPrice * nextQuantity)
                        : previousTotal;

                      setQuantity(nextQuantityRaw);
                      setFinalSellingPrice(Number.isFinite(nextTotal) ? String(nextTotal) : finalSellingPrice);
                    }}
                    required
                  />
                </div>
              )}

              <div className="bm-field-group">
                <label>Current Selling Price</label>
                <input
                  className="bm-input"
                  value={currentSellingPrice != null ? `Rs. ${currentSellingPrice.toLocaleString()}` : "Not set"}
                  readOnly
                />
              </div>

              <div className="bm-field-group">
                <label>Final Selling Price</label>
                <input
                  className="bm-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={finalSellingPrice}
                  onChange={(event) => setFinalSellingPrice(event.target.value)}
                  required
                />
              </div>

              <div className="bm-field-group users-span-2">
                <label>Extra Costs</label>
                <div className="users-form-grid" style={{ marginTop: 6 }}>
                  <div className="bm-field-group">
                    <label>Cost Type</label>
                    <select
                      className="bm-input"
                      value={extraCostType}
                      onChange={(event) => setExtraCostType(event.target.value as (typeof EXTRA_COST_OPTIONS)[number])}
                    >
                      {EXTRA_COST_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  {extraCostType === "Other" && (
                    <div className="bm-field-group">
                      <label>Cost Name</label>
                      <input
                        className="bm-input"
                        maxLength={120}
                        value={customExtraCostLabel}
                        onChange={(event) => setCustomExtraCostLabel(event.target.value)}
                        placeholder="Enter cost name"
                      />
                    </div>
                  )}
                  <div className="bm-field-group">
                    <label>Amount (Rs.)</label>
                    <input
                      className="bm-input"
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={extraCostAmount}
                      onChange={(event) => setExtraCostAmount(event.target.value)}
                    />
                  </div>
                  <div className="bm-field-group" style={{ display: "flex", justifyContent: "end" }}>
                    <button type="button" className="btn-accent" onClick={addExtraCost}>+ Add Cost</button>
                  </div>
                </div>
                {extraCosts.length > 0 && (
                  <div className="data-table-wrap" style={{ marginTop: 10 }}>
                    <table className="data-table">
                      <thead><tr><th>Description</th><th>Amount</th><th>Action</th></tr></thead>
                      <tbody>
                        {extraCosts.map((cost) => (
                          <tr key={cost.id}>
                            <td>{cost.label}</td>
                            <td>Rs. {cost.amount.toLocaleString()}</td>
                            <td>
                              <button type="button" className="btn-outline" onClick={() => setExtraCosts((prev) => prev.filter((item) => item.id !== cost.id))}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(itemType === "INVENTORY" || itemType === "CUSTOM") && (
                <>
                  <div className="bm-field-group">
                    <label>Payment Type</label>
                    <select className="bm-input" value={paymentType} onChange={(event) => {
                      setPaymentType(event.target.value as "DIRECT" | "DOWNPAYMENT");
                      if (event.target.value === "DIRECT") {
                        setInterestRate("");
                        setInstallmentMonths("");
                      }
                    }}>
                      <option value="DIRECT">Direct</option>
                      <option value="DOWNPAYMENT">Downpayment (Installments)</option>
                    </select>
                  </div>

                  <div className="bm-field-group">
                    <label>Downpayment Amount</label>
                    <input
                      className="bm-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={downPaymentAmount}
                      onChange={(event) => setDownPaymentAmount(event.target.value)}
                      disabled={paymentType === "DIRECT"}
                      required={paymentType === "DOWNPAYMENT"}
                    />
                  </div>

                  {paymentType === "DOWNPAYMENT" && (
                    <>
                      <div className="bm-field-group">
                        <label>Finance Charge (%)</label>
                        <input
                          className="bm-input"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          placeholder="e.g. 5"
                          value={interestRate}
                          onChange={(event) => setInterestRate(event.target.value)}
                        />
                      </div>
                      <div className="bm-field-group">
                        <label>Number of Installments (Months)</label>
                        <input
                          className="bm-input"
                          type="number"
                          min={1}
                          step="1"
                          placeholder="e.g. 12"
                          value={installmentMonths}
                          onChange={(event) => setInstallmentMonths(event.target.value)}
                        />
                      </div>
                      {computedTotalWithInterest != null && (
                        <>
                          <div className="bm-field-group">
                            <label>Total with Finance Charge</label>
                            <input className="bm-input" value={`Rs. ${computedTotalWithInterest.toLocaleString()}`} readOnly />
                          </div>
                          <div className="bm-field-group">
                            <label>Monthly Installment</label>
                            <input className="bm-input" value={computedMonthlyInstallment != null ? `Rs. ${computedMonthlyInstallment.toLocaleString()}` : "-"} readOnly />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="bm-field-group">
                <label>Invoice Total</label>
                <input className="bm-input" value={`Rs. ${computedInvoiceTotal.toLocaleString()}`} readOnly />
              </div>

              {extraCosts.length > 0 && (
                <div className="bm-field-group">
                  <label>Extra Costs Total</label>
                  <input className="bm-input" value={`Rs. ${computedExtraCostsTotal.toLocaleString()}`} readOnly />
                </div>
              )}

              <div className="bm-field-group">
                <label>Grand Total{computedTotalWithInterest != null ? " (incl. finance charge)" : ""}</label>
                <input className="bm-input" value={`Rs. ${(computedTotalWithInterest != null ? computedTotalWithInterest + computedExtraCostsTotal : computedInvoiceGrandTotal).toLocaleString()}`} readOnly />
              </div>

              <div className="bm-field-group">
                <label>Remaining To Settle</label>
                <input className="bm-input" value={`Rs. ${computedRemaining.toLocaleString()}`} readOnly />
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", padding: "1rem", border: "1px solid var(--panel-border)", borderRadius: "var(--radius-sm)", background: "var(--panel-bg)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.75rem", color: "var(--accent)" }}>How is this being paid?</div>
              <div className="users-form-grid">
                <div className="bm-field-group users-span-2">
                  <label>Payment Method</label>
                  <div style={{ display: "flex", gap: 20 }}>
                    {(["CASH", "CHEQUE", "BANK_TRANSFER"] as const).map((m) => (
                      <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                        <input type="radio" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} style={{ accentColor: "var(--accent)" }} />
                        {m === "BANK_TRANSFER" ? "Bank Transfer" : m}
                      </label>
                    ))}
                  </div>
                </div>
                {paymentMethod === "CHEQUE" && (
                  <>
                    <div className="bm-field-group">
                      <label>Cheque No *</label>
                      <input className="bm-input" value={paymentChequeNo} onChange={(e) => setPaymentChequeNo(e.target.value)} placeholder="e.g. 001234" />
                    </div>
                    <div className="bm-field-group">
                      <label>Bank</label>
                      <input className="bm-input" value={paymentChequeBank} onChange={(e) => setPaymentChequeBank(e.target.value)} placeholder="e.g. HNB" />
                    </div>
                    <div className="bm-field-group">
                      <label>Cheque Date</label>
                      <input type="date" className="bm-input" value={paymentChequeDate} onChange={(e) => setPaymentChequeDate(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving..." : "Confirm Sale"}</button>
              <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
