"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAccounts,
  IconBar,
  IconBottle,
  IconChevronLeft,
  IconChevronNav,
  IconChevronRight,
  IconLeasing,
  IconPreOrders,
  IconReceipt,
  IconSearch,
  IconSupplier,
  IconUsers,
} from "../lib/icons";

const NAV_ITEMS = [
  { key: "inventory", label: "Sell Products", href: "/dashboard/inventory", Icon: IconBottle },
  { key: "dashboard", label: "Dashboard", href: "/dashboard", Icon: IconBar },
  { key: "users", label: "User Management", href: "/dashboard/users", Icon: IconUsers },
  { key: "suppliers", label: "Beverage Suppliers", href: "/dashboard/suppliers", Icon: IconSupplier },
  { key: "purchasing", label: "Purchasing & Requests", href: "/dashboard/purchasing-requests", Icon: IconPreOrders },
  { key: "wholesale", label: "Wholesale Accounts", href: "/dashboard/wholesale-accounts", Icon: IconLeasing },
  { key: "invoices", label: "Invoice Management", href: "/dashboard/invoices", Icon: IconReceipt },
  { key: "accounts", label: "Accounts", href: "/dashboard/accounts", Icon: IconAccounts },
] as const;

const GROUPS = {
  users: [["Users", "/dashboard/users"], ["User History", "/dashboard/users/history"]],
  inventory: [["Sell & Inventory", "/dashboard/inventory"], ["Sold Products", "/dashboard/inventory/sold"], ["Product Setup", "/dashboard/inventory/manage"]],
  purchasing: [["Purchase Orders", "/dashboard/purchase-orders"], ["Supplier Requests", "/dashboard/purchasing-requests"]],
  invoices: [["Invoices", "/dashboard/invoices"], ["Account Details", "/dashboard/invoices/accounts"], ["Terms & Conditions", "/dashboard/invoices/terms"]],
  accounts: [["Receipts", "/dashboard/accounts/receipts"], ["Vouchers", "/dashboard/accounts/vouchers"], ["General Ledger", "/dashboard/accounts/ledger"], ["Manage Accounts", "/dashboard/accounts"]],
} as const;

const SIDEBAR_COLLAPSED_KEY = "pos-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const isCounter = pathname === "/dashboard/inventory";
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  const toggleGroup = (key: string) => setOpenGroups((current) => ({ ...current, [key]: !current[key] }));

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <button type="button" className="sidebar-collapse-btn" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
        {!collapsed && <><span className="sidebar-brand-mark" aria-hidden="true"><IconBar /></span><span className="sidebar-brand">Bar Shop <strong>POS</strong></span></>}
      </div>

      {!collapsed && !isCounter && <div className="sidebar-search"><IconSearch /><input type="text" placeholder="Search the bar..." aria-label="Search the bar" /></div>}

      <nav className="sidebar-nav">
        {isCounter ? (
          <>
            <Link href="/dashboard/inventory" className="nav-item active"><span className="nav-icon"><IconBottle /></span>{!collapsed && <span className="nav-label">Bar Counter</span>}</Link>
            <Link href="/dashboard/inventory/sold" className="nav-item"><span className="nav-icon"><IconReceipt /></span>{!collapsed && <span className="nav-label">Recent Sales</span>}</Link>
            <Link href="/dashboard/inventory/manage" className="nav-item"><span className="nav-icon"><IconPreOrders /></span>{!collapsed && <span className="nav-label">Product Setup</span>}</Link>
            <Link href="/dashboard" className="nav-item"><span className="nav-icon"><IconBar /></span>{!collapsed && <span className="nav-label">Dashboard</span>}</Link>
          </>
        ) : NAV_ITEMS.map(({ key, label, href, Icon }) => {
          const group = GROUPS[key as keyof typeof GROUPS];
          const active = isActive(href);
          if (!group || collapsed) {
            return <Link key={key} href={href} className={`nav-item${active ? " active" : ""}`} title={collapsed ? label : undefined}><span className="nav-icon"><Icon /></span>{!collapsed && <span className="nav-label">{label}</span>}{!collapsed && active && <span className="nav-dot" />}</Link>;
          }
          const open = openGroups[key] ?? active;
          return <div key={key}>
            <button type="button" className={`nav-item nav-group-toggle${active ? " active" : ""}`} onClick={() => toggleGroup(key)}><span className="nav-icon"><Icon /></span><span className="nav-label">{label}</span><span className="nav-chevron" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}><IconChevronNav /></span></button>
            {open && <div className="nav-sub-group">{group.map(([itemLabel, itemHref]) => <Link key={itemHref} href={itemHref} className={`nav-sub-item${pathname === itemHref ? " active" : ""}`}><span className="nav-sub-dot" /><span>{itemLabel}</span></Link>)}</div>}
          </div>;
        })}
      </nav>

      {!collapsed && <div className="sidebar-footer"><span>BAR SHOP POS</span><span>Operations</span></div>}
    </aside>
  );
}
