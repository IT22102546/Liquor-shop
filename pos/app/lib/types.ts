export type PosAdminRole = "ADMIN" | "CASHIER" | "INVENTORY_MANAGER" | "ACCOUNTANT";

export type PosAdmin = {
  id: number;
  name: string;
  email: string;
  role: PosAdminRole;
  lastLoginAt: string | null;
};

export type Theme = "light" | "dark";
