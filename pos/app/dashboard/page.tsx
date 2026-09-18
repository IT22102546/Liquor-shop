"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../components/AdminContext";
import { Donut } from "../components/charts/Donut";
import { SparkBar } from "../components/charts/SparkBar";
import { AreaChart } from "../components/charts/AreaChart";
import { useRouter } from "next/navigation";
import { API_URL } from "../lib/constants";
import { readApiData } from "../lib/api";
import {
  IconRevenue,
  IconUsers,
  IconInvoice,
  IconInventory,
  IconTrend,
  IconBike,
  IconActivity,
} from "../lib/icons";

type RevenueViewMode = "DAILY" | "MONTHLY" | "YEARLY";

type Purchase = {
  id: number;
  purchasedAt: string;
  itemType: "BIKE" | "INVENTORY";
  quantity: number;
  finalSellingPrice: number;
  purchaseChannel?: "PERSONAL" | "LEASING";
  remainingAmount?: number;
  hasRegistrationFee?: boolean;
  registrationFeeAmount?: number;
  inventory?: { id: number };
  bike?: { id: number };
  customer: { id: number };
};

type InventoryProduct = {
  id: number;
  quantity: number;
  lowStockThreshold?: number | null;
  taxPaid?: number;
  additionalExpenses?: number;
};

type InventoryHealth = {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
};

type VehicleSummary = {
  id: number;
  status: "available" | "sold";
  taxAmount?: number;
  expenses?: Array<{ amount: number }>;
};

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRangeByFilter(filter: "1d" | "1w" | "1m" | "1yr"): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let fromDate: Date;

  if (filter === "1d") {
    fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 1);
  } else if (filter === "1w") {
    fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 7);
  } else if (filter === "1m") {
    fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 30);
  } else {
    // 1yr
    fromDate = new Date(today);
    fromDate.setFullYear(today.getFullYear() - 1);
  }

  return {
    from: formatDateForInput(fromDate),
    to: formatDateForInput(today),
  };
}

function dateKeyLocal(date: Date, mode: RevenueViewMode) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (mode === "YEARLY") return String(year);
  if (mode === "MONTHLY") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function labelFromKey(key: string, mode: RevenueViewMode) {
  if (mode === "YEARLY") return key;
  if (mode === "MONTHLY") {
    const [y, m] = key.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: "short" });
    return `${month} ${y.slice(-2)}`;
  }
  const [y, m, d] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round(value * 100) / 100);
}

function getSettledRevenue(purchase: Purchase) {
  const remaining = Math.max(0, purchase.remainingAmount ?? 0);
  const registrationFee = purchase.hasRegistrationFee ? Math.max(0, purchase.registrationFeeAmount ?? 0) : 0;
  const settled = purchase.finalSellingPrice - remaining + registrationFee;
  return Math.max(0, Math.min(purchase.finalSellingPrice + registrationFee, settled));
}

function clampMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isDateWithinRange(iso: string | null | undefined, from: string, to: string) {
  if (!iso) return false;

  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return false;

  if (from) {
    const fromValue = new Date(`${from}T00:00:00`).getTime();
    if (value < fromValue) return false;
  }

  if (to) {
    const toValue = new Date(`${to}T23:59:59.999`).getTime();
    if (value > toValue) return false;
  }

  return true;
}

