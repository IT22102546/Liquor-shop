"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAccounts,
  IconChevronLeft,
  IconChevronNav,
  IconChevronRight,
  IconContactRequests,
  IconDashboard,
  IconInventory,
  IconLeasing,
  IconInvoice,
  IconPreOrders,
  IconSearch,
  IconSupplier,
  IconUsers,
} from "../lib/icons";

const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    Icon: IconDashboard,
  },
  {
    key: "users",
    label: "User Management",
    href: "/dashboard/users",
    Icon: IconUsers,
  },
  {
    key: "suppliers",
    label: "Beverage Suppliers",
    href: "/dashboard/suppliers",
    Icon: IconSupplier,
  },
  {
    key: "inventory",
    label: "Drinks & Products",
    href: "/dashboard/inventory",
    Icon: IconInventory,
  },
  {
    key: "pre-orders-requests",
    label: "Purchasing & Requests",
    href: "/dashboard/purchasing-requests",
    Icon: IconPreOrders,
  },
  {
    key: "leasing-companies",
    label: "Wholesale Accounts",
    href: "/dashboard/wholesale-accounts",
    Icon: IconLeasing,
  },
  {
    key: "invoices",
    label: "Invoice Management",
    href: "/dashboard/invoices",
    Icon: IconInvoice,
  },
  {
    key: "accounts",
    label: "Accounts",
    href: "/dashboard/accounts",
    Icon: IconAccounts,
  },
] as const;

const BIKE_SUB_ITEMS = [
  { key: "inventory", label: "Liquor Stock", href: "/dashboard/liquor-stock" },
  { key: "sold", label: "Sold Products", href: "/dashboard/liquor-stock/sold" },
  { key: "manage", label: "Product Setup", href: "/dashboard/liquor-stock/manage" },
] as const;

const USER_SUB_ITEMS = [
  { key: "users", label: "Users", href: "/dashboard/users" },
  { key: "history", label: "User History", href: "/dashboard/users/history" },
] as const;

const INVENTORY_SUB_ITEMS = [
  { key: "inventory", label: "Drink Inventory", href: "/dashboard/inventory" },
  { key: "sold", label: "Sold Drinks", href: "/dashboard/inventory/sold" },
  { key: "manage", label: "Product Setup", href: "/dashboard/inventory/manage" },
] as const;

const INVOICE_SUB_ITEMS = [
  { key: "invoice-list", label: "Invoices", href: "/dashboard/invoices" },
  {
    key: "invoice-accounts",
    label: "Account Details",
    href: "/dashboard/invoices/accounts",
  },
  {
    key: "invoice-terms",
    label: "Terms & Conditions",
    href: "/dashboard/invoices/terms",
  },
] as const;

const ACCOUNTS_SUB_ITEMS = [
  { key: "receipts", label: "Receipts", href: "/dashboard/accounts/receipts" },
  { key: "vouchers", label: "Vouchers", href: "/dashboard/accounts/vouchers" },
  { key: "ledger", label: "General Ledger", href: "/dashboard/accounts/ledger" },
  { key: "manage", label: "Manage Accounts", href: "/dashboard/accounts" },
] as const;

const PRE_ORDERS_SUB_ITEMS = [
  { key: "pre-orders", label: "Purchase Orders", href: "/dashboard/purchase-orders" },
  { key: "requests", label: "Supplier Requests", href: "/dashboard/purchasing-requests" },
] as const;

