"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdmin } from "../../components/AdminContext";
import { API_URL } from "../../lib/constants";
import { IconActivity, IconClock, IconInvoice, IconUsers } from "../../lib/icons";
import TablePagination, { paginateRows } from "../../components/TablePagination";

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
  createdAt: string;
  updatedAt: string;
};

type InstallmentPayment = {
  id: number;
  amount: number;
  penaltyAmount: number;
  note?: string | null;
  paidAt: string;
};

type Installment = {
  id: number;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  isPartial: boolean;
  penaltyRate: number;
  penaltyAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  settledAt?: string | null;
  payments?: InstallmentPayment[];
};

type PurchaseHistoryEntry = {
  id: number;
  purchasedAt: string;
  itemType: "INVENTORY" | "CUSTOM";
  purchaseMode?: "SINGLE" | "BULK";
  invoiceGroupCode?: string | null;
  quantity: number;
  currentSellingPrice?: number | null;
  finalSellingPrice: number;
  paymentType?: "DIRECT" | "DOWNPAYMENT";
  downPaymentAmount?: number;
  remainingAmount?: number;
  settlementStatus?: "SETTLED" | "TO_SETTLE";
  interestRate?: number | null;
  installmentMonths?: number | null;
  monthlyInstallmentAmount?: number | null;
  totalWithInterest?: number | null;
  customer: {
    id: number;
    firstName: string;
    lastName: string;
    nic: string;
    mobileNumber: string;
    address: string;
    province: string;
    district: string;
  };
  inventory?: {
    id: number;
    displayId: string;
    name: string;
    brand: string;
    category: string;
    supplier?: string | null;
    description?: string | null;
  } | null;
  customCategory?: string | null;
  customDescription?: string | null;
};

type PurchaseInvoiceRow = {
  key: string;
  representative: PurchaseHistoryEntry;
  purchasedAt: string;
  invoiceLabel: string;
  purchaseMode: "SINGLE" | "BULK";
  quantity: number;
  finalSellingPrice: number;
  remainingAmount: number;
  settlementStatus: "SETTLED" | "TO_SETTLE";
  paymentTypeText: string;
  statusText: string;
  itemTitle: string;
  itemSubtitle: string;
};

type PurchaseFormState = {
  inventoryProductId: number | "";
  quantity: string;
  finalSellingPrice: string;
  paymentType: "DIRECT" | "DOWNPAYMENT";
  downPaymentAmount: string;
};

