import type { PosAdminRole } from "./types";

export const ROLE_LABELS: Record<PosAdminRole, string> = {
  ADMIN: "Administrator",
  CASHIER: "Cashier",
  INVENTORY_MANAGER: "Inventory Manager",
  ACCOUNTANT: "Accountant",
};

export const ROLE_HOME: Record<PosAdminRole, string> = {
  ADMIN: "/dashboard/inventory",
  CASHIER: "/dashboard/inventory",
  INVENTORY_MANAGER: "/dashboard/inventory/manage",
  ACCOUNTANT: "/dashboard/accounts",
};

const ROLE_PATHS: Record<PosAdminRole, string[]> = {
  ADMIN: ["/dashboard"],
  CASHIER: ["/dashboard/inventory/sold"],
  INVENTORY_MANAGER: [
    "/dashboard/inventory/manage",
    "/dashboard/suppliers",
    "/dashboard/purchase-orders",
    "/dashboard/purchasing-requests",
  ],
  ACCOUNTANT: [
    "/dashboard/accounts",
    "/dashboard/invoices",
    "/dashboard/wholesale-accounts",
  ],
};

const ROLE_EXACT_PATHS: Partial<Record<PosAdminRole, string[]>> = {
  CASHIER: ["/dashboard/inventory"],
};

export function canAccessPath(role: PosAdminRole, pathname: string) {
  return Boolean(ROLE_EXACT_PATHS[role]?.includes(pathname)) || (ROLE_PATHS[role] ?? []).some(
    (allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}