const SIDEBAR_COLLAPSED_KEY = "pos-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userOpen, setUserOpen] = useState(
    pathname.startsWith("/dashboard/users"),
  );
  const [bikeOpen, setBikeOpen] = useState(
    pathname.startsWith("/dashboard/liquor-stock"),
  );
  const [inventoryOpen, setInventoryOpen] = useState(
    pathname.startsWith("/dashboard/inventory"),
  );
  const [invoiceOpen, setInvoiceOpen] = useState(
    pathname.startsWith("/dashboard/invoices"),
  );
  const [accountsOpen, setAccountsOpen] = useState(
    pathname.startsWith("/dashboard/accounts"),
  );
  const [preOrdersOpen, setPreOrdersOpen] = useState(
    pathname.startsWith("/dashboard/purchase-orders"),
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved) {
      setCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/users")) {
      setUserOpen(true);
    }
    if (pathname.startsWith("/dashboard/liquor-stock")) {
      setBikeOpen(true);
    }
    if (pathname.startsWith("/dashboard/inventory")) {
      setInventoryOpen(true);
    }
    if (pathname.startsWith("/dashboard/invoices")) {
      setInvoiceOpen(true);
    }
    if (pathname.startsWith("/dashboard/accounts")) {
      setAccountsOpen(true);
    }
    if (pathname.startsWith("/dashboard/purchase-orders")) {
      setPreOrdersOpen(true);
    }
  }, [pathname]);

  const isBikeActive = pathname.startsWith("/dashboard/liquor-stock");
  const isInventoryActive = pathname.startsWith("/dashboard/inventory");
  const isSupplierActive = pathname.startsWith("/dashboard/suppliers");
  const isLeasingActive = pathname.startsWith("/dashboard/wholesale-accounts");
  const isUserActive = pathname.startsWith("/dashboard/users");
  const isInvoiceActive = pathname.startsWith("/dashboard/invoices");
  const isAccountsActive = pathname.startsWith("/dashboard/accounts");
  const isPreOrdersActive = pathname.startsWith("/dashboard/purchase-orders");

  const isSubItemActive = (href: string) => pathname === href;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
        {!collapsed && (
          <>
            <Image
              src="/landing/lion-logo.png"
              alt="Bar Shop"
              width={32}
              height={32}
              style={{ borderRadius: 8, flexShrink: 0 }}
            />
            <span className="sidebar-brand">
              Bar Shop <strong>POS</strong>
            </span>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="sidebar-search">
          <IconSearch />
          <input type="text" placeholder="Quick search..." />
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, href, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <div key={key}>
              {key === "inventory" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isInventoryActive ? " active" : ""}`}
                    onClick={() => setInventoryOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: inventoryOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {inventoryOpen && (
                    <div className="nav-sub-group">
                      {INVENTORY_SUB_ITEMS.map(
                        ({
                          key: itemKey,
                          label: itemLabel,
                          href: itemHref,
                        }) => {
                          const itemActive = isSubItemActive(itemHref);
                          return (
                            <Link
                              key={itemKey}
                              href={itemHref}
                              className={`nav-sub-item${itemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{itemLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : key === "users" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isUserActive ? " active" : ""}`}
                    onClick={() => setUserOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: userOpen ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {userOpen && (
                    <div className="nav-sub-group">
                      {USER_SUB_ITEMS.map(
                        ({
                          key: itemKey,
                          label: itemLabel,
                          href: itemHref,
                        }) => {
                          const itemActive = isSubItemActive(itemHref);
                          return (
                            <Link
                              key={itemKey}
                              href={itemHref}
                              className={`nav-sub-item${itemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{itemLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : key === "suppliers" && !collapsed ? (
                <Link
                  href={href}
                  className={`nav-item${isSupplierActive ? " active" : ""}`}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon">
                    <Icon />
                  </span>
                  {!collapsed && <span className="nav-label">{label}</span>}
                  {!collapsed && isSupplierActive && <span className="nav-dot" />}
                </Link>
              ) : key === "bikes" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isBikeActive ? " active" : ""}`}
                    onClick={() => setBikeOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: bikeOpen ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {bikeOpen && (
                    <div className="nav-sub-group">
                      {BIKE_SUB_ITEMS.map(
                        ({
                          key: bikeKey,
                          label: bikeLabel,
                          href: bikeHref,
                        }) => {
                          const bikeItemActive = isSubItemActive(bikeHref);
                          return (
                            <Link
                              key={bikeKey}
                              href={bikeHref}
                              className={`nav-sub-item${bikeItemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{bikeLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : key === "inventory" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isInventoryActive ? " active" : ""}`}
                    onClick={() => setInventoryOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: inventoryOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {inventoryOpen && (
                    <div className="nav-sub-group">
                      {INVENTORY_SUB_ITEMS.map(
                        ({
                          key: itemKey,
                          label: itemLabel,
                          href: itemHref,
                        }) => {
                          const itemActive = isSubItemActive(itemHref);
                          return (
                            <Link
                              key={itemKey}
                              href={itemHref}
                              className={`nav-sub-item${itemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{itemLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : key === "pre-orders-requests" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isPreOrdersActive ? " active" : ""}`}
                    onClick={() => setPreOrdersOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: preOrdersOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {preOrdersOpen && (
                    <div className="nav-sub-group">
                      {PRE_ORDERS_SUB_ITEMS.map(
                        ({
                          key: itemKey,
                          label: itemLabel,
                          href: itemHref,
                        }) => {
                          const itemActive = isSubItemActive(itemHref);
                          return (
                            <Link
                              key={itemKey}
                              href={itemHref}
                              className={`nav-sub-item${itemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{itemLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : key === "leasing-companies" && !collapsed ? (
                <Link
                  href={href}
                  className={`nav-item${isLeasingActive ? " active" : ""}`}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon">
                    <Icon />
                  </span>
                  {!collapsed && <span className="nav-label">{label}</span>}
                  {!collapsed && isLeasingActive && <span className="nav-dot" />}
                </Link>
              ) : key === "invoices" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isInvoiceActive ? " active" : ""}`}
                    onClick={() => setInvoiceOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: invoiceOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {invoiceOpen && (
                    <div className="nav-sub-group">
                      {INVOICE_SUB_ITEMS.map(
                        ({
                          key: itemKey,
                          label: itemLabel,
                          href: itemHref,
                        }) => {
                          const itemActive = isSubItemActive(itemHref);
                          return (
                            <Link
                              key={itemKey}
                              href={itemHref}
                              className={`nav-sub-item${itemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{itemLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : key === "accounts" && !collapsed ? (
                <>
                  <button
                    type="button"
                    className={`nav-item nav-group-toggle${isAccountsActive ? " active" : ""}`}
                    onClick={() => setAccountsOpen((value) => !value)}
                  >
                    <span className="nav-icon">
                      <Icon />
                    </span>
                    <span className="nav-label">{label}</span>
                    <span
                      className="nav-chevron"
                      style={{
                        transform: accountsOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <IconChevronNav />
                    </span>
                  </button>
                  {accountsOpen && (
                    <div className="nav-sub-group">
                      {ACCOUNTS_SUB_ITEMS.map(
                        ({
                          key: itemKey,
                          label: itemLabel,
                          href: itemHref,
                        }) => {
                          const itemActive = isSubItemActive(itemHref);
                          return (
                            <Link
                              key={itemKey}
                              href={itemHref}
                              className={`nav-sub-item${itemActive ? " active" : ""}`}
                            >
                              <span className="nav-sub-dot" />
                              <span>{itemLabel}</span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={href}
                  className={`nav-item${isActive ? " active" : ""}`}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon">
                    <Icon />
                  </span>
                  {!collapsed && <span className="nav-label">{label}</span>}
                  {!collapsed && isActive && <span className="nav-dot" />}
                </Link>
              )}

            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="sidebar-footer">
          <span>POS v2.0</span>
          <span>Mar 2026</span>
        </div>
      )}
    </aside>
  );
}
