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
  itemType: "BIKE" | "INVENTORY" | "PRE_ORDER" | "CUSTOM";
  itemId: number;
  itemLabel: string;
  currentSellingPrice?: number | null;
  maxQuantity?: number;
  onClose: () => void;
  onSaved: () => void;
};

type BikeOption = {
  id: number;
  displayId: string;
  colour: string;
  status: "available" | "sold";
  sellingPrice?: number | null;
  brand: { name: string };
  model: { name: string };
};

type BulkLine = {
  key: string;
  brandName: string;
  modelName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  hasRegistrationFee: boolean;
  registrationFeeAmount: number;
  registrationFeeSubtotal: number;
  bikeIds: number[];
};

type LeasingCompanyOption = {
  id: number;
  name: string;
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
  const [bikeOptions, setBikeOptions] = useState<BikeOption[]>([]);
  const [leasingCompanies, setLeasingCompanies] = useState<LeasingCompanyOption[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [paymentChequeNo, setPaymentChequeNo] = useState("");
  const [paymentChequeBank, setPaymentChequeBank] = useState("");
  const [paymentChequeDate, setPaymentChequeDate] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);

  const [purchaseMode, setPurchaseMode] = useState<"SINGLE" | "BULK">("SINGLE");
  const [selectedBikeId, setSelectedBikeId] = useState<number | "">(itemType === "BIKE" ? itemId : "");
  const [bulkBrandModelKey, setBulkBrandModelKey] = useState("");
  const [bulkCount, setBulkCount] = useState("1");
  const [bulkUnitPrice, setBulkUnitPrice] = useState(currentSellingPrice != null ? String(currentSellingPrice) : "");
  const [bulkHasRegistrationFee, setBulkHasRegistrationFee] = useState(false);
  const [bulkRegistrationFeeAmount, setBulkRegistrationFeeAmount] = useState("");
  const [bulkLines, setBulkLines] = useState<BulkLine[]>([]);

  const [quantity, setQuantity] = useState("1");
  const [finalSellingPrice, setFinalSellingPrice] = useState(
    currentSellingPrice != null ? String(currentSellingPrice) : ""
  );
  const [paymentType, setPaymentType] = useState<"DIRECT" | "DOWNPAYMENT">("DIRECT");
  const [downPaymentAmount, setDownPaymentAmount] = useState("");
  const [purchaseChannel, setPurchaseChannel] = useState<"PERSONAL" | "LEASING">("PERSONAL");
  const [leasingCompanyId, setLeasingCompanyId] = useState<number | "">("");
  const [leasingDownPaymentAmount, setLeasingDownPaymentAmount] = useState("");
  const [hasRegistrationFee, setHasRegistrationFee] = useState(false);
  const [registrationFeeAmount, setRegistrationFeeAmount] = useState("");
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

  const availableBikeOptions = useMemo(
    () => bikeOptions.filter((bike) => bike.status === "available"),
    [bikeOptions]
  );

  const bikeGroupOptions = useMemo(() => {
    const map = new Map<string, { brandName: string; modelName: string; availableCount: number; defaultPrice?: number | null }>();
    availableBikeOptions.forEach((bike) => {
      const key = `${bike.brand.name}__${bike.model.name}`;
      const current = map.get(key);
      if (current) {
        current.availableCount += 1;
      } else {
        map.set(key, {
          brandName: bike.brand.name,
          modelName: bike.model.name,
          availableCount: 1,
          defaultPrice: bike.sellingPrice,
        });
      }
    });
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [availableBikeOptions]);

  const selectedSingleBike = useMemo(
    () => availableBikeOptions.find((bike) => bike.id === selectedBikeId),
    [availableBikeOptions, selectedBikeId]
  );

  const bulkTotal = useMemo(
    () => bulkLines.reduce((sum, line) => sum + line.subtotal, 0),
    [bulkLines]
  );

  const bulkRegistrationFeeTotal = useMemo(
    () => bulkLines.reduce((sum, line) => sum + line.registrationFeeSubtotal, 0),
    [bulkLines]
  );

  const computedInvoiceTotal = useMemo(() => {
    if (itemType === "BIKE") {
      if (purchaseMode === "BULK") return bulkTotal;
      const parsed = Number(finalSellingPrice);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }
    const parsed = Number(finalSellingPrice);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [bulkTotal, finalSellingPrice, itemType, purchaseMode]);

  const computedRegistrationTotal = useMemo(() => {
    if (itemType !== "BIKE") return 0;
    if (purchaseMode === "BULK") return bulkRegistrationFeeTotal;
    if (!hasRegistrationFee) return 0;
    const parsed = Number(registrationFeeAmount || "0");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [bulkRegistrationFeeTotal, hasRegistrationFee, itemType, purchaseMode, registrationFeeAmount]);

  const computedInvoiceGrandTotal = useMemo(
    () => computedInvoiceTotal + computedRegistrationTotal + extraCosts.reduce((sum, cost) => sum + cost.amount, 0),
    [computedInvoiceTotal, computedRegistrationTotal, extraCosts]
  );

  const computedExtraCostsTotal = useMemo(
    () => roundCurrency(extraCosts.reduce((sum, cost) => sum + cost.amount, 0)),
    [extraCosts]
  );

  const parsedDownPayment = Number(downPaymentAmount || "0");
  const parsedLeasingDownPayment = Number(leasingDownPaymentAmount || "0");
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

  const computedDownPayment = purchaseChannel === "LEASING"
    ? (Number.isFinite(parsedLeasingDownPayment) && parsedLeasingDownPayment >= 0 ? parsedLeasingDownPayment : 0)
    : (paymentType === "DIRECT"
      ? computedInvoiceTotal
      : (Number.isFinite(parsedDownPayment) && parsedDownPayment >= 0 ? parsedDownPayment : 0));
  const computedRemaining = Math.max(0, Math.round((effectiveTotal - computedDownPayment) * 100) / 100);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const requests: Array<Promise<Response>> = [
          fetch(`${base}?page=1&limit=500`, { headers: auth, cache: "no-store" }),
          fetch(`${base}/meta/provinces`, { headers: auth, cache: "no-store" }),
          fetch(`${base}/leasing-companies`, { headers: auth, cache: "no-store" }),
        ];
        if (itemType === "BIKE") {
          requests.push(fetch(`${API_URL}/api/pos/bike-management/vehicles?page=1&limit=5000&status=available`, { headers: auth, cache: "no-store" }));
        }

        const responses = await Promise.all(requests);
        const usersRes = responses[0];
        const provincesRes = responses[1];
        const leasingCompaniesRes = responses[2];
        const bikesRes = itemType === "BIKE" ? responses[3] : null;

        const usersJson = (await usersRes.json()) as { data?: { users?: PosUser[] }; message?: string };
        const provincesJson = (await provincesRes.json()) as { data?: { provinces?: ProvinceMeta[] }; message?: string };
        const leasingCompaniesJson = (await leasingCompaniesRes.json()) as { data?: { companies?: LeasingCompanyOption[] }; message?: string };
        const bikesJson = bikesRes
          ? (await bikesRes.json()) as { data?: { vehicles?: BikeOption[] }; message?: string }
          : null;

        if (!usersRes.ok) throw new Error(usersJson.message ?? "Failed to load users");
        if (!provincesRes.ok) throw new Error(provincesJson.message ?? "Failed to load provinces");
        if (!leasingCompaniesRes.ok) throw new Error(leasingCompaniesJson.message ?? "Failed to load leasing companies");
        if (bikesRes && !bikesRes.ok) throw new Error(bikesJson?.message ?? "Failed to load bikes");

        setUsers(usersJson.data?.users ?? []);
        setProvinces(provincesJson.data?.provinces ?? []);
        setLeasingCompanies(leasingCompaniesJson.data?.companies ?? []);
        if (bikesJson) {
          const loadedBikes = bikesJson.data?.vehicles ?? [];
          setBikeOptions(loadedBikes);
          const selected = loadedBikes.find((bike) => bike.id === itemId) ?? loadedBikes[0];
          if (selected) {
            setSelectedBikeId(selected.id);
            if (selected.sellingPrice != null) {
              setFinalSellingPrice(String(selected.sellingPrice));
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load customer data");
      } finally {
        setLoading(false);
      }
    })();
  }, [auth, base, itemId, itemType]);

  useEffect(() => {
    if (itemType !== "BIKE") return;
    if (!selectedSingleBike) return;
    if (selectedSingleBike.sellingPrice != null) {
      setFinalSellingPrice(String(selectedSingleBike.sellingPrice));
    }
  }, [itemType, selectedSingleBike]);

  useEffect(() => {
    if (purchaseChannel !== "LEASING" && paymentType === "DIRECT") {
      setDownPaymentAmount(String(computedInvoiceTotal));
    }
  }, [computedInvoiceTotal, paymentType, purchaseChannel]);

  const addBulkLine = () => {
    if (!bulkBrandModelKey) {
      setError("Please select a brand and model");
      return;
    }
    const qty = Number(bulkCount);
    const unitPrice = Number(bulkUnitPrice);
    const parsedRegistrationFee = Number(bulkRegistrationFeeAmount || "0");
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Please enter a valid bike count");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("Please enter a valid allocated price");
      return;
    }
    if (bulkHasRegistrationFee && (!Number.isFinite(parsedRegistrationFee) || parsedRegistrationFee <= 0)) {
      setError("Please enter a valid registration fee amount");
      return;
    }

    const [brandName, modelName] = bulkBrandModelKey.split("__");
    const usedBikeIds = new Set(bulkLines.flatMap((line) => line.bikeIds));
    const matching = availableBikeOptions.filter((bike) => bike.brand.name === brandName && bike.model.name === modelName && !usedBikeIds.has(bike.id));

    if (matching.length < qty) {
      setError(`Only ${matching.length} bike(s) available for ${brandName} ${modelName}`);
      return;
    }

    const selectedBikes = matching.slice(0, qty);
    const subtotal = Math.round(unitPrice * qty * 100) / 100;
    const registrationFeeAmount = bulkHasRegistrationFee ? Math.round(parsedRegistrationFee * 100) / 100 : 0;
    const registrationFeeSubtotal = Math.round(registrationFeeAmount * qty * 100) / 100;
    const key = `${brandName}__${modelName}__${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setBulkLines((prev) => [
      ...prev,
      {
        key,
        brandName,
        modelName,
        unitPrice,
        quantity: qty,
        subtotal,
        hasRegistrationFee: bulkHasRegistrationFee,
        registrationFeeAmount,
        registrationFeeSubtotal,
        bikeIds: selectedBikes.map((bike) => bike.id),
      },
    ]);
    setError(null);
  };

  const removeBulkLine = (key: string) => {
    setBulkLines((prev) => prev.filter((line) => line.key !== key));
  };

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

  const allocateDownPayments = (lineItems: Array<{ bikeId: number; unitPrice: number }>, totalDownPayment: number) => {
    if (lineItems.length === 0) return [] as Array<{ bikeId: number; unitPrice: number; downPayment: number }>;
    const totalPrice = lineItems.reduce((sum, item) => sum + item.unitPrice, 0);
    const targetCents = Math.round(totalDownPayment * 100);

    if (totalPrice <= 0) {
      const base = Math.floor(targetCents / lineItems.length);
      const remainder = targetCents % lineItems.length;
      return lineItems.map((item, index) => ({
        ...item,
        downPayment: (base + (index < remainder ? 1 : 0)) / 100,
      }));
    }

    const provisional = lineItems.map((item, index) => {
      const raw = (targetCents * item.unitPrice) / totalPrice;
      const floor = Math.floor(raw);
      return { index, floor, fraction: raw - floor };
    });
    let allocated = provisional.reduce((sum, item) => sum + item.floor, 0);
    let remaining = targetCents - allocated;

    provisional.sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < provisional.length && remaining > 0; i += 1) {
      provisional[i].floor += 1;
      remaining -= 1;
    }

    const centsByIndex = new Map<number, number>(provisional.map((item) => [item.index, item.floor]));
    return lineItems.map((item, index) => ({
      ...item,
      downPayment: (centsByIndex.get(index) ?? 0) / 100,
    }));
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
        dreamBikeIds: [],
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

      if ((itemType === "BIKE" || itemType === "PRE_ORDER") && purchaseChannel === "LEASING") {
        const parsedLeasingDownPayment = Number(leasingDownPaymentAmount || "0");
        if (leasingCompanyId === "") {
          throw new Error("Please select a leasing company");
        }
        if (
          !Number.isFinite(parsedLeasingDownPayment) ||
          parsedLeasingDownPayment < 0 ||
          (itemType === "BIKE" && parsedLeasingDownPayment <= 0)
        ) {
          throw new Error(
            itemType === "BIKE"
              ? "Please enter a leasing advance payment greater than 0"
              : "Please enter a valid leasing downpayment amount",
          );
        }
        if (parsedLeasingDownPayment >= computedInvoiceTotal) {
          throw new Error("Leasing advance payment must be less than the total invoice amount");
        }
      }

      if (itemType === "CUSTOM" && !customDescription.trim()) {
        throw new Error("Please enter a description for the custom invoice");
      }

      if (purchaseChannel !== "LEASING" && paymentType === "DOWNPAYMENT") {
        if (!Number.isFinite(parsedDownPayment) || parsedDownPayment <= 0) {
          throw new Error("Please enter a valid downpayment amount");
        }
        if (
          parsedDownPayment > computedInvoiceTotal ||
          (itemType === "BIKE" && parsedDownPayment >= computedInvoiceTotal)
        ) {
          throw new Error(
            itemType === "BIKE"
              ? "Advance payment must be less than the total invoice amount"
              : "Downpayment amount cannot exceed total invoice amount",
          );
        }
      }

      if (itemType === "BIKE" && purchaseMode === "SINGLE") {
        if (!selectedBikeId) {
          throw new Error("Please select a bike");
        }
        if (!Number.isFinite(parsedFinalPrice) || parsedFinalPrice < 0) {
          throw new Error("Please enter a valid final selling price");
        }
        const parsedRegistrationFee = Number(registrationFeeAmount || "0");
        if (hasRegistrationFee && (!Number.isFinite(parsedRegistrationFee) || parsedRegistrationFee <= 0)) {
          throw new Error("Please enter a valid registration fee amount");
        }
      }

      if (itemType === "BIKE" && purchaseMode === "BULK") {
        if (bulkLines.length === 0) {
          throw new Error("Please add at least one bulk bike line");
        }

        const invoiceGroupCode = `BULK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const lineItems = bulkLines.flatMap((line) => line.bikeIds.map((bikeId) => ({ bikeId, unitPrice: line.unitPrice })));
        const effectiveLeasingDownPayment = Number(leasingDownPaymentAmount || "0");
        const effectiveDownPayment = purchaseChannel === "LEASING"
          ? effectiveLeasingDownPayment
          : (paymentType === "DIRECT" ? bulkTotal : parsedDownPayment);
        const allocation = allocateDownPayments(lineItems, effectiveDownPayment);

        for (const [allocationIndex, allocated] of allocation.entries()) {
          const response = await fetch(`${base}/${resolvedUserId}/purchases`, {
            method: "POST",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify({
              purchaseType: "BIKE",
              purchaseMode: "BULK",
              invoiceGroupCode,
              bikeVehicleId: allocated.bikeId,
              finalSellingPrice: allocated.unitPrice,
              purchaseChannel,
              leasingCompanyId: purchaseChannel === "LEASING" ? leasingCompanyId : undefined,
              leasingDownPaymentAmount: purchaseChannel === "LEASING" ? allocated.downPayment : undefined,
              paymentType: purchaseChannel === "LEASING" ? "DIRECT" : paymentType,
              downPaymentAmount: purchaseChannel === "LEASING"
                ? undefined
                : (paymentType === "DOWNPAYMENT" ? allocated.downPayment : undefined),
              hasRegistrationFee: bulkLines.find((line) => line.bikeIds.includes(allocated.bikeId))?.hasRegistrationFee ?? false,
              registrationFeeAmount: bulkLines.find((line) => line.bikeIds.includes(allocated.bikeId))?.registrationFeeAmount ?? 0,
              extraCosts: allocationIndex === 0
                ? extraCosts.map(({ label, amount }) => ({ label, amount }))
                : [],
            }),
          });

          const payload = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(payload.message ?? "Failed to create bulk purchase");
          }
        }

        onSaved();
        onClose();
        return;
      }

      if (itemType !== "BIKE" && (!Number.isFinite(parsedFinalPrice) || parsedFinalPrice < 0)) {
        throw new Error("Please enter a valid final selling price");
      }

      const response = await fetch(`${base}/${resolvedUserId}/purchases`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: itemType,
          purchaseMode: "SINGLE",
          bikeVehicleId: itemType === "BIKE" ? selectedBikeId : undefined,
          inventoryProductId: itemType === "INVENTORY" ? itemId : undefined,
          preOrderId: itemType === "PRE_ORDER" ? itemId : undefined,
          customCategory: itemType === "CUSTOM"
            ? (customCategory === "Other" ? customCategoryOther.trim() || "Miscellaneous" : customCategory)
            : undefined,
          customDescription: itemType === "CUSTOM" ? customDescription.trim() : undefined,
          quantity: itemType === "INVENTORY" ? parsedQty : undefined,
          finalSellingPrice: parsedFinalPrice,
          purchaseChannel: (itemType === "BIKE" || itemType === "PRE_ORDER") ? purchaseChannel : "PERSONAL",
          leasingCompanyId: (itemType === "BIKE" || itemType === "PRE_ORDER") && purchaseChannel === "LEASING" ? leasingCompanyId : undefined,
          leasingDownPaymentAmount: (itemType === "BIKE" || itemType === "PRE_ORDER") && purchaseChannel === "LEASING"
            ? Number(leasingDownPaymentAmount || "0")
            : undefined,
          paymentType: (itemType === "BIKE" || itemType === "PRE_ORDER") && purchaseChannel === "LEASING" ? "DIRECT" : paymentType,
          downPaymentAmount: (itemType === "BIKE" || itemType === "PRE_ORDER") && purchaseChannel === "LEASING"
            ? undefined
            : (paymentType === "DOWNPAYMENT" ? parsedDownPayment : undefined),
          hasRegistrationFee: itemType === "BIKE" ? hasRegistrationFee : false,
          registrationFeeAmount: itemType === "BIKE" && hasRegistrationFee ? Number(registrationFeeAmount || "0") : undefined,
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
        <h3 className="bm-modal-title">{itemType === "CUSTOM" ? "Generate Custom Invoice" : "Sell To Customer"}</h3>

        {error && <div className="bm-alert bm-alert-error">{error}</div>}
        {loading && <p className="users-muted">Loading users...</p>}

        {!loading && (
          <>
            <div className="users-form-grid">
              <div className="bm-field-group users-span-2">
                <label>Item</label>
                <input className="bm-input" value={itemLabel} readOnly />
              </div>

              {itemType === "BIKE" && (
                <div className="bm-field-group users-span-2">
                  <label>Purchase Option</label>
                  <select
                    className="bm-input"
                    value={purchaseMode}
                    onChange={(event) => {
                      const mode = event.target.value as "SINGLE" | "BULK";
                      setPurchaseMode(mode);
                      setError(null);
                    }}
                  >
                    <option value="SINGLE">Single Purchase</option>
                    <option value="BULK">Bulk Purchase</option>
                  </select>
                </div>
              )}

              <div className="bm-field-group users-span-2">
                <label>Select Existing Customer</label>
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
                    <option value="">Select customer</option>
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

              {itemType === "BIKE" && purchaseMode === "SINGLE" && (
                <div className="bm-field-group users-span-2">
                  <label>Select Bike</label>
                  <select
                    className="bm-input"
                    value={selectedBikeId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedBikeId(value ? Number(value) : "");
                    }}
                    required
                  >
                    <option value="">Select available bike</option>
                    {availableBikeOptions.map((bike) => (
                      <option key={bike.id} value={bike.id}>
                        {bike.displayId} | {bike.brand.name} {bike.model.name} ({bike.colour})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {itemType === "BIKE" && purchaseMode === "BULK" && (
                <>
                  <div className="bm-field-group">
                    <label>Brand + Model</label>
                    <select className="bm-input" value={bulkBrandModelKey} onChange={(event) => setBulkBrandModelKey(event.target.value)}>
                      <option value="">Select brand and model</option>
                      {bikeGroupOptions.map((group) => (
                        <option key={group.key} value={group.key}>
                          {group.brandName} {group.modelName} (Available: {group.availableCount})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bm-field-group">
                    <label>Bike Count</label>
                    <input className="bm-input" type="number" min={1} value={bulkCount} onChange={(event) => setBulkCount(event.target.value)} />
                  </div>
                  <div className="bm-field-group">
                    <label>Allocated Price (Per Bike)</label>
                    <input className="bm-input" type="number" min={0} step="0.01" value={bulkUnitPrice} onChange={(event) => setBulkUnitPrice(event.target.value)} />
                  </div>
                  <div className="bm-field-group">
                    <label>Registration Needed</label>
                    <select className="bm-input" value={bulkHasRegistrationFee ? "yes" : "no"} onChange={(event) => setBulkHasRegistrationFee(event.target.value === "yes")}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="bm-field-group">
                    <label>Registration Fee (Per Bike)</label>
                    <input className="bm-input" type="number" min={0} step="0.01" value={bulkRegistrationFeeAmount} onChange={(event) => setBulkRegistrationFeeAmount(event.target.value)} disabled={!bulkHasRegistrationFee} />
                  </div>
                  <div className="bm-field-group" style={{ display: "flex", alignItems: "end" }}>
                    <button type="button" className="btn-accent" onClick={addBulkLine}>Apply</button>
                  </div>

                  <div className="bm-field-group users-span-2">
                    <label>Added Bike List</label>
                    {bulkLines.length === 0 && <div className="users-muted">No bulk lines added yet.</div>}
                    {bulkLines.length > 0 && (
                      <div className="data-table-wrap" style={{ marginTop: 8 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Brand</th>
                              <th>Model</th>
                              <th>Count</th>
                              <th>Allocated Price</th>
                              <th>Reg Fee</th>
                              <th>Subtotal</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkLines.map((line) => (
                              <tr key={line.key}>
                                <td>{line.brandName}</td>
                                <td>{line.modelName}</td>
                                <td>{line.quantity}</td>
                                <td>Rs. {line.unitPrice.toLocaleString()}</td>
                                <td>{line.hasRegistrationFee ? `Rs. ${line.registrationFeeSubtotal.toLocaleString()}` : "-"}</td>
                                <td>Rs. {line.subtotal.toLocaleString()}</td>
                                <td><button type="button" className="btn-outline" onClick={() => removeBulkLine(line.key)}>Remove</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                  value={itemType === "BIKE" && purchaseMode === "BULK"
                    ? `Rs. ${bulkTotal.toLocaleString()}`
                    : currentSellingPrice != null ? `Rs. ${currentSellingPrice.toLocaleString()}` : "Not set"}
                  readOnly
                />
              </div>

              {(itemType !== "BIKE" || purchaseMode === "SINGLE") && (
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
              )}

              {itemType === "BIKE" && purchaseMode === "SINGLE" && (
                <>
                  <div className="bm-field-group">
                    <label>Registration Needed</label>
                    <select
                      className="bm-input"
                      value={hasRegistrationFee ? "yes" : "no"}
                      onChange={(event) => setHasRegistrationFee(event.target.value === "yes")}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="bm-field-group">
                    <label>Registration Fee</label>
                    <input
                      className="bm-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={registrationFeeAmount}
                      onChange={(event) => setRegistrationFeeAmount(event.target.value)}
                      disabled={!hasRegistrationFee}
                    />
                  </div>
                </>
              )}

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

              {(itemType === "BIKE" || itemType === "PRE_ORDER") && (
                <>
                  <div className="bm-field-group">
                    <label>Selling Option</label>
                    <select className="bm-input" value={purchaseChannel} onChange={(event) => setPurchaseChannel(event.target.value as "PERSONAL" | "LEASING") }>
                      <option value="PERSONAL">Full / Advance Payment</option>
                      <option value="LEASING">Leasing Downpayment</option>
                    </select>
                  </div>

                  {purchaseChannel === "PERSONAL" && (
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
                          <option value="DIRECT">Full Payment</option>
                          <option value="DOWNPAYMENT">Advance Payment</option>
                        </select>
                      </div>

                      <div className="bm-field-group">
                        <label>{itemType === "BIKE" ? "Advance Payment" : "Downpayment Amount"}</label>
                        <input
                          className="bm-input"
                          type="number"
                          min={itemType === "BIKE" ? 0.01 : 0}
                          step="0.01"
                          value={downPaymentAmount}
                          onChange={(event) => setDownPaymentAmount(event.target.value)}
                          disabled={paymentType === "DIRECT"}
                          required={paymentType === "DOWNPAYMENT"}
                        />
                      </div>

                      {paymentType === "DOWNPAYMENT" && itemType !== "BIKE" && (
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

                  {purchaseChannel === "LEASING" && (
                    <>
                      <div className="bm-field-group">
                        <label>Select Leasing Partner</label>
                        <select
                          className="bm-input"
                          value={leasingCompanyId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLeasingCompanyId(value ? Number(value) : "");
                          }}
                          required
                        >
                          <option value="">Select leasing company</option>
                          {leasingCompanies.map((company) => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="bm-field-group">
                        <label>Leasing Advance Payment</label>
                        <input
                          className="bm-input"
                          type="number"
                          min={itemType === "BIKE" ? 0.01 : 0}
                          step="0.01"
                          value={leasingDownPaymentAmount}
                          onChange={(event) => setLeasingDownPaymentAmount(event.target.value)}
                        />
                        <span className="users-muted">Complete the remaining balance from Users → View Orders → Settle.</span>
                      </div>
                    </>
                  )}
                </>
              )}

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

              {itemType === "BIKE" && (
                <div className="bm-field-group">
                  <label>Registration Total</label>
                  <input className="bm-input" value={`Rs. ${computedRegistrationTotal.toLocaleString()}`} readOnly />
                </div>
              )}

              {extraCosts.length > 0 && (
                <div className="bm-field-group">
                  <label>Extra Costs Total</label>
                  <input className="bm-input" value={`Rs. ${computedExtraCostsTotal.toLocaleString()}`} readOnly />
                </div>
              )}

              <div className="bm-field-group">
                <label>Grand Total{computedTotalWithInterest != null ? " (incl. finance charge)" : ""}</label>
                <input className="bm-input" value={`Rs. ${(computedTotalWithInterest != null ? computedTotalWithInterest + computedRegistrationTotal + computedExtraCostsTotal : computedInvoiceGrandTotal).toLocaleString()}`} readOnly />
              </div>

              <div className="bm-field-group">
                <label>Remaining To Settle</label>
                <input className="bm-input" value={`Rs. ${computedRemaining.toLocaleString()}`} readOnly />
              </div>
            </div>

            {purchaseMode === "SINGLE" && (
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
            )}

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