function formatDateRangeLabel(from: string, to: string) {
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Up to ${to}`;
  return "All dates";
}

function formatDisplayDate(value: string) {
  if (!value) return "All dates";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayDateRange(from: string, to: string) {
  if (from && to) return `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`;
  if (from) return `From ${formatDisplayDate(from)}`;
  if (to) return `Up to ${formatDisplayDate(to)}`;
  return "All dates";
}

export default function DashboardPage() {
  const { admin, token } = useAdmin();
  const router = useRouter();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const [revenueMode, setRevenueMode] = useState<RevenueViewMode>("MONTHLY");
  const [financeDateFrom, setFinanceDateFrom] = useState("");
  const [financeDateTo, setFinanceDateTo] = useState("");

  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const purchasesQuery = useQuery({
    queryKey: ["pos", "dashboard", "purchases", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/user-management/purchases?page=1&limit=500`, {
        headers: auth,
        cache: "no-store",
      });
      const payload = await readApiData<{ purchases?: Purchase[] }>(response, "Failed to load purchases");
      return payload.purchases ?? [];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["pos", "dashboard", "products", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/bike-management/products?page=1&limit=500`, {
        headers: auth,
        cache: "no-store",
      });
      const payload = await readApiData<{ products?: InventoryProduct[] }>(response, "Failed to load inventory summary");
      return payload.products ?? [];
    },
  });

  const inventoryHealthQuery = useQuery({
    queryKey: ["pos", "dashboard", "inventory-health", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/bike-management/products/health`, {
        headers: auth,
        cache: "no-store",
      });
      return readApiData<InventoryHealth>(response, "Failed to load inventory health");
    },
  });

  const vehiclesQuery = useQuery({
    queryKey: ["pos", "dashboard", "vehicles", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/bike-management/vehicles?limit=5000`, {
        headers: auth,
        cache: "no-store",
      });
      const payload = await readApiData<{ vehicles?: VehicleSummary[] }>(response, "Failed to load bike summary");
      return payload.vehicles ?? [];
    },
  });

  const purchases: Purchase[] = purchasesQuery.data ?? [];
  const products: InventoryProduct[] = productsQuery.data ?? [];
  const vehicles: VehicleSummary[] = vehiclesQuery.data ?? [];
  const inventoryHealth = inventoryHealthQuery.data ?? {
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  };
  const loading = purchasesQuery.isPending
    || productsQuery.isPending
    || inventoryHealthQuery.isPending
    || vehiclesQuery.isPending;
  const error = purchasesQuery.error instanceof Error
    ? purchasesQuery.error.message
    : productsQuery.error instanceof Error
      ? productsQuery.error.message
      : inventoryHealthQuery.error instanceof Error
        ? inventoryHealthQuery.error.message
        : vehiclesQuery.error instanceof Error
          ? vehiclesQuery.error.message
          : null;

  const inventoryHealthPercent = (count: number) =>
    inventoryHealth.totalProducts > 0
      ? Math.round((count / inventoryHealth.totalProducts) * 100)
      : 0;

  const financeDateRangeInvalid = Boolean(
    financeDateFrom && financeDateTo && financeDateFrom > financeDateTo,
  );

  const financeDateRangeLabel = useMemo(
    () => formatDateRangeLabel(financeDateFrom, financeDateTo),
    [financeDateFrom, financeDateTo],
  );

  const productsById = useMemo(
    () => new Map(products.map((product: InventoryProduct) => [product.id, product])),
    [products],
  );

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((vehicle: VehicleSummary) => [vehicle.id, vehicle])),
    [vehicles],
  );

  const filteredFinancePurchases = useMemo(() => {
    if (financeDateRangeInvalid) return [];
    return purchases.filter((purchase: Purchase) =>
      isDateWithinRange(purchase.purchasedAt, financeDateFrom, financeDateTo),
    );
  }, [financeDateFrom, financeDateRangeInvalid, financeDateTo, purchases]);

  const activeTaxes = useMemo(() => {
    const total = filteredFinancePurchases.reduce((sum: number, purchase: Purchase) => {
      if (purchase.itemType === "INVENTORY") {
        const productId = purchase.inventory?.id;
        const product = productId ? productsById.get(productId) : undefined;
        return sum + Math.max(0, product?.taxPaid ?? 0) * Math.max(0, purchase.quantity);
      }

      const bikeId = purchase.bike?.id;
      const bike = bikeId ? vehiclesById.get(bikeId) : undefined;
      return sum + Math.max(0, bike?.taxAmount ?? 0);
    }, 0);

    return clampMoney(total);
  }, [filteredFinancePurchases, productsById, vehiclesById]);

  const activeOtherCosts = useMemo(() => {
    const total = filteredFinancePurchases.reduce((sum: number, purchase: Purchase) => {
      if (purchase.itemType === "INVENTORY") {
        const productId = purchase.inventory?.id;
        const product = productId ? productsById.get(productId) : undefined;
        return sum + Math.max(0, product?.additionalExpenses ?? 0) * Math.max(0, purchase.quantity);
      }

      const bikeId = purchase.bike?.id;
      const bike = bikeId ? vehiclesById.get(bikeId) : undefined;
      const expenses = bike?.expenses ?? [];
      return sum + expenses.reduce((innerSum, item) => innerSum + Math.max(0, item.amount), 0);
    }, 0);

    return clampMoney(total);
  }, [filteredFinancePurchases, productsById, vehiclesById]);

  const financialSummary = useMemo(() => {
    const now = new Date();
    const dailyKey = dateKeyLocal(now, "DAILY");
    const monthKey = dateKeyLocal(now, "MONTHLY");

    let totalRevenue = 0;
    let dailyRevenue = 0;
    let monthlyRevenue = 0;
    let leasingOutstanding = 0;
    let cashOutstanding = 0;

    filteredFinancePurchases.forEach((purchase: Purchase) => {
      const settledRevenue = getSettledRevenue(purchase);
      const remaining = Math.max(0, purchase.remainingAmount ?? 0);
      totalRevenue += settledRevenue;

      const purchasedAt = new Date(purchase.purchasedAt);
      if (dateKeyLocal(purchasedAt, "DAILY") === dailyKey) {
        dailyRevenue += settledRevenue;
      }
      if (dateKeyLocal(purchasedAt, "MONTHLY") === monthKey) {
        monthlyRevenue += settledRevenue;
      }

      if (purchase.purchaseChannel === "LEASING") {
        leasingOutstanding += remaining;
      } else {
        cashOutstanding += remaining;
      }
    });

    const totalOutstanding = cashOutstanding + leasingOutstanding;
    const grossProfit = totalRevenue - (activeTaxes + activeOtherCosts);

    return {
      totalRevenue,
      dailyRevenue,
      monthlyRevenue,
      totalOutstanding,
      cashOutstanding,
      leasingOutstanding,
      grossProfit,
    };
  }, [activeOtherCosts, activeTaxes, filteredFinancePurchases]);

  const allTimeRevenue = useMemo(
    () => clampMoney(purchases.reduce((sum: number, purchase: Purchase) => sum + getSettledRevenue(purchase), 0)),
    [purchases],
  );

  const totals = useMemo(() => {
    const now = new Date();
    const todayKey = dateKeyLocal(now, "DAILY");

    let todayRevenue = 0;
    let todaySoldUnits = 0;
    let openInvoices = 0;
    const uniqueCustomers = new Set<number>();

    purchases.forEach((purchase: Purchase) => {
      const settledRevenue = getSettledRevenue(purchase);
      uniqueCustomers.add(purchase.customer.id);
      if ((purchase.remainingAmount ?? 0) > 0) openInvoices += 1;

      const purchasedAt = new Date(purchase.purchasedAt);
      if (dateKeyLocal(purchasedAt, "DAILY") === todayKey) {
        todayRevenue += settledRevenue;
        todaySoldUnits += purchase.quantity;
      }
    });

    return {
      totalRevenue: allTimeRevenue,
      todayRevenue,
      todaySoldUnits,
      openInvoices,
      activeUsers: uniqueCustomers.size,
      lowStockAlerts: inventoryHealth.lowStock,
    };
  }, [allTimeRevenue, inventoryHealth.lowStock, purchases]);

  const groupedRevenue = useMemo(() => {
    const map = new Map<string, { revenue: number; soldUnits: number }>();
    purchases.forEach((purchase: Purchase) => {
      const key = dateKeyLocal(new Date(purchase.purchasedAt), revenueMode);
      const current = map.get(key) ?? { revenue: 0, soldUnits: 0 };
      current.revenue += getSettledRevenue(purchase);
      current.soldUnits += purchase.quantity;
      map.set(key, current);
    });

    const now = new Date();
    const rangeKeys: string[] = [];

    if (revenueMode === "DAILY") {
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        rangeKeys.push(dateKeyLocal(d, "DAILY"));
      }
    } else if (revenueMode === "MONTHLY") {
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        rangeKeys.push(dateKeyLocal(d, "MONTHLY"));
      }
    } else {
      for (let i = 7; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear() - i, 0, 1);
        rangeKeys.push(dateKeyLocal(d, "YEARLY"));
      }
    }

    return {
      labels: rangeKeys.map((key) => labelFromKey(key, revenueMode)),
      revenueValues: rangeKeys.map((key) => Math.round((map.get(key)?.revenue ?? 0) * 100) / 100),
      soldValues: rangeKeys.map((key) => map.get(key)?.soldUnits ?? 0),
    };
  }, [purchases, revenueMode]);

  const selectedRangeRevenue = useMemo(
    () => groupedRevenue.revenueValues.reduce((sum, value) => sum + value, 0),
    [groupedRevenue.revenueValues]
  );

  const bikeSalesCount = useMemo(
    () => purchases.filter((purchase: Purchase) => purchase.itemType === "BIKE").length,
    [purchases]
  );

  const inventorySalesCount = useMemo(
    () => purchases.filter((purchase: Purchase) => purchase.itemType === "INVENTORY").length,
    [purchases]
  );

  const totalSalesCount = purchases.length;
  const bikeShare = totalSalesCount > 0 ? Math.round((bikeSalesCount / totalSalesCount) * 100) : 0;
  const inventoryShare = totalSalesCount > 0 ? Math.round((inventorySalesCount / totalSalesCount) * 100) : 0;
  const settledShare = totalSalesCount > 0
    ? Math.round((purchases.filter((purchase: Purchase) => (purchase.remainingAmount ?? 0) <= 0).length / totalSalesCount) * 100)
    : 0;
  const pendingShare = Math.max(0, 100 - settledShare);

  const recentActivity = useMemo(
    () => [...purchases]
      .sort((a: Purchase, b: Purchase) => +new Date(b.purchasedAt) - +new Date(a.purchasedAt))
      .slice(0, 6),
    [purchases]
  );

  const revenueSeries = groupedRevenue.revenueValues.length > 0
    ? groupedRevenue.revenueValues
    : [0];
  const soldSeries = groupedRevenue.soldValues.length > 0
    ? groupedRevenue.soldValues
    : [0];
  const axisLabels = groupedRevenue.labels.length > 0
    ? groupedRevenue.labels
    : ["-"];

  const exportFinanceReportPdf = () => {
    if (typeof window === "undefined") return;

    const generatedAt = new Date().toLocaleString();
    const reportDateRange = formatDisplayDateRange(financeDateFrom, financeDateTo);
    const reportNumber = `#${String(purchases.length).padStart(4, "0")}`;
    const reportDate = new Date().toLocaleDateString("en-GB");
    const rowDescriptions: Record<string, string> = {
      "Total Revenue": "Settled revenue in the selected range",
      Taxes: "Vehicle tax and inventory tax totals",
      "Other Costs": "Operating expenses and product extras",
      "Gross Profit": "Total Revenue - (Taxes + Other Costs)",
      "Total Outstanding": "Unsettled balances in the selected range",
      "Leasing Outstanding": "Outstanding leasing balances only",
    };
    const rows = [
      {
        label: "Total Revenue",
        totalPrice: `LKR ${formatCurrency(financialSummary.totalRevenue)}`,
      },
      {
        label: "Taxes",
        totalPrice: `LKR ${formatCurrency(activeTaxes)}`,
      },
      {
        label: "Other Costs",
        totalPrice: `LKR ${formatCurrency(activeOtherCosts)}`,
      },
      {
        label: "Gross Profit",
        totalPrice: `LKR ${formatCurrency(financialSummary.grossProfit)}`,
      },
      {
        label: "Total Outstanding",
        totalPrice: `LKR ${formatCurrency(financialSummary.totalOutstanding)}`,
      },
      {
        label: "Leasing Outstanding",
        totalPrice: `LKR ${formatCurrency(financialSummary.leasingOutstanding)}`,
      },
    ];
    const tableRows = rows
      .map((row) => {
        const isRevenue = row.label.toLowerCase().includes('revenue');
        const isTax = row.label.toLowerCase().includes('tax');
        const isOther = row.label.toLowerCase().includes('other');
        return [
          '<tr>',
          `<td class="col-desc">${row.label}</td>`,
          `<td class="col-center">${isTax || isOther ? row.totalPrice : ''}</td>`,
          `<td class="col-right">${isRevenue ? row.totalPrice : ''}</td>`,
          '</tr>',
        ].join('');
      })
      .join('');
    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bar Shop Sales Report ${dateKeyLocal(new Date(), "DAILY")}</title>
    <style>
      @page { size: A4 portrait; margin: 6mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
      .sheet { width: 100%; max-width: 198mm; margin: 0 auto; background: #fff; }
      .header { background: #000; color: #caa24c; text-align: center; padding: 18px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .logo { width: 110px; height: auto; display: block; margin: 0 auto 6px; }
      .brand { margin: 0; font-size: 12px; font-weight: 700; }
      .brand-title { margin: 4px 0 0; font-size: 11px; font-weight: 600; }
      .brand-address { margin: 4px 0 0; font-size: 11px; font-weight: 600; }
      .content { padding: 14px 18px; }
      .top-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; margin-bottom: 12px; }
      .invoice-number { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
      .report-date { font-size: 14px; font-weight: 700; margin: 0; text-align: right; }
      .range { margin: 8px 0 12px 0; color: #666; font-size: 13px; }
      .divider { height: 16px; width: 100%; background: #000; margin: 12px 0 18px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .table { width: 100%; border-collapse: collapse; }
      .table thead th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #999; font-size: 13px; font-weight: 700; }
      .table tbody td { padding: 14px 8px; border-bottom: 1px solid #e6e6e6; vertical-align: top; font-size: 13px; color: #444; }
      .col-desc { width: 60%; }
      .col-center { text-align: center; width: 20%; color: #333; }
      .col-right { text-align: right; width: 20%; color: #333; }
      .gross { font-weight: 800; }
      .section-title { font-size: 16px; font-weight: 700; margin-top: 26px; margin-bottom: 8px; }
      .small-note { color: #777; font-size: 11px; margin-top: 6px; }
      .accounts-table { margin-top: 12px; width: 100%; border-collapse: collapse; }
      .accounts-table thead th { text-align: left; padding: 8px 8px; border-bottom: 1px solid #999; font-size: 12px; font-weight: 700; }
      .accounts-table td { padding: 12px 8px; border-bottom: 1px solid #e6e6e6; font-size: 13px; }
      .total-row { display: flex; justify-content: flex-end; gap: 24px; align-items: center; padding-top: 12px; border-top: 1px solid #ddd; margin-top: 10px; }
      .total-label { font-weight: 700; color: #111; }
      .total-value { font-weight: 700; color: #111; }
      .footer-note { margin-top: 16px; font-size: 11px; color: #777; }
      @media print { body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { max-width: none; width: 100%; margin: 0; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <img src="/landing/lion-logo.png" alt="Bar Shop" class="logo" />
        <p class="brand">Bar Shop</p>
        <p class="brand-title">Retail beverages, bar supplies, mixers, snacks, and wholesale products.</p>
        <p class="brand-address">No:154, Puttalam Road, Kurunegala, Sri Lanka, Kurunegala</p>
      </div>

      <div class="content">
        <div class="top-row">
          <div>
            <p class="invoice-number">Sales Report: <strong>${reportNumber}</strong></p>
            <div class="range">Report Range: <span class="small-note">${reportDateRange}</span></div>
          </div>
          <div>
            <p class="report-date">Date: ${reportDate}</p>
          </div>
        </div>

        <div class="divider"></div>

        <table class="table">
          <thead>
            <tr>
              <th class="col-desc">Description</th>
              <th class="col-center">Debit / Expense</th>
              <th class="col-right">Credit / Income</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="total-row">
          <div class="total-label">Gross Profit</div>
          <div class="total-value">${rows.find(r => r.label.toLowerCase().includes('gross'))?.totalPrice ?? ''}</div>
        </div>

        <h3 class="section-title">Accounts Receivable: ${reportNumber}</h3>
        <div class="range">Report Range: <span class="small-note">${reportDateRange}</span></div>

        <table class="accounts-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:center">Debit / Expense</th>
              <th style="text-align:right">Credit / Income</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash Outstanding</td>
              <td style="text-align:center">Rs. ${formatCurrency(financialSummary.cashOutstanding)}</td>
              <td></td>
            </tr>
            <tr>
              <td>Leasing Outstanding</td>
              <td style="text-align:center">Rs. ${formatCurrency(financialSummary.leasingOutstanding)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="total-row">
          <div class="total-label">Total Outstanding</div>
          <div class="total-value">Rs. ${formatCurrency(financialSummary.totalOutstanding)}</div>
        </div>

        <div class="footer-note">This document is formatted for print and PDF export from the dashboard. ${generatedAt}</div>
      </div>
    </div>
  </body>
</html>`;

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.opacity = "0";

    const cleanup = () => {
      window.setTimeout(() => {
        if (printFrame.parentNode) {
          printFrame.parentNode.removeChild(printFrame);
        }
      }, 1000);
    };

    printFrame.onload = () => {
      const frameWindow = printFrame.contentWindow;
      if (!frameWindow) {
        cleanup();
        return;
      }
      frameWindow.requestAnimationFrame(() => {
        window.setTimeout(() => {
          frameWindow.focus();
          frameWindow.print();
          cleanup();
        }, 120);
      });
    };

    document.body.appendChild(printFrame);
    printFrame.srcdoc = html;
  };

  return (
    <>
      {/* Welcome strip */}
      <div className="dash-welcome">
        <div>
          <h2 className="dash-welcome-title">
            Good {greeting}, {admin.name.split(" ")[0]}
          </h2>
          <p className="dash-welcome-sub">Here&apos;s what&apos;s happening at Bar Shop today.</p>
        </div>
        <div className="dash-welcome-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={exportFinanceReportPdf}
            disabled={financeDateRangeInvalid}
          >
            <IconInvoice /> Print Finance PDF
          </button>
          <button type="button" className="btn-outline" onClick={() => router.push("/dashboard/invoices")}>
            <IconInvoice /> New Invoice
          </button>
          <button type="button" className="btn-accent" onClick={() => router.push("/dashboard/inventory")}>
            <IconInventory /> Check Drink Stock
          </button>
        </div>
      </div>

      {error && <div className="bm-alert bm-alert-error">{error}</div>}

      <div className="finance-controls-panel">
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="finance-control-row">
            <label className="finance-control-label" htmlFor="finance-date-from">
              From date
            </label>
            <input
              id="finance-date-from"
              type="date"
              className="bm-input"
              value={financeDateFrom}
              onChange={(event) => setFinanceDateFrom(event.target.value)}
            />
          </div>
          <div className="finance-control-row">
            <label className="finance-control-label" htmlFor="finance-date-to">
              To date
            </label>
            <input
              id="finance-date-to"
              type="date"
              className="bm-input"
              value={financeDateTo}
              onChange={(event) => setFinanceDateTo(event.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["1d", "1w", "1m", "1yr"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={financeDateFrom === getDateRangeByFilter(filter).from && financeDateTo === getDateRangeByFilter(filter).to ? "btn-accent" : "btn-outline"}
                onClick={() => {
                  const range = getDateRangeByFilter(filter);
                  setFinanceDateFrom(range.from);
                  setFinanceDateTo(range.to);
                }}
                style={{ padding: "0.5rem 0.8rem", fontSize: "0.9rem" }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="finance-equations">
          {financeDateRangeInvalid && (
            <div className="bm-alert bm-alert-error">
              From date must be earlier than or equal to the to date.
            </div>
          )}
          <span>Showing finance cards for {financeDateRangeLabel}.</span>
          <span>{filteredFinancePurchases.length} invoice(s) matched the selected range.</span>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setFinanceDateFrom("");
                setFinanceDateTo("");
              }}
              disabled={!financeDateFrom && !financeDateTo}
            >
              Clear Dates
            </button>
          </div>
        </div>
      </div>

      <div className="finance-cards-grid">
        {[
          {
            label: "Total Revenue",
            value: `LKR ${formatCurrency(financialSummary.totalRevenue)}`,
            hint: "Includes all settled amounts",
          },
          {
            label: "Total Outstanding",
            value: `LKR ${formatCurrency(financialSummary.totalOutstanding)}`,
            hint: "Cash + leasing balance",
          },
          {
            label: "Cash Outstanding",
            value: `LKR ${formatCurrency(financialSummary.cashOutstanding)}`,
            hint: "Outstanding cash balance only",
          },
          {
            label: "Leasing Outstanding",
            value: `LKR ${formatCurrency(financialSummary.leasingOutstanding)}`,
            hint: "Only leasing balance",
          },
          {
            label: "Taxes",
            value: `LKR ${formatCurrency(activeTaxes)}`,
            hint: `Auto from sales in ${financeDateRangeLabel.toLowerCase()}`,
          },
          {
            label: "Other Costs",
            value: `LKR ${formatCurrency(activeOtherCosts)}`,
            hint: `Auto from sales in ${financeDateRangeLabel.toLowerCase()}`,
          },
          {
            label: "Gross Profit",
            value: `LKR ${formatCurrency(financialSummary.grossProfit)}`,
            hint: "Revenue - (Taxes + Other Costs)",
          },
        ].map((card) => (
          <div key={card.label} className="finance-card">
            <span className="finance-card-label">{card.label}</span>
            <strong className="finance-card-value">{card.value}</strong>
            <span className="finance-card-hint">{card.hint}</span>
          </div>
        ))}
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        {[
          {
            label: "Daily Revenue",
            value: loading ? "Loading..." : `LKR ${formatCurrencyCompact(totals.todayRevenue)}`,
            trend: `${totals.todaySoldUnits} units sold today`,
            up: true,
            icon: <IconRevenue />,
            color: "#C9A84C",
          },
          {
            label: "Whole Revenue",
            value: loading ? "Loading..." : `LKR ${formatCurrencyCompact(totals.totalRevenue)}`,
            trend: `${purchases.length} total invoices`,
            up: true,
            icon: <IconTrend />,
            color: "#10B981",
          },
          {
            label: "Active Users",
            value: loading ? "Loading..." : String(totals.activeUsers),
            trend: `${totals.openInvoices} open invoices`,
            up: totals.openInvoices === 0,
            icon: <IconUsers />,
            color: "#3B82F6",
          },
          {
            label: "Low Stock Alerts",
            value: loading ? "Loading..." : String(totals.lowStockAlerts),
            trend: "inventory threshold", 
            up: totals.lowStockAlerts === 0,
            icon: <IconInventory />,
            color: "#EF4444",
          },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-icon-wrap" style={{ background: `${k.color}18`, borderColor: `${k.color}30`, color: k.color }}>
                {k.icon}
              </span>
            </div>
            <strong className="kpi-value">{k.value}</strong>
            <span className={`kpi-trend ${k.up ? "kpi-up" : "kpi-down"}`}>
              {k.up ? "↑" : "↓"} {k.trend} this week
            </span>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="dash-charts-row">
        {/* Revenue area chart */}
        <div className="chart-panel chart-wide">
          <div className="chart-panel-header">
            <div className="chart-panel-title">
              <IconRevenue />
              <span>Revenue Trend</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                className="bm-input"
                style={{ minWidth: 140 }}
                value={revenueMode}
                onChange={(event) => setRevenueMode(event.target.value as RevenueViewMode)}
              >
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <span className="chart-badge chart-badge-gold">LKR {formatCurrencyCompact(selectedRangeRevenue)}</span>
            </div>
          </div>
          <div className="chart-legend-row">
            <span className="chart-legend-dot" style={{ background: "#C9A84C" }} />
            <span className="chart-legend-label">Revenue (LKR)</span>
          </div>
          <div className="area-chart-wrap">
            <AreaChart values={revenueSeries} color="#C9A84C" />
            <div className="area-chart-months">
              {axisLabels.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Sales breakdown donuts */}
        <div className="chart-panel chart-narrow">
          <div className="chart-panel-header">
            <div className="chart-panel-title">
              <IconActivity />
              <span>Sales Breakdown</span>
            </div>
          </div>
          <div className="donuts-grid">
            <Donut pct={bikeShare} color="#D8892B" label="Drinks" sublabel="sold" size={84} stroke={10} />
            <Donut pct={inventoryShare} color="#3B82F6" label="Inventory" sublabel="sold" size={84} stroke={10} />
            <Donut pct={settledShare} color="#10B981" label="Settled" sublabel="invoices" size={84} stroke={10} />
            <Donut pct={pendingShare} color="#F59E0B" label="Pending" sublabel="invoices" size={84} stroke={10} />
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="dash-bottom-row">
        {/* Spark bars */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title"><IconTrend /><span>Sold Units Trend</span></div>
            <span className="chart-badge chart-badge-green">{revenueMode.toLowerCase()}</span>
          </div>
          <div className="spark-wrap">
            <SparkBar values={soldSeries} color="#C9A84C" />
          </div>
          <div className="area-chart-months">
            {axisLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>

        {/* Inventory health */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title"><IconInventory /><span>Drink Inventory Health</span></div>
          </div>
          <div className="inv-health-wrap">
            <Donut
              pct={inventoryHealthPercent(inventoryHealth.inStock)}
              color="#10B981"
              label="In Stock"
              sublabel="products"
              size={100}
              stroke={12}
            />
            <div className="inv-health-stats">
              {[
                {
                  label: "In Stock",
                  val: `${inventoryHealthPercent(inventoryHealth.inStock)}%`,
                  color: "#10B981",
                },
                {
                  label: "Low Stock",
                  val: `${inventoryHealthPercent(inventoryHealth.lowStock)}%`,
                  color: "#F59E0B",
                },
                {
                  label: "Out of Stock",
                  val: `${inventoryHealthPercent(inventoryHealth.outOfStock)}%`,
                  color: "#EF4444",
                },
              ].map((s) => (
                <div key={s.label} className="inv-stat-row">
                  <span className="inv-stat-dot" style={{ background: s.color }} />
                  <span className="inv-stat-label">{s.label}</span>
                  <span className="inv-stat-val">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title"><IconActivity /><span>Recent Activity</span></div>
          </div>
          <div className="activity-list">
            {recentActivity.length === 0 && <div className="users-muted">No sales activity yet.</div>}
            {recentActivity.map((entry) => (
              <div key={entry.id} className="activity-row">
                <span className="activity-dot" style={{ background: (entry.remainingAmount ?? 0) > 0 ? "#F59E0B" : "#10B981" }} />
                <span className="activity-text">
                  {entry.itemType === "BIKE" ? "Drink sale" : "Product sale"} • LKR {Math.round(entry.finalSellingPrice).toLocaleString()}
                </span>
                <span className="activity-time">{new Date(entry.purchasedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
