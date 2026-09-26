"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAccess,
  IconAccounts,
  IconActivity,
  IconBar,
  IconBottle,
  IconChevronLeft,
  IconChevronRight,
  // IconContactRequests, // used by the hidden "Supplier Requests" link
  IconDashboard,
  IconInventory,
  IconInvoice,
  IconReceipt,
  IconSupplier,
  IconUsers,
} from "../lib/icons";
import { useAdmin } from "./AdminContext";
import { canAccessPath } from "../lib/roles";

type NavLink = { label: string; href: string; Icon: () => JSX.Element };

// The sidebar is the same on every page: fixed sections with plain links, filtered by role.
// No dropdowns, so nothing opens or changes shape while navigating.
const NAV_SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Sales",
    links: [
      { label: "Bar Counter", href: "/dashboard/inventory", Icon: IconBottle },
      { label: "Sold Products", href: "/dashboard/inventory/sold", Icon: IconReceipt },
    ],
  },
  {
    title: "Overview",
    links: [
      { label: "Dashboard", href: "/dashboard", Icon: IconDashboard },
      { label: "Activity Log", href: "/dashboard/logs", Icon: IconActivity },
    ],
  },
  {
    title: "Stock",
    links: [
      { label: "Product Setup", href: "/dashboard/inventory/manage", Icon: IconInventory },
      { label: "Suppliers", href: "/dashboard/suppliers", Icon: IconSupplier },
      // Hidden from the sidebar for now; the page still exists.
      // { label: "Supplier Requests", href: "/dashboard/purchasing-requests", Icon: IconContactRequests },
    ],
  },
  {
    title: "People",
    links: [
      { label: "Loyalty Customers", href: "/dashboard/users", Icon: IconUsers },
      { label: "Staff & Roles", href: "/dashboard/staff", Icon: IconAccess },
    ],
  },
  {
    title: "Billing",
    links: [
      { label: "Sales Bills", href: "/dashboard/sales", Icon: IconInvoice },
      { label: "Invoice Bank Details", href: "/dashboard/invoices/accounts", Icon: IconAccounts },
      // Hidden from the sidebar for now; the page still exists.
      // { label: "Terms & Conditions", href: "/dashboard/invoices/terms", Icon: IconReceipt },
    ],
  },
  {
    title: "Accounts",
    links: [
      { label: "Receipts", href: "/dashboard/accounts/receipts", Icon: IconReceipt },
      { label: "Vouchers", href: "/dashboard/accounts/vouchers", Icon: IconInvoice },
      { label: "General Ledger", href: "/dashboard/accounts/ledger", Icon: IconBar },
      { label: "Manage Accounts", href: "/dashboard/accounts", Icon: IconAccounts },
    ],
  },
];

const SIDEBAR_COLLAPSED_KEY = "pos-sidebar-collapsed";

export function Sidebar() {
  const { admin } = useAdmin();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const sections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => canAccessPath(admin.role, link.href)),
    }))
    .filter((section) => section.links.length > 0);

  // Highlight only the most specific matching link (e.g. Sold Products, not also Bar Counter).
  const activeHref = sections
    .flatMap((section) => section.links.map((link) => link.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        <button type="button" className="sidebar-collapse-btn" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
        {!collapsed && <><span className="sidebar-brand-mark" aria-hidden="true"><IconBar /></span><span className="sidebar-brand">Bar Shop <strong>POS</strong></span></>}
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.title} className="nav-section">
            {sections.length > 1 && (collapsed
              ? <div className="nav-section-divider" aria-hidden="true" />
              : <div className="nav-section-title">{section.title}</div>)}
            {section.links.map(({ label, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item${href === activeHref ? " active" : ""}`}
                title={collapsed ? label : undefined}
              >
                <span className="nav-icon"><Icon /></span>
                {!collapsed && <span className="nav-label">{label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {!collapsed && <div className="sidebar-footer"><span>BAR SHOP POS</span><span>Operations</span></div>}
    </aside>
  );
}