type InventoryProductOption = {
  id: number;
  displayId: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  brand: { name: string };
  category: { name: string };
  supplier?: { name: string; code: string } | null;
  description?: string | null;
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

type UserFormField = keyof UserFormState;

const EMPTY_FORM: UserFormState = {
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

function formatMoneyInput(value: number) {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "";
}

export default function UsersPage() {
  const { token } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();

  const activeTab: "users" | "history" = pathname.startsWith("/dashboard/users/history") ? "history" : "users";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const [users, setUsers] = useState<PosUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(20);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [provinces, setProvinces] = useState<ProvinceMeta[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryProductOption[]>([]);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formFieldErrors, setFormFieldErrors] = useState<Partial<Record<UserFormField, string>>>({});
  const [formGeneralError, setFormGeneralError] = useState<string | null>(null);

  const [viewUser, setViewUser] = useState<PosUser | null>(null);
  const [purchaseUser, setPurchaseUser] = useState<PosUser | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>({
    inventoryProductId: "",
    quantity: "1",
    finalSellingPrice: "",
    paymentType: "DIRECT",
    downPaymentAmount: "",
  });
  const [purchaseProductDetail, setPurchaseProductDetail] = useState<InventoryProductOption | null>(null);
  const [purchaseLoadingProduct, setPurchaseLoadingProduct] = useState(false);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryEntry[]>([]);
  const [selectedHistoryPurchase, setSelectedHistoryPurchase] = useState<PurchaseHistoryEntry | null>(null);
  const [invoiceSourceEntries, setInvoiceSourceEntries] = useState<PurchaseHistoryEntry[] | null>(null);
  const [ordersUser, setOrdersUser] = useState<PosUser | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [orders, setOrders] = useState<PurchaseHistoryEntry[]>([]);
  const [settleTarget, setSettleTarget] = useState<PurchaseHistoryEntry | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleInstallments, setSettleInstallments] = useState<Installment[]>([]);
  const [settleInstallmentId, setSettleInstallmentId] = useState<number | "">("");
  const [settleIsPartial, setSettleIsPartial] = useState(false);
  const [settlePenaltyRate, setSettlePenaltyRate] = useState("");
  const [settleInstallmentsLoading, setSettleInstallmentsLoading] = useState(false);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<"CASH" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [settleChequeNo, setSettleChequeNo] = useState("");
  const [settleChequeBank, setSettleChequeBank] = useState("");
  const [settleChequeDate, setSettleChequeDate] = useState("");
  const [invoiceInstallments, setInvoiceInstallments] = useState<Installment[]>([]);

  const base = `${API_URL}/api/pos/user-management`;
  const inventoryManagementBase = `${API_URL}/api/pos/inventory-management`;
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const districtsForProvince = useMemo(
    () => provinces.find((province) => province.name === form.province)?.districts ?? [],
    [form.province, provinces]
  );

  const totalUsers = useMemo(() => users.length, [users]);

  const loadInitialData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const [usersRes, provincesRes, productsRes] = await Promise.all([
        fetch(`${base}?page=1&limit=200`, { headers: authHeader, cache: "no-store" }),
        fetch(`${base}/meta/provinces`, { headers: authHeader, cache: "no-store" }),
        fetch(`${inventoryManagementBase}/products?page=1&limit=500`, { headers: authHeader, cache: "no-store" }),
      ]);

      const usersJson = await usersRes.json() as { data?: { users?: PosUser[] }; message?: string };
      const provincesJson = await provincesRes.json() as { data?: { provinces?: ProvinceMeta[] }; message?: string };
      const productsJson = await productsRes.json() as { data?: { products?: InventoryProductOption[] }; message?: string };

      if (!usersRes.ok) throw new Error(usersJson.message ?? "Failed to load users");
      if (!provincesRes.ok) throw new Error(provincesJson.message ?? "Failed to load province data");
      if (!productsRes.ok) throw new Error(productsJson.message ?? "Failed to load inventory products");

      setUsers(usersJson.data?.users ?? []);
      setProvinces(provincesJson.data?.provinces ?? []);
      setInventoryOptions((productsJson.data?.products ?? []).filter((product) => product.quantity > 0));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load user management data";
      setError(message.includes("Route not found") ? `${message}. Restart backend and confirm /api/pos/user-management route is running.` : message);
    } finally {
      setLoading(false);
    }
  }, [authHeader, base, inventoryManagementBase, token]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const loadPurchaseHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const searchParam = historySearch.trim() ? `&search=${encodeURIComponent(historySearch.trim())}` : "";
      const response = await fetch(`${base}/purchases?page=1&limit=500${searchParam}`, {
        headers: authHeader,
        cache: "no-store",
      });
      const payload = await response.json() as { data?: { purchases?: PurchaseHistoryEntry[] }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load user history");
      setPurchaseHistory(payload.data?.purchases ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load user history");
    } finally {
      setHistoryLoading(false);
    }
  }, [authHeader, base, historySearch, token]);

  useEffect(() => {
    if (activeTab !== "history") return;
    void loadPurchaseHistory();
  }, [activeTab, loadPurchaseHistory]);

  const loadOrdersForUser = useCallback(async (userId: number, searchText = "") => {
    if (!token) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const searchParam = searchText.trim() ? `&search=${encodeURIComponent(searchText.trim())}` : "";
      const response = await fetch(`${base}/${userId}/purchases?page=1&limit=500${searchParam}`, {
        headers: authHeader,
        cache: "no-store",
      });
      const payload = await response.json() as { data?: { purchases?: PurchaseHistoryEntry[] }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load user orders");
      setOrders(payload.data?.purchases ?? []);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Failed to load user orders");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [authHeader, base, token]);

  const openOrdersModal = (user: PosUser) => {
    setOrdersUser(user);
    setOrdersSearch("");
    setOrdersError(null);
    setOrders([]);
    void loadOrdersForUser(user.id, "");
  };

  const closeOrdersModal = () => {
    setOrdersUser(null);
    setOrdersSearch("");
    setOrdersError(null);
    setOrders([]);
  };

  const openInvoiceModal = useCallback(async (entry: PurchaseHistoryEntry) => {
    setSelectedHistoryPurchase(entry);
    setInvoiceSourceEntries(null);
    setInvoiceInstallments([]);
    try {
      const [purchasesResp, installmentsResp] = await Promise.all([
        fetch(`${base}/${entry.customer.id}/purchases?page=1&limit=1000`, { headers: authHeader, cache: "no-store" }),
        (entry.installmentMonths ?? 0) > 0
          ? fetch(`${base}/${entry.customer.id}/purchases/${entry.id}/installments`, { headers: authHeader, cache: "no-store" })
          : Promise.resolve(null),
      ]);
      const purchasesPayload = await purchasesResp.json() as { data?: { purchases?: PurchaseHistoryEntry[] }; message?: string };
      if (!purchasesResp.ok) throw new Error(purchasesPayload.message ?? "Failed to load invoice details");
      setInvoiceSourceEntries(purchasesPayload.data?.purchases ?? []);

      if (installmentsResp) {
        const instPayload = await installmentsResp.json() as { data?: { installments?: Installment[] } };
        setInvoiceInstallments(instPayload.data?.installments ?? []);
      }
    } catch {
      setInvoiceSourceEntries(null);
    }
  }, [authHeader, base]);

  const closeInvoiceModal = () => {
    setSelectedHistoryPurchase(null);
    setInvoiceSourceEntries(null);
    setInvoiceInstallments([]);
  };

  const getPurchaseItemMeta = (entry: PurchaseHistoryEntry) => {
    if (entry.itemType === "INVENTORY" && entry.inventory) {
      return {
        title: entry.inventory.name,
        subtitle: `${entry.inventory.displayId} • ${entry.inventory.brand}`,
      };
    }
    if (entry.itemType === "CUSTOM") {
      return {
        title: entry.customCategory ?? "Custom Invoice",
        subtitle: entry.customDescription ?? "—",
      };
    }
    return { title: "Unknown item", subtitle: "-" };
  };

  const isDownPaymentEntry = (entry: PurchaseHistoryEntry) => {
    if (entry.paymentType === "DOWNPAYMENT") return true;
    const downPayment = entry.downPaymentAmount ?? 0;
    const remaining = entry.remainingAmount ?? 0;
    if (remaining > 0) return true;
    if (downPayment > 0 && downPayment < entry.finalSellingPrice) return true;
    const currentSellingPrice = entry.currentSellingPrice ?? 0;
    if (currentSellingPrice > 0 && entry.finalSellingPrice > 0 && entry.finalSellingPrice < currentSellingPrice * 0.7) return true;
    return false;
  };

  const getSettlementBadgeText = (entry: PurchaseHistoryEntry) => {
    if (isDownPaymentEntry(entry)) {
      return entry.settlementStatus === "TO_SETTLE"
        ? `Downpay • Settle Rs. ${(entry.remainingAmount ?? 0).toLocaleString()}`
        : "Downpay • Settled";
    }
    return "Direct • Settled";
  };

  const getPaymentTypeText = (entry: PurchaseHistoryEntry) => {
    return isDownPaymentEntry(entry) ? "Downpayment" : "Direct";
  };

  const buildInvoiceRows = useCallback((entries: PurchaseHistoryEntry[]): PurchaseInvoiceRow[] => {
    const grouped = new Map<string, PurchaseHistoryEntry[]>();

    for (const entry of entries) {
      const groupCode = entry.invoiceGroupCode?.trim();
      const key = groupCode
        ? `group:${entry.customer.id}:${groupCode}`
        : `single:${entry.id}`;
      const bucket = grouped.get(key);
      if (bucket) bucket.push(entry);
      else grouped.set(key, [entry]);
    }

    const rows = Array.from(grouped.entries()).map(([key, bucket]) => {
      const sorted = [...bucket].sort((a, b) => +new Date(b.purchasedAt) - +new Date(a.purchasedAt));
      const representative = sorted[0];
      const groupCode = representative.invoiceGroupCode?.trim();
      const isBulk = bucket.length > 1 || representative.purchaseMode === "BULK" || !!groupCode;
      const purchaseMode: "SINGLE" | "BULK" = isBulk ? "BULK" : "SINGLE";

      const quantity = bucket.reduce((sum, row) => sum + row.quantity, 0);
      const finalSellingPrice = bucket.reduce((sum, row) => sum + row.finalSellingPrice, 0);
      const remainingAmount = Math.max(0, Math.round(bucket.reduce((sum, row) => sum + (row.remainingAmount ?? 0), 0) * 100) / 100);
      const hasDownPayment = bucket.some((row) => isDownPaymentEntry(row));
      const settlementStatus: "SETTLED" | "TO_SETTLE" = remainingAmount > 0 || bucket.some((row) => row.settlementStatus === "TO_SETTLE")
        ? "TO_SETTLE"
        : "SETTLED";

      const paymentTypeText = getPaymentTypeText(representative);
      const statusText = hasDownPayment
        ? settlementStatus === "TO_SETTLE"
          ? `Downpay • Settle Rs. ${remainingAmount.toLocaleString()}`
          : "Downpay • Settled"
        : "Direct • Settled";

      const itemTitle = isBulk ? `Bulk Purchase (${bucket.length} items)` : getPurchaseItemMeta(representative).title;
      const itemSubtitle = isBulk
        ? bucket.slice(0, 2).map((row) => getPurchaseItemMeta(row).title).join(" + ")
        : getPurchaseItemMeta(representative).subtitle;

      return {
        key,
        representative,
        purchasedAt: representative.purchasedAt,
        invoiceLabel: groupCode || `INV-${String(representative.id).padStart(5, "0")}`,
        purchaseMode,
        quantity,
        finalSellingPrice,
        remainingAmount,
        settlementStatus,
        paymentTypeText,
        statusText,
        itemTitle,
        itemSubtitle,
      };
    });

    rows.sort((a, b) => +new Date(b.purchasedAt) - +new Date(a.purchasedAt));
    return rows;
  }, [getPurchaseItemMeta]);

  const historyInvoiceRows = useMemo(() => buildInvoiceRows(purchaseHistory), [buildInvoiceRows, purchaseHistory]);
  const filteredUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => [user.firstName, user.lastName, user.nic, user.mobileNumber, user.email, user.province, user.district]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [userSearch, users]);
  const pagedUsers = useMemo(() => paginateRows(filteredUsers, userPage, userPageSize), [filteredUsers, userPage, userPageSize]);
  const pagedHistoryRows = useMemo(() => paginateRows(historyInvoiceRows, historyPage, historyPageSize), [historyInvoiceRows, historyPage, historyPageSize]);
  useEffect(() => { setUserPage(1); }, [userSearch, userPageSize]);
  useEffect(() => { setHistoryPage(1); }, [historySearch, historyPageSize]);
  const orderInvoiceRows = useMemo(() => buildInvoiceRows(orders), [buildInvoiceRows, orders]);

  const getInvoiceRemaining = (entry: PurchaseHistoryEntry) => {
    const groupCode = entry.invoiceGroupCode?.trim();
    if (!groupCode) {
      return Math.max(0, Math.round(((entry.remainingAmount ?? 0)) * 100) / 100);
    }

    const merged = [...orders, ...purchaseHistory];
    let hasMatch = false;
    let total = 0;
    merged.forEach((row) => {
      if (row.customer.id === entry.customer.id && row.invoiceGroupCode === groupCode) {
        total += row.remainingAmount ?? 0;
        hasMatch = true;
      }
    });

    if (!hasMatch) {
      return Math.max(0, Math.round(((entry.remainingAmount ?? 0)) * 100) / 100);
    }
    return Math.max(0, Math.round(total * 100) / 100);
  };

  const openSettleModal = (entry: PurchaseHistoryEntry) => {
    const remaining = getInvoiceRemaining(entry);
    setSettleTarget(entry);
    setSettleAmount(remaining > 0 ? String(remaining) : "");
    setSettleError(null);
    setSettleInstallmentId("");
    setSettleIsPartial(false);
    setSettlePenaltyRate("");
    setSettleInstallments([]);
    setSettlePaymentMethod("CASH");
    setSettleChequeNo("");
    setSettleChequeBank("");
    setSettleChequeDate("");
    if ((entry.installmentMonths ?? 0) > 0) {
      setSettleInstallmentsLoading(true);
      void (async () => {
        try {
          const resp = await fetch(`${base}/${entry.customer.id}/purchases/${entry.id}/installments`, { headers: authHeader, cache: "no-store" });
          const json = await resp.json() as { data?: { installments?: Installment[] } };
          const loaded = json.data?.installments ?? [];
          setSettleInstallments(loaded);
          const nextPending = loaded.find((i) => i.status === "PENDING" || i.status === "PARTIAL");
          if (nextPending) {
            setSettleInstallmentId(nextPending.id);
            const balanceDue = Math.max(0, Math.round((nextPending.dueAmount + (nextPending.penaltyAmount ?? 0) - nextPending.paidAmount) * 100) / 100);
            setSettleAmount(String(balanceDue));
          }
        } catch { setSettleInstallments([]); }
        finally { setSettleInstallmentsLoading(false); }
      })();
    }
  };

  const closeSettleModal = () => {
    setSettleTarget(null);
    setSettleAmount("");
    setSettleError(null);
    setSettleSaving(false);
    setSettleInstallments([]);
    setSettleInstallmentId("");
    setSettleIsPartial(false);
    setSettlePenaltyRate("");
    setSettlePaymentMethod("CASH");
    setSettleChequeNo("");
    setSettleChequeBank("");
    setSettleChequeDate("");
  };

  const submitSettlePayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!settleTarget) return;

    const remaining = getInvoiceRemaining(settleTarget);
    const amount = Number(settleAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSettleError("Please enter a valid settle amount");
      return;
    }
    if (amount > remaining) {
      setSettleError(`Settle amount cannot exceed remaining amount (Rs. ${remaining.toLocaleString()})`);
      return;
    }

    setSettleSaving(true);
    setSettleError(null);
    try {
      const parsedPenaltyRate = Number(settlePenaltyRate || "0");
      const response = await fetch(`${base}/${settleTarget.customer.id}/purchases/${settleTarget.id}/settle`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          settlementMethod: "FULL_PAYMENT",
          installmentId: settleInstallmentId !== "" ? settleInstallmentId : undefined,
          isPartial: settleIsPartial || undefined,
          penaltyRate: settleIsPartial && parsedPenaltyRate > 0 ? parsedPenaltyRate : undefined,
          paymentMethod: settlePaymentMethod,
          chequeNo: settlePaymentMethod === "CHEQUE" ? settleChequeNo || undefined : undefined,
          chequeBank: settlePaymentMethod === "CHEQUE" ? settleChequeBank || undefined : undefined,
          chequeDate: settlePaymentMethod === "CHEQUE" ? settleChequeDate || undefined : undefined,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to settle amount");

      setSuccess("Remaining balance paid successfully");
      if (ordersUser) {
        await loadOrdersForUser(ordersUser.id, ordersSearch);
      }
      if (activeTab === "history") {
        await loadPurchaseHistory();
      }
      closeSettleModal();
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "Failed to settle amount");
    } finally {
      setSettleSaving(false);
    }
  };

  const ordersTotalValue = useMemo(
    () => orders.reduce((sum, order) => sum + order.finalSellingPrice, 0),
    [orders]
  );
  const ordersInventoryCount = useMemo(
    () => orders.filter((order) => order.itemType === "INVENTORY").length,
    [orders]
  );

  const purchaseInvoiceTotal = useMemo(() => {
    const value = Number(purchaseForm.finalSellingPrice);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [purchaseForm.finalSellingPrice]);

  const purchaseDownPaymentPreview = useMemo(() => {
    if (purchaseForm.paymentType === "DIRECT") return purchaseInvoiceTotal;
    const value = Number(purchaseForm.downPaymentAmount || "0");
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [purchaseForm.downPaymentAmount, purchaseForm.paymentType, purchaseInvoiceTotal]);

  const purchaseRemainingPreview = useMemo(
    () => Math.max(0, Math.round((purchaseInvoiceTotal - purchaseDownPaymentPreview) * 100) / 100),
    [purchaseDownPaymentPreview, purchaseInvoiceTotal]
  );

  const selectedInvoiceEntries = useMemo(() => {
    if (!selectedHistoryPurchase) return [] as PurchaseHistoryEntry[];
    const groupCode = selectedHistoryPurchase.invoiceGroupCode?.trim();
    const merged = invoiceSourceEntries && invoiceSourceEntries.length > 0
      ? invoiceSourceEntries
      : [...purchaseHistory, ...orders];
    const unique = new Map<number, PurchaseHistoryEntry>();

    if (groupCode) {
      merged.forEach((entry) => {
        if (entry.id === selectedHistoryPurchase.id || entry.invoiceGroupCode === groupCode) {
          unique.set(entry.id, entry);
        }
      });
      return Array.from(unique.values()).sort((left, right) => left.id - right.id);
    }

    return [selectedHistoryPurchase];
  }, [invoiceSourceEntries, orders, purchaseHistory, selectedHistoryPurchase]);

  const selectedInvoiceTotals = useMemo(() => {
    const entries = selectedInvoiceEntries;
    return {
      quantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      finalSellingPrice: entries.reduce((sum, entry) => sum + entry.finalSellingPrice, 0),
      downPaymentAmount: entries.reduce((sum, entry) => {
        const explicitDownPayment = entry.downPaymentAmount ?? 0;
        if (explicitDownPayment > 0) return sum + explicitDownPayment;
        if (!isDownPaymentEntry(entry)) return sum;
        const paidAmount = Math.max(0, entry.finalSellingPrice - (entry.remainingAmount ?? 0));
        return sum + paidAmount;
      }, 0),
      remainingAmount: entries.reduce((sum, entry) => sum + (entry.remainingAmount ?? 0), 0),
      settlementStatus: entries.some((entry) => entry.settlementStatus === "TO_SETTLE") ? "TO_SETTLE" : "SETTLED",
    };
  }, [selectedInvoiceEntries]);

  const selectedInvoicePaymentType = useMemo(
    () => (selectedInvoiceEntries.some((entry) => isDownPaymentEntry(entry)) ? "Downpayment" : "Direct"),
    [selectedInvoiceEntries]
  );

  const selectedInvoicePurchaseMode = useMemo(
    () => (selectedInvoiceEntries.length > 1 || selectedHistoryPurchase?.purchaseMode === "BULK" || !!selectedHistoryPurchase?.invoiceGroupCode ? "Bulk" : "Single"),
    [selectedHistoryPurchase?.invoiceGroupCode, selectedHistoryPurchase?.purchaseMode, selectedInvoiceEntries.length]
  );

  const selectedInvoiceDisplayCode = useMemo(() => {
    if (!selectedHistoryPurchase) return "";
    const explicitGroupCode = selectedHistoryPurchase.invoiceGroupCode?.trim();
    if (explicitGroupCode) return explicitGroupCode;
    if (selectedInvoiceEntries.length > 1) {
      const minId = selectedInvoiceEntries.reduce((min, entry) => Math.min(min, entry.id), selectedInvoiceEntries[0]?.id ?? selectedHistoryPurchase.id);
      return `BULK-${String(minId).padStart(5, "0")}`;
    }
    return `INV-${String(selectedHistoryPurchase.id).padStart(5, "0")}`;
  }, [selectedHistoryPurchase, selectedInvoiceEntries]);

  const selectedInvoiceCurrentSellingTotal = useMemo(
    () => selectedInvoiceEntries.reduce((sum, entry) => sum + (entry.currentSellingPrice ?? 0), 0),
    [selectedInvoiceEntries]
  );

  const isBulkInvoiceView = useMemo(
    () => {
      if (!selectedHistoryPurchase) return false;
      return selectedInvoiceEntries.length > 1 || selectedHistoryPurchase.purchaseMode === "BULK" || !!selectedHistoryPurchase.invoiceGroupCode;
    },
    [selectedHistoryPurchase, selectedInvoiceEntries.length]
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingUserId(null);
    setFormFieldErrors({});
    setFormGeneralError(null);
    setShowFormModal(false);
  };

  const openAddUserModal = () => {
    setError(null);
    setSuccess(null);
    setForm(EMPTY_FORM);
    setEditingUserId(null);
    setFormFieldErrors({});
    setFormGeneralError(null);
    setShowFormModal(true);
  };

  const handleProvinceChange = (province: string) => {
    const validDistricts = provinces.find((p) => p.name === province)?.districts ?? [];
    setForm((prev) => ({
      ...prev,
      province,
      district: validDistricts.includes(prev.district) ? prev.district : "",
    }));
    setFormFieldErrors((prev) => ({ ...prev, province: undefined, district: undefined }));
  };

  const handleSaveUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setFormFieldErrors({});
    setFormGeneralError(null);

    try {
      const payload = {
        ...form,
        email: form.email.trim() || undefined,
      };

      const url = editingUserId ? `${base}/${editingUserId}` : base;
      const method = editingUserId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json() as {
        message?: string;
        errors?: {
          formErrors?: string[];
          fieldErrors?: Record<string, string[]>;
        };
      };
      if (!response.ok) {
        const fieldErrors = json.errors?.fieldErrors ?? {};
        const mappedFieldErrors: Partial<Record<UserFormField, string>> = {};
        const knownFields: UserFormField[] = [
          "firstName",
          "lastName",
          "nic",
          "mobileNumber",
          "email",
          "province",
          "district",
          "address",
        ];

        for (const field of knownFields) {
          const messages = fieldErrors[field];
          if (Array.isArray(messages) && messages.length > 0) {
            mappedFieldErrors[field] = messages[0];
          }
        }

        setFormFieldErrors(mappedFieldErrors);
        setFormGeneralError(json.errors?.formErrors?.[0] ?? json.message ?? "Validation failed");
        return;
      }

      setSuccess(editingUserId ? "User updated successfully" : "User created successfully");
      resetForm();
      await loadInitialData();
    } catch (err) {
      setFormGeneralError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user: PosUser) => {
    setEditingUserId(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      nic: user.nic,
      mobileNumber: user.mobileNumber,
      email: user.email ?? "",
      province: user.province,
      district: user.district,
      address: user.address,
    });
    setFormFieldErrors({});
    setFormGeneralError(null);
    setShowFormModal(true);
  };

  const handleDelete = async (user: PosUser) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete user ${user.firstName} ${user.lastName}?`);
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${base}/${user.id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      const json = await response.json() as { message?: string };
      if (!response.ok) throw new Error(json.message ?? "Failed to delete user");
      setSuccess("User deleted successfully");
      await loadInitialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const openPurchaseModal = (user: PosUser) => {
    setPurchaseUser(user);
    setPurchaseForm({
      inventoryProductId: "",
      quantity: "1",
      finalSellingPrice: "",
      paymentType: "DIRECT",
      downPaymentAmount: "",
    });
    setPurchaseProductDetail(null);
    setPurchaseError(null);
  };

  const closePurchaseModal = () => {
    setPurchaseUser(null);
    setPurchaseForm({
      inventoryProductId: "",
      quantity: "1",
      finalSellingPrice: "",
      paymentType: "DIRECT",
      downPaymentAmount: "",
    });
    setPurchaseProductDetail(null);
    setPurchaseError(null);
  };

  const loadPurchaseProductDetail = async (productId: number) => {
    setPurchaseLoadingProduct(true);
    setPurchaseError(null);
    try {
      const response = await fetch(`${inventoryManagementBase}/products/${productId}`, { headers: authHeader });
      const payload = await response.json() as { data?: InventoryProductOption; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load product details");
      const detail = payload.data as InventoryProductOption;
      setPurchaseProductDetail(detail);
      setPurchaseForm((prev) => ({
        ...prev,
        finalSellingPrice: detail.sellingPrice != null
          ? formatMoneyInput(detail.sellingPrice * parsePositiveInt(prev.quantity, 1))
          : prev.finalSellingPrice,
      }));
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Failed to load product details");
      setPurchaseProductDetail(null);
    } finally {
      setPurchaseLoadingProduct(false);
    }
  };

  const handlePurchaseSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!purchaseUser) return;
    if (purchaseForm.inventoryProductId === "") {
      setPurchaseError("Please select an inventory product");
      return;
    }

    const quantity = Number(purchaseForm.quantity || "1");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPurchaseError("Please enter a valid quantity");
      return;
    }

    const finalPrice = Number(purchaseForm.finalSellingPrice);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      setPurchaseError("Please enter a valid final selling price");
      return;
    }

    const downPayment = Number(purchaseForm.downPaymentAmount || "0");
    if (purchaseForm.paymentType === "DOWNPAYMENT") {
      if (!Number.isFinite(downPayment) || downPayment <= 0) {
        setPurchaseError("Please enter a valid downpayment amount");
        return;
      }
      if (downPayment > finalPrice) {
        setPurchaseError("Downpayment amount cannot exceed final selling price");
        return;
      }
    }

    setPurchaseSaving(true);
    setPurchaseError(null);
    try {
      const response = await fetch(`${base}/${purchaseUser.id}/purchases`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: "INVENTORY",
          purchaseMode: "SINGLE",
          inventoryProductId: purchaseForm.inventoryProductId,
          quantity,
          finalSellingPrice: finalPrice,
          paymentType: purchaseForm.paymentType,
          downPaymentAmount: purchaseForm.paymentType === "DOWNPAYMENT" ? downPayment : undefined,
        }),
      });

      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to create purchase");

      setSuccess("Purchase created successfully");
      closePurchaseModal();
      await loadInitialData();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Failed to create purchase");
    } finally {
      setPurchaseSaving(false);
    }
  };

  return (
    <div className="bm-page">
      <div className="bm-page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><IconUsers /></div>
          <div>
            <h2 className="page-title">Customer Directory</h2>
            <p className="page-subtitle">Register customers for quick lookup, receipts, and sales history.</p>
          </div>
        </div>
      </div>

      <div className="bm-manage-tabs">
        <button className={`bm-tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => router.push("/dashboard/users")}>Customers</button>
        <button className={`bm-tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => router.push("/dashboard/users/history")}>
          <IconClock />
          Sales History
        </button>
      </div>

      {error && !showFormModal && <div className="bm-alert bm-alert-error">{error}</div>}
      {success && <div className="bm-alert bm-alert-success">{success}</div>}

      <div className="bm-stats-grid" style={{ marginBottom: "1rem" }}>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconUsers /></span><span className="bm-stat-label">Total Users</span></div>
          <strong className="bm-stat-value">{totalUsers}</strong>
          <span className="bm-stat-sub">Registered user records</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconUsers /></span><span className="bm-stat-label">Customer Records</span></div>
          <strong className="bm-stat-value">{totalUsers}</strong>
          <span className="bm-stat-sub">Available for lookup at checkout</span>
        </div>
        <div className="bm-stat-card bm-stat-card-soft">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconInvoice /></span><span className="bm-stat-label">Contact Coverage</span></div>
          <strong className="bm-stat-value">{users.filter((user) => Boolean(user.mobileNumber)).length}</strong>
          <span className="bm-stat-sub">Customers with a phone number</span>
        </div>
        <div className="bm-stat-card">
          <div className="bm-stat-head"><span className="bm-stat-icon"><IconActivity /></span><span className="bm-stat-label">Sales Ready</span></div>
          <strong className="bm-stat-value">{users.length}</strong>
          <span className="bm-stat-sub">Customer profiles ready for checkout</span>
        </div>
      </div>

      {activeTab === "history" && (
        <div className="bm-table-card">
          <div className="users-history-toolbar">
            <h3 className="users-section-title" style={{ margin: 0 }}>User Purchase History</h3>
            <div className="users-history-toolbar-actions">
              <input
                className="bm-input"
                style={{ minWidth: 320 }}
                placeholder="Search by customer, NIC, product ID, brand or product name"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
              <button type="button" className="btn-outline" onClick={() => void loadPurchaseHistory()}>Refresh</button>
            </div>
          </div>

          {historyError && <div className="bm-alert bm-alert-error" style={{ margin: "1rem" }}>{historyError}</div>}

          <div className="data-table-wrap">
            <table className="data-table users-orders-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Final Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading && <tr><td colSpan={8} className="bm-table-empty">Loading purchase history...</td></tr>}
                {!historyLoading && historyInvoiceRows.length === 0 && <tr><td colSpan={8} className="bm-table-empty">No purchase history records found.</td></tr>}
                {!historyLoading && pagedHistoryRows.map((row) => (
                  <tr key={row.key}>
                    <td><span className="users-order-code">{row.invoiceLabel}</span></td>
                    <td>
                      <div className="users-order-date">{new Date(row.purchasedAt).toLocaleDateString()}</div>
                      <div className="users-order-time">{new Date(row.purchasedAt).toLocaleTimeString()}</div>
                    </td>
                    <td>
                      <div className="users-order-title">{row.representative.customer.firstName} {row.representative.customer.lastName}</div>
                      <span className="users-muted">{row.representative.customer.mobileNumber}</span>
                    </td>
                    <td>
                      <div className="users-order-title">{row.itemTitle}</div>
                      <span className="users-order-item-meta">{row.itemSubtitle}</span>
                      <span className="users-muted" style={{ display: "block" }}>{row.purchaseMode === "BULK" ? "Bulk" : "Single"} • {row.paymentTypeText}</span>
                    </td>
                    <td>{row.quantity}</td>
                    <td><span className="users-order-price">Rs. {row.finalSellingPrice.toLocaleString()}</span></td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className={`badge ${row.settlementStatus === "TO_SETTLE" ? "badge-pending" : "badge-active"}`}>
                          {row.statusText}
                        </span>
                        {(row.representative.installmentMonths ?? 0) > 0 && (() => {
                          const totalMonths = row.representative.installmentMonths!;
                          const monthly = row.representative.monthlyInstallmentAmount ?? 0;
                          const remaining = row.remainingAmount;
                          const isOverdue = remaining > 0 && new Date() > new Date(new Date(row.purchasedAt).setMonth(new Date(row.purchasedAt).getMonth() + 1));
                          const monthsRemaining = monthly > 0 ? Math.ceil(remaining / monthly) : 0;
                          const monthsPaid = totalMonths - monthsRemaining;
                          const color = remaining <= 0 ? "var(--green, #22c55e)" : isOverdue ? "var(--red, #ef4444)" : "var(--amber, #f59e0b)";
                          return (
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>
                              {monthsPaid > 0 ? `${monthsPaid}` : "0"}/{totalMonths} months paid
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn-outline" onClick={() => void openInvoiceModal(row.representative)}>View</button>
                        {row.remainingAmount > 0 && (
                          <button type="button" className="btn-accent" onClick={() => openSettleModal(row.representative)}>Settle</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination page={historyPage} pageSize={historyPageSize} total={historyInvoiceRows.length} onPageChange={setHistoryPage} onPageSizeChange={setHistoryPageSize} />
        </div>
      )}

      {activeTab === "users" && (
        <>
          <div className="bm-table-card">
            <div style={{ padding: "1rem", borderBottom: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <h3 className="users-section-title" style={{ margin: 0 }}>Customers</h3>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <input className="bm-input" style={{ minWidth: 280 }} type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name, NIC, mobile or location" />
                <button type="button" className="btn-accent" onClick={openAddUserModal}>Add Customer</button>
                <button type="button" className="btn-outline" onClick={() => void loadInitialData()}>Refresh</button>
              </div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>NIC</th>
                    <th>Mobile</th>
                    <th>Province / District</th>
                    <th>Customer Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={6} className="bm-table-empty">Loading users...</td></tr>}
                  {!loading && users.length === 0 && <tr><td colSpan={6} className="bm-table-empty">No users found.</td></tr>}
                  {!loading && pagedUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>{user.firstName} {user.lastName}</div>
                        <small className="users-muted">{user.email || "No email"}</small>
                      </td>
                      <td>{user.nic}</td>
                      <td>{user.mobileNumber}</td>
                      <td>{user.province} / {user.district}</td>
                        <td><span className="badge badge-active">Registered</span></td>
                      <td>
                        <div className="users-row-actions">
                          <button type="button" className="btn-outline" onClick={() => setViewUser(user)}>View</button>
                          <button type="button" className="btn-outline" onClick={() => openOrdersModal(user)}>View Orders</button>
                          <button type="button" className="btn-accent" onClick={() => openPurchaseModal(user)}>Purchase</button>
                          <button type="button" className="btn-outline" onClick={() => handleEdit(user)}>Edit</button>
                          <button type="button" className="bm-btn-danger" onClick={() => void handleDelete(user)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination page={userPage} pageSize={userPageSize} total={filteredUsers.length} onPageChange={setUserPage} onPageSizeChange={setUserPageSize} />
          </div>
        </>
      )}

      {showFormModal && (
        <div className="bm-modal-backdrop" onClick={resetForm}>
          <form onSubmit={handleSaveUser} className="bm-modal bm-modal-lg" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bm-modal-close" onClick={resetForm}>x</button>
            <h3 className="bm-modal-title">{editingUserId ? "Edit Customer" : "Register Customer"}</h3>
            {formGeneralError && <div className="bm-alert bm-alert-error">{formGeneralError}</div>}
            <div className="users-form-grid">
              <div className="bm-field-group">
                <label>First Name</label>
                <input className={`bm-input ${formFieldErrors.firstName ? "users-input-error" : ""}`} value={form.firstName} onChange={(e) => { setForm((prev) => ({ ...prev, firstName: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, firstName: undefined })); }} required />
                {formFieldErrors.firstName && <span className="users-field-error">{formFieldErrors.firstName}</span>}
              </div>
              <div className="bm-field-group">
                <label>Last Name</label>
                <input className={`bm-input ${formFieldErrors.lastName ? "users-input-error" : ""}`} value={form.lastName} onChange={(e) => { setForm((prev) => ({ ...prev, lastName: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, lastName: undefined })); }} required />
                {formFieldErrors.lastName && <span className="users-field-error">{formFieldErrors.lastName}</span>}
              </div>
              <div className="bm-field-group">
                <label>NIC</label>
                <input className={`bm-input ${formFieldErrors.nic ? "users-input-error" : ""}`} value={form.nic} onChange={(e) => { setForm((prev) => ({ ...prev, nic: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, nic: undefined })); }} required />
                {formFieldErrors.nic && <span className="users-field-error">{formFieldErrors.nic}</span>}
              </div>
              <div className="bm-field-group">
                <label>Mobile Number</label>
                <input className={`bm-input ${formFieldErrors.mobileNumber ? "users-input-error" : ""}`} value={form.mobileNumber} onChange={(e) => { setForm((prev) => ({ ...prev, mobileNumber: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, mobileNumber: undefined })); }} required />
                {formFieldErrors.mobileNumber && <span className="users-field-error">{formFieldErrors.mobileNumber}</span>}
              </div>
              <div className="bm-field-group">
                <label>Email (Optional)</label>
                <input type="email" className={`bm-input ${formFieldErrors.email ? "users-input-error" : ""}`} value={form.email} onChange={(e) => { setForm((prev) => ({ ...prev, email: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, email: undefined })); }} />
                {formFieldErrors.email && <span className="users-field-error">{formFieldErrors.email}</span>}
              </div>
              <div className="bm-field-group">
                <label>Province</label>
                <select className={`bm-input ${formFieldErrors.province ? "users-input-error" : ""}`} value={form.province} onChange={(e) => handleProvinceChange(e.target.value)} required>
                  <option value="">Select province</option>
                  {provinces.map((province) => <option key={province.name} value={province.name}>{province.name}</option>)}
                </select>
                {formFieldErrors.province && <span className="users-field-error">{formFieldErrors.province}</span>}
              </div>
              <div className="bm-field-group">
                <label>District</label>
                <select className={`bm-input ${formFieldErrors.district ? "users-input-error" : ""}`} value={form.district} onChange={(e) => { setForm((prev) => ({ ...prev, district: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, district: undefined })); }} required disabled={!form.province}>
                  <option value="">Select district</option>
                  {districtsForProvince.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
                {formFieldErrors.district && <span className="users-field-error">{formFieldErrors.district}</span>}
              </div>
              <div className="bm-field-group users-span-2">
                <label>Address</label>
                <textarea className={`bm-input users-textarea ${formFieldErrors.address ? "users-input-error" : ""}`} value={form.address} onChange={(e) => { setForm((prev) => ({ ...prev, address: e.target.value })); setFormFieldErrors((prev) => ({ ...prev, address: undefined })); }} required />
                {formFieldErrors.address && <span className="users-field-error">{formFieldErrors.address}</span>}
              </div>
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn-accent" disabled={saving}>{saving ? "Saving..." : editingUserId ? "Update Customer" : "Register Customer"}</button>
              <button type="button" className="btn-outline" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {viewUser && (
        <div className="bm-modal-backdrop" onClick={() => setViewUser(null)}>
          <div className="bm-modal bm-modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="bm-modal-close" onClick={() => setViewUser(null)}>x</button>
            <h3 className="bm-modal-title">{viewUser.firstName} {viewUser.lastName}</h3>
            <div className="users-view-grid">
              <div><strong>NIC:</strong> {viewUser.nic}</div>
              <div><strong>Mobile:</strong> {viewUser.mobileNumber}</div>
              <div><strong>Email:</strong> {viewUser.email || "No email"}</div>
              <div><strong>Province / District:</strong> {viewUser.province} / {viewUser.district}</div>
              <div className="users-span-2"><strong>Address:</strong> {viewUser.address}</div>
            </div>

            <p className="users-muted" style={{ marginTop: "1rem" }}>Customer profile available for lookup and sales history.</p>
          </div>
        </div>
      )}

      {purchaseUser && (
        <div className="bm-modal-backdrop" onClick={closePurchaseModal}>
          <form className="bm-modal bm-modal-lg" onClick={(e) => e.stopPropagation()} onSubmit={handlePurchaseSubmit}>
            <button type="button" className="bm-modal-close" onClick={closePurchaseModal}>x</button>
            <h3 className="bm-modal-title">Record Sale</h3>
            {purchaseError && <div className="bm-alert bm-alert-error">{purchaseError}</div>}

            <div className="users-view-grid" style={{ marginBottom: "1rem" }}>
              <div><strong>User:</strong> {purchaseUser.firstName} {purchaseUser.lastName}</div>
              <div><strong>NIC:</strong> {purchaseUser.nic}</div>
              <div><strong>Mobile:</strong> {purchaseUser.mobileNumber}</div>
              <div><strong>Province / District:</strong> {purchaseUser.province} / {purchaseUser.district}</div>
            </div>

            <div className="users-form-grid">
              <div className="bm-field-group users-span-2">
                <label>Select Inventory Product</label>
                <select
                  className="bm-input"
                  value={purchaseForm.inventoryProductId}
                  onChange={(e) => {
                    const value = e.target.value;
                    const inventoryProductId = value ? Number(value) : "";
                    setPurchaseForm((prev) => ({ ...prev, inventoryProductId }));
                    if (inventoryProductId !== "") {
                      void loadPurchaseProductDetail(inventoryProductId);
                    } else {
                      setPurchaseProductDetail(null);
                    }
                  }}
                  required
                >
                  <option value="">Select available inventory product</option>
                  {inventoryOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.displayId} | {product.name} ({product.brand.name}) - Stock {product.quantity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bm-field-group">
                <label>Quantity</label>
                <input
                  className="bm-input"
                  type="number"
                  min={1}
                  step={1}
                  value={purchaseForm.quantity}
                  onChange={(e) => {
                    const nextQuantityRaw = e.target.value;
                    setPurchaseForm((prev) => {
                      const oldQuantity = parsePositiveInt(prev.quantity, 1);
                      const nextQuantity = parsePositiveInt(nextQuantityRaw, oldQuantity);
                      const oldTotal = Number(prev.finalSellingPrice);
                      const fallbackUnitPrice = purchaseProductDetail?.sellingPrice ?? 0;
                      const inferredUnitPrice = Number.isFinite(oldTotal) && oldTotal > 0
                        ? oldTotal / oldQuantity
                        : fallbackUnitPrice;
                      const nextTotal = inferredUnitPrice > 0 ? inferredUnitPrice * nextQuantity : oldTotal;

                      return {
                        ...prev,
                        quantity: nextQuantityRaw,
                        finalSellingPrice: formatMoneyInput(nextTotal),
                      };
                    });
                  }}
                  required
                />
              </div>

              {purchaseLoadingProduct && <p className="users-muted">Loading selected item details...</p>}

              {purchaseProductDetail && (
                <>
                  <div className="bm-field-group"><label>Product</label><input className="bm-input" value={purchaseProductDetail.name} readOnly /></div>
                  <div className="bm-field-group"><label>Display ID</label><input className="bm-input" value={purchaseProductDetail.displayId} readOnly /></div>
                  <div className="bm-field-group"><label>Brand</label><input className="bm-input" value={purchaseProductDetail.brand.name} readOnly /></div>
                  <div className="bm-field-group"><label>Category</label><input className="bm-input" value={purchaseProductDetail.category.name} readOnly /></div>
                  <div className="bm-field-group"><label>Supplier</label><input className="bm-input" value={purchaseProductDetail.supplier ? `${purchaseProductDetail.supplier.name} (${purchaseProductDetail.supplier.code})` : "-"} readOnly /></div>
                  <div className="bm-field-group"><label>In Stock</label><input className="bm-input" value={String(purchaseProductDetail.quantity)} readOnly /></div>
                  <div className="bm-field-group users-span-2"><label>Description</label><textarea className="bm-input users-textarea" value={purchaseProductDetail.description ?? "-"} readOnly /></div>
                  <div className="bm-field-group"><label>Current Selling Price</label><input className="bm-input" value={purchaseProductDetail.sellingPrice != null ? `Rs. ${purchaseProductDetail.sellingPrice.toLocaleString()}` : "Not set"} readOnly /></div>
                </>
              )}

              <div className="bm-field-group users-span-2">
                <label>Final Selling Price (Keep or Change)</label>
                <input
                  className="bm-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseForm.finalSellingPrice}
                  onChange={(e) => setPurchaseForm((prev) => ({ ...prev, finalSellingPrice: e.target.value }))}
                  placeholder="Enter final selling price"
                  required
                />
              </div>

              <div className="bm-field-group">
                <label>Payment Type</label>
                <select
                  className="bm-input"
                  value={purchaseForm.paymentType}
                  onChange={(e) => {
                    const paymentType = e.target.value as "DIRECT" | "DOWNPAYMENT";
                    setPurchaseForm((prev) => ({
                      ...prev,
                      paymentType,
                      downPaymentAmount: paymentType === "DIRECT" ? String(purchaseInvoiceTotal) : prev.downPaymentAmount,
                    }));
                  }}
                >
                  <option value="DIRECT">Direct Buy</option>
                  <option value="DOWNPAYMENT">Downpayment</option>
                </select>
              </div>

              <div className="bm-field-group">
                <label>Downpayment Amount</label>
                <input
                  className="bm-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseForm.paymentType === "DIRECT" ? String(purchaseInvoiceTotal) : purchaseForm.downPaymentAmount}
                  onChange={(e) => setPurchaseForm((prev) => ({ ...prev, downPaymentAmount: e.target.value }))}
                  disabled={purchaseForm.paymentType === "DIRECT"}
                  required={purchaseForm.paymentType === "DOWNPAYMENT"}
                />
              </div>

              <div className="bm-field-group">
                <label>Invoice Total</label>
                <input className="bm-input" value={`Rs. ${purchaseInvoiceTotal.toLocaleString()}`} readOnly />
              </div>

              <div className="bm-field-group">
                <label>Remaining To Settle</label>
                <input className="bm-input" value={`Rs. ${purchaseRemainingPreview.toLocaleString()}`} readOnly />
                <span className="users-muted">Auto-calculated as invoice total - downpayment.</span>
              </div>
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn-accent" disabled={purchaseSaving}>{purchaseSaving ? "Saving..." : "Confirm Purchase"}</button>
              <button type="button" className="btn-outline" onClick={closePurchaseModal}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {ordersUser && (
        <div className="bm-modal-backdrop" onClick={closeOrdersModal}>
          <div className="bm-modal bm-view-modal users-orders-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="bm-modal-close" onClick={closeOrdersModal}>x</button>
            <h3 className="bm-modal-title">Orders - {ordersUser.firstName} {ordersUser.lastName}</h3>

            <div className="users-orders-summary">
              <div className="users-orders-summary-card">
                <span className="users-orders-summary-label">Total Orders</span>
                <strong>{orders.length}</strong>
              </div>
              <div className="users-orders-summary-card">
                <span className="users-orders-summary-label">Inventory Orders</span>
                <strong>{ordersInventoryCount}</strong>
              </div>
              <div className="users-orders-summary-card">
                <span className="users-orders-summary-label">Total Value</span>
                <strong>Rs. {ordersTotalValue.toLocaleString()}</strong>
              </div>
            </div>

            <div className="users-history-toolbar-actions" style={{ marginBottom: "0.5rem" }}>
              <input
                className="bm-input"
                style={{ minWidth: 280 }}
                placeholder="Search this user's orders"
                value={ordersSearch}
                onChange={(event) => setOrdersSearch(event.target.value)}
              />
              <button
                type="button"
                className="btn-outline"
                onClick={() => void loadOrdersForUser(ordersUser.id, ordersSearch)}
              >
                Search
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setOrdersSearch("");
                  void loadOrdersForUser(ordersUser.id, "");
                }}
              >
                Reset
              </button>
            </div>

            {ordersError && <div className="bm-alert bm-alert-error">{ordersError}</div>}

            <div className="data-table-wrap">
              <table className="data-table users-orders-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Final Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading && <tr><td colSpan={7} className="bm-table-empty">Loading orders...</td></tr>}
                  {!ordersLoading && orderInvoiceRows.length === 0 && <tr><td colSpan={7} className="bm-table-empty">No orders found for this user.</td></tr>}
                  {!ordersLoading && orderInvoiceRows.map((row) => (
                    <tr key={row.key}>
                      <td><span className="users-order-code">{row.invoiceLabel}</span></td>
                      <td>
                        <div className="users-order-date">{new Date(row.purchasedAt).toLocaleDateString()}</div>
                        <div className="users-order-time">{new Date(row.purchasedAt).toLocaleTimeString()}</div>
                      </td>
                      <td>
                        <div className="users-order-title">{row.itemTitle}</div>
                        <span className="users-order-item-meta">{row.itemSubtitle}</span>
                        <span className="users-muted" style={{ display: "block" }}>{row.purchaseMode === "BULK" ? "Bulk" : "Single"} • {row.paymentTypeText}</span>
                      </td>
                      <td>{row.quantity}</td>
                      <td><span className="users-order-price">Rs. {row.finalSellingPrice.toLocaleString()}</span></td>
                      <td>
                        <span className={`badge ${row.settlementStatus === "TO_SETTLE" ? "badge-pending" : "badge-active"}`}>
                          {row.statusText}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="btn-outline" onClick={() => void openInvoiceModal(row.representative)}>View</button>
                          {row.remainingAmount > 0 && (
                            <button type="button" className="btn-accent" onClick={() => openSettleModal(row.representative)}>Settle</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="btn-outline" onClick={closeOrdersModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedHistoryPurchase && (
        <div className="bm-modal-backdrop" onClick={closeInvoiceModal}>
          <div className="bm-modal bm-modal-lg" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="bm-modal-close" onClick={closeInvoiceModal}>x</button>
            <h3 className="bm-modal-title">
              Invoice {selectedInvoiceDisplayCode}
            </h3>
            <p className="users-muted" style={{ marginTop: "-0.5rem", marginBottom: "0.8rem" }}>
              {selectedInvoicePurchaseMode} Invoice • {selectedInvoicePaymentType}
            </p>

            <div className="users-view-grid">
              <div><strong>Date:</strong> {new Date(selectedHistoryPurchase.purchasedAt).toLocaleString()}</div>
              <div><strong>Customer:</strong> {selectedHistoryPurchase.customer.firstName} {selectedHistoryPurchase.customer.lastName}</div>
              <div><strong>NIC:</strong> {selectedHistoryPurchase.customer.nic}</div>
              <div><strong>Mobile:</strong> {selectedHistoryPurchase.customer.mobileNumber}</div>
              <div className="users-span-2"><strong>Address:</strong> {selectedHistoryPurchase.customer.address}, {selectedHistoryPurchase.customer.district}, {selectedHistoryPurchase.customer.province}</div>
            </div>

            {isBulkInvoiceView && (
              <>
                <h4 className="users-section-title" style={{ marginTop: "1rem" }}>Bulk Purchase Items</h4>
                <div className="data-table-wrap">
                  <table className="data-table users-orders-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Payment</th>
                        <th>Final Price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoiceEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="users-order-title">{getPurchaseItemMeta(entry).title}</div>
                            <span className="users-order-item-meta">{getPurchaseItemMeta(entry).subtitle}</span>
                          </td>
                          <td>{entry.quantity}</td>
                          <td>{getPaymentTypeText(entry)}</td>
                          <td>Rs. {entry.finalSellingPrice.toLocaleString()}</td>
                          <td>
                            {getSettlementBadgeText(entry)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.75rem" }}>
                  {selectedInvoiceEntries.map((entry) => (
                    <div key={`bulk-summary-card-${entry.id}`} className="bm-stat-card bm-stat-card-soft" style={{ padding: "0.7rem" }}>
                      <div className="users-order-title">{getPurchaseItemMeta(entry).title}</div>
                      <div className="users-order-item-meta">{getPurchaseItemMeta(entry).subtitle}</div>
                      <div className="users-muted" style={{ marginTop: "0.2rem" }}>
                        Qty: {entry.quantity} | Payment: {getPaymentTypeText(entry)} | Final: Rs. {entry.finalSellingPrice.toLocaleString()} | {getSettlementBadgeText(entry)}
                      </div>
                    </div>
                  ))}
                </div>

              </>
            )}

            {!isBulkInvoiceView && selectedHistoryPurchase.itemType === "INVENTORY" && selectedHistoryPurchase.inventory && (
              <>
                <h4 className="users-section-title" style={{ marginTop: "1rem" }}>Bought Inventory Details</h4>
                <div className="users-view-grid">
                  <div><strong>Product ID:</strong> {selectedHistoryPurchase.inventory.displayId}</div>
                  <div><strong>Product:</strong> {selectedHistoryPurchase.inventory.name}</div>
                  <div><strong>Brand:</strong> {selectedHistoryPurchase.inventory.brand}</div>
                  <div><strong>Category:</strong> {selectedHistoryPurchase.inventory.category}</div>
                  <div><strong>Supplier:</strong> {selectedHistoryPurchase.inventory.supplier ?? "-"}</div>
                  <div><strong>Quantity:</strong> {selectedHistoryPurchase.quantity}</div>
                  <div className="users-span-2"><strong>Description:</strong> {selectedHistoryPurchase.inventory.description ?? "-"}</div>
                </div>
              </>
            )}

            <h4 className="users-section-title" style={{ marginTop: "1rem" }}>Pricing</h4>
            <div className="users-view-grid">
              <div><strong>Purchase Mode:</strong> {selectedInvoicePurchaseMode}</div>
              <div>
                <strong>Current Selling Price:</strong>{" "}
                {isBulkInvoiceView
                  ? `Rs. ${selectedInvoiceCurrentSellingTotal.toLocaleString()}`
                  : selectedHistoryPurchase.currentSellingPrice != null
                    ? `Rs. ${selectedHistoryPurchase.currentSellingPrice.toLocaleString()}`
                    : "-"}
              </div>
              <div><strong>Quantity:</strong> {selectedInvoiceTotals.quantity}</div>
              <div><strong>Final Selling Price:</strong> Rs. {selectedInvoiceTotals.finalSellingPrice.toLocaleString()}</div>
              <div><strong>Payment Type:</strong> {selectedInvoicePaymentType} Buy</div>
              <div><strong>Downpayment:</strong> Rs. {selectedInvoiceTotals.downPaymentAmount.toLocaleString()}</div>
              {(() => {
                const interestEntry = selectedInvoiceEntries.find((e) => (e.interestRate ?? 0) > 0 && (e.installmentMonths ?? 0) > 0);
                if (!interestEntry) return null;
                const financeCharge = (interestEntry.totalWithInterest ?? 0) - interestEntry.finalSellingPrice;
                return (
                  <>
                    <div><strong>Finance Charge ({interestEntry.interestRate}%):</strong> Rs. {financeCharge.toLocaleString()}</div>
                    <div><strong>Monthly Installment:</strong> Rs. {(interestEntry.monthlyInstallmentAmount ?? 0).toLocaleString()} × {interestEntry.installmentMonths} months</div>
                  </>
                );
              })()}
              <div><strong>Grand Total:</strong> Rs. {selectedInvoiceEntries.reduce((sum, e) => sum + (e.totalWithInterest ?? e.finalSellingPrice), 0).toLocaleString()}</div>
              <div><strong>Advance Paid:</strong> Rs. {selectedInvoiceTotals.downPaymentAmount.toLocaleString()}</div>
              <div><strong>Balance Remaining:</strong> Rs. {selectedInvoiceTotals.remainingAmount.toLocaleString()}</div>
              <div><strong>Status:</strong> {selectedInvoiceTotals.settlementStatus === "TO_SETTLE" ? "To Settle" : "Settled"}</div>
            </div>

            {invoiceInstallments.length > 0 && (() => {
              const paidCount = invoiceInstallments.filter((i) => i.status === "PAID" || i.status === "PARTIAL").length;
              const remainingCount = invoiceInstallments.filter((i) => i.status === "PENDING" || i.status === "PARTIAL").length;
              return (
                <div style={{ marginTop: "1rem" }}>
                  <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                    Installment Schedule — {paidCount} of {invoiceInstallments.length} months paid · {remainingCount} remaining
                  </strong>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Due Date</th>
                          <th>Monthly Due</th>
                          <th>Paid</th>
                          <th>Penalty</th>
                          <th>Balance Due</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceInstallments.map((inst) => {
                          const balanceDue = Math.max(0, Math.round((inst.dueAmount + (inst.penaltyAmount ?? 0) - inst.paidAmount) * 100) / 100);
                          return (
                            <>
                              <tr key={inst.id} style={{ opacity: inst.status === "PAID" ? 0.65 : 1 }}>
                                <td>{inst.installmentNo}</td>
                                <td>
                                  {new Date(inst.dueDate).toLocaleDateString("en-GB")}
                                  {inst.settledAt && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Last: {new Date(inst.settledAt).toLocaleDateString("en-GB")}</div>}
                                </td>
                                <td>Rs. {inst.dueAmount.toLocaleString()}</td>
                                <td>{inst.paidAmount > 0 ? `Rs. ${inst.paidAmount.toLocaleString()}` : "—"}</td>
                                <td>{(inst.penaltyAmount ?? 0) > 0 ? `Rs. ${inst.penaltyAmount.toLocaleString()}` : "—"}</td>
                                <td style={{ fontWeight: balanceDue > 0 ? 600 : undefined, color: balanceDue > 0 ? "var(--amber, #f59e0b)" : undefined }}>
                                  {balanceDue > 0 ? `Rs. ${balanceDue.toLocaleString()}` : "—"}
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, color: inst.status === "PAID" ? "var(--green, #22c55e)" : inst.status === "PARTIAL" ? "var(--amber, #f59e0b)" : "var(--text-muted)" }}>
                                    {inst.status}
                                  </span>
                                </td>
                              </tr>
                              {inst.payments && inst.payments.length > 0 && inst.payments.map((pay) => (
                                <tr key={`pay-${pay.id}`} style={{ background: "var(--panel-bg, #f9f9f9)" }}>
                                  <td style={{ paddingLeft: "1.2rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>↳</td>
                                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{new Date(pay.paidAt).toLocaleDateString("en-GB")}</td>
                                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{pay.note ?? ""}</td>
                                  <td style={{ fontSize: "0.78rem" }}>Rs. {pay.amount.toLocaleString()}</td>
                                  <td style={{ fontSize: "0.78rem", color: pay.penaltyAmount > 0 ? "var(--amber, #f59e0b)" : "var(--text-muted)" }}>
                                    {pay.penaltyAmount > 0 ? `Rs. ${pay.penaltyAmount.toLocaleString()}` : "—"}
                                  </td>
                                  <td colSpan={2} />
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              {selectedInvoiceTotals.remainingAmount > 0 && (
                <button type="button" className="btn-accent" onClick={() => openSettleModal(selectedHistoryPurchase)}>Settle Amount</button>
              )}
              <button type="button" className="btn-outline" onClick={closeInvoiceModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {settleTarget && (
        <div className="bm-modal-backdrop" onClick={closeSettleModal}>
          <form className="bm-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitSettlePayment}>
            <button type="button" className="bm-modal-close" onClick={closeSettleModal}>x</button>
            <h3 className="bm-modal-title">Settle Invoice Amount</h3>
            {settleError && <div className="bm-alert bm-alert-error">{settleError}</div>}
            <div className="users-view-grid" style={{ marginBottom: "1rem" }}>
              <div><strong>Invoice:</strong> {settleTarget.invoiceGroupCode || `INV-${String(settleTarget.id).padStart(5, "0")}`}</div>
              <div><strong>Customer:</strong> {settleTarget.customer.firstName} {settleTarget.customer.lastName}</div>
              <div><strong>Remaining To Settle:</strong> Rs. {getInvoiceRemaining(settleTarget).toLocaleString()}</div>
              <div><strong>Payment Type:</strong> {getPaymentTypeText(settleTarget)}</div>
            </div>

            {settleInstallments.length > 0 && (
              <div className="bm-field-group">
                <label>Select Installment</label>
                {settleInstallmentsLoading
                  ? <p className="users-muted">Loading installments...</p>
                  : (
                    <select
                      className="bm-input"
                      value={settleInstallmentId}
                      onChange={(event) => {
                        const val = event.target.value;
                        setSettleInstallmentId(val ? Number(val) : "");
                        if (val) {
                          const inst = settleInstallments.find((i) => i.id === Number(val));
                          if (inst) setSettleAmount(String(Math.max(0, Math.round((inst.dueAmount + (inst.penaltyAmount ?? 0) - inst.paidAmount) * 100) / 100)));
                        }
                      }}
                    >
                      <option value="">Select installment (optional)</option>
                      {settleInstallments.map((inst) => (
                        <option key={inst.id} value={inst.id} disabled={inst.status === "PAID"}>
                          Month {inst.installmentNo} — Due: Rs. {inst.dueAmount.toLocaleString()}{inst.paidAmount > 0 ? ` — Paid: Rs. ${inst.paidAmount.toLocaleString()}` : ""} — {new Date(inst.dueDate).toLocaleDateString("en-GB")} [{inst.status}]
                        </option>
                      ))}
                    </select>
                  )}
              </div>
            )}

            <div className="bm-field-group">
              <label>Settle Amount</label>
              <input
                className="bm-input"
                type="number"
                min={0.01}
                step="0.01"
                value={settleAmount}
                onChange={(event) => {
                  setSettleAmount(event.target.value);
                  if (settleInstallmentId !== "") {
                    const inst = settleInstallments.find((i) => i.id === settleInstallmentId);
                    if (inst) {
                      const typed = Number(event.target.value);
                      const instBalanceDue = Math.max(0, Math.round((inst.dueAmount + (inst.penaltyAmount ?? 0) - inst.paidAmount) * 100) / 100);
                      setSettleIsPartial(Number.isFinite(typed) && typed < instBalanceDue);
                    }
                  }
                }}
                required
              />
            </div>

            {settleInstallmentId !== "" && (
              <div className="bm-field-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="settle-partial-checkbox"
                  checked={settleIsPartial}
                  onChange={(event) => setSettleIsPartial(event.target.checked)}
                />
                <label htmlFor="settle-partial-checkbox" style={{ margin: 0, fontWeight: 500 }}>Mark as Partial Payment</label>
              </div>
            )}

            {settleIsPartial && (
              <div className="bm-field-group">
                <label>Penalty for Underpayment (%)</label>
                <input
                  className="bm-input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="e.g. 2"
                  value={settlePenaltyRate}
                  onChange={(event) => setSettlePenaltyRate(event.target.value)}
                />
              </div>
            )}

            <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", border: "1px solid var(--panel-border)", borderRadius: "var(--radius-sm)", background: "var(--panel-bg)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.65rem", color: "var(--accent)" }}>How is this being paid?</div>
              <div className="bm-field-group">
                <label>Payment Method</label>
                <div style={{ display: "flex", gap: 20 }}>
                  {(["CASH", "CHEQUE", "BANK_TRANSFER"] as const).map((m) => (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                      <input type="radio" checked={settlePaymentMethod === m} onChange={() => setSettlePaymentMethod(m)} style={{ accentColor: "var(--accent)" }} />
                      {m === "BANK_TRANSFER" ? "Bank Transfer" : m}
                    </label>
                  ))}
                </div>
              </div>
              {settlePaymentMethod === "CHEQUE" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="bm-field-group">
                    <label>Cheque No *</label>
                    <input className="bm-input" value={settleChequeNo} onChange={(e) => setSettleChequeNo(e.target.value)} placeholder="e.g. 001234" />
                  </div>
                  <div className="bm-field-group">
                    <label>Bank</label>
                    <input className="bm-input" value={settleChequeBank} onChange={(e) => setSettleChequeBank(e.target.value)} placeholder="e.g. HNB" />
                  </div>
                  <div className="bm-field-group">
                    <label>Cheque Date</label>
                    <input type="date" className="bm-input" value={settleChequeDate} onChange={(e) => setSettleChequeDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="bm-modal-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn-accent" disabled={settleSaving}>
                {settleSaving ? "Saving..." : "Pay Remaining"}
              </button>
              <button type="button" className="btn-outline" onClick={closeSettleModal}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
