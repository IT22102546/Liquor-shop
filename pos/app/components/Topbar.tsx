"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useAdmin } from "./AdminContext";
import { API_URL } from "../lib/constants";
import { ROLE_LABELS } from "../lib/roles";
import {
  IconSun,
  IconMoon,
  IconBell,
  IconSearch,
  IconClock,
  IconLogout,
  IconChevronDown,
  IconChevronNav,
} from "../lib/icons";

type LowStockNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
};

type InventoryProductAlert = {
  id: number;
  name: string;
  quantity: number;
  lowStockThreshold?: number | null;
};

const BREADCRUMBS: Record<string, string> = {
  "/dashboard":            "Dashboard",
  "/dashboard/staff":      "Staff & Role Management",
  "/dashboard/users":     "User Management",
  "/dashboard/users/history": "User Management - User History",
  "/dashboard/invoices":  "Invoice Management",
  "/dashboard/invoices/accounts": "Invoice Management - Account Details",
  "/dashboard/invoices/terms": "Invoice Management - Terms & Conditions",
  "/dashboard/inventory": "Drinks & Products - Inventory",
  "/dashboard/inventory/sold": "Drinks & Products - Sold Items",
  "/dashboard/inventory/manage": "Drinks & Products - Manage Data",
  "/dashboard/suppliers": "Beverage Suppliers",
  "/dashboard/liquor-stock":     "Liquor Stock",
  "/dashboard/liquor-stock/sold": "Sold Liquor Products",
  "/dashboard/liquor-stock/manage": "Liquor Product Setup",
};

const LOW_STOCK_READ_STORAGE_KEY = "pos_low_stock_notifications_read";
const LOW_STOCK_DELETED_STORAGE_KEY = "pos_low_stock_notifications_deleted";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { admin, logout, token } = useAdmin();
  const pathname = usePathname();
  const [clockTime, setClockTime] = useState("");
  const [clockDate, setClockDate] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<LowStockNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>([]);
  const [notificationStateReady, setNotificationStateReady] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setClockDate(now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedReadIds = JSON.parse(window.localStorage.getItem(LOW_STOCK_READ_STORAGE_KEY) ?? "[]");
      const savedDeletedIds = JSON.parse(window.localStorage.getItem(LOW_STOCK_DELETED_STORAGE_KEY) ?? "[]");
      setReadNotificationIds(Array.isArray(savedReadIds) ? savedReadIds : []);
      setDeletedNotificationIds(Array.isArray(savedDeletedIds) ? savedDeletedIds : []);
    } catch {
      setReadNotificationIds([]);
      setDeletedNotificationIds([]);
    } finally {
      setNotificationStateReady(true);
    }
  }, []);

  useEffect(() => {
    if (!notificationStateReady || typeof window === "undefined") return;
    window.localStorage.setItem(LOW_STOCK_READ_STORAGE_KEY, JSON.stringify(readNotificationIds));
  }, [notificationStateReady, readNotificationIds]);

  useEffect(() => {
    if (!notificationStateReady || typeof window === "undefined") return;
    window.localStorage.setItem(LOW_STOCK_DELETED_STORAGE_KEY, JSON.stringify(deletedNotificationIds));
  }, [notificationStateReady, deletedNotificationIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let alive = true;

    const loadNotifications = async () => {
      try {
        const auth = { Authorization: `Bearer ${token}` };
        const inventoryResponse = await fetch(`${API_URL}/api/pos/inventory-management/products?limit=5000`, { headers: auth, cache: "no-store" });

        if (inventoryResponse.status === 401 || inventoryResponse.status === 403) {
          logout();
          return;
        }

        const inventoryPayload = await inventoryResponse.json() as { data?: { products?: InventoryProductAlert[] } };

        const inventoryNotifications: LowStockNotification[] = (inventoryPayload.data?.products ?? [])
          .filter((product) => (product.lowStockThreshold ?? 0) > 0 && product.quantity <= (product.lowStockThreshold ?? 0))
          .map((product) => ({
            id: `inventory-${product.id}`,
            title: product.name,
            message: `Only ${product.quantity} units left. Alert level: ${product.lowStockThreshold}`,
            href: "/dashboard/inventory",
          }));

        if (alive) {
          const nextNotifications = inventoryNotifications;
          setNotifications(nextNotifications);
          setReadNotificationIds((current) => current.filter((id) => nextNotifications.some((notification) => notification.id === id)));
          setDeletedNotificationIds((current) => current.filter((id) => nextNotifications.some((notification) => notification.id === id)));
        }
      } catch {
        if (alive) {
          setNotifications([]);
        }
      }
    };

    void loadNotifications();
    const intervalId = window.setInterval(() => { void loadNotifications(); }, 60000);
    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [token, logout, pathname]);

  const visibleNotifications = notifications.filter((notification) => !deletedNotificationIds.includes(notification.id));
  const unreadCount = visibleNotifications.filter((notification) => !readNotificationIds.includes(notification.id)).length;

  const markNotificationAsRead = (id: string) => {
    setReadNotificationIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const markAllNotificationsAsRead = () => {
    setReadNotificationIds((current) => Array.from(new Set([...current, ...visibleNotifications.map((notification) => notification.id)])));
  };

  const deleteNotification = (id: string) => {
    setDeletedNotificationIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const deleteAllNotifications = () => {
    setDeletedNotificationIds((current) => Array.from(new Set([...current, ...visibleNotifications.map((notification) => notification.id)])));
  };

  const pageLabel = BREADCRUMBS[pathname] ?? "Dashboard";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          <span className="topbar-breadcrumb-root">POS</span>
          <IconChevronNav />
          <span className="topbar-breadcrumb-page">{pageLabel}</span>
        </div>
        {pathname !== "/dashboard/inventory" && (
          <div className="topbar-search">
            <IconSearch />
            <input type="text" placeholder="Search anything…" />
          </div>
        )}
      </div>

      {clockTime && (
        <div className="topbar-clock">
          <IconClock />
          <div className="topbar-clock-text">
            <span className="clock-time">{clockTime}</span>
            <span className="clock-date">{clockDate}</span>
          </div>
        </div>
      )}

      <div className="topbar-right">
        <button type="button" className="icon-btn theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "light" ? <IconMoon /> : <IconSun />}
        </button>
        <div ref={notificationPanelRef} className="topbar-notification-wrap">
          <button type="button" className="icon-btn notif-btn" aria-label="Notifications" onClick={() => setShowNotifications((value) => !value)}>
            <IconBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          {showNotifications && (
            <div className="topbar-notification-panel">
              <div className="topbar-notification-header">
                <div>
                  <strong>Low stock notifications</strong>
                  <div className="topbar-notification-subtitle">{unreadCount} unread</div>
                </div>
                <div className="topbar-notification-toolbar">
                  <button type="button" className="bm-btn-ghost topbar-notification-toolbar-btn" onClick={markAllNotificationsAsRead} disabled={visibleNotifications.length === 0 || unreadCount === 0}>Mark all read</button>
                  <button type="button" className="bm-btn-ghost topbar-notification-toolbar-btn" onClick={deleteAllNotifications} disabled={visibleNotifications.length === 0}>Delete all</button>
                </div>
              </div>
              {visibleNotifications.length === 0 ? (
                <div className="topbar-notification-empty">All stock levels are healthy.</div>
              ) : (
                <div className="topbar-notification-list">
                  {visibleNotifications.map((notification) => {
                    const isRead = readNotificationIds.includes(notification.id);
                    return (
                      <div
                        key={notification.id}
                        className={`topbar-notification-item ${isRead ? "is-read" : "is-unread"}`}
                      >
                        <div className="topbar-notification-item-head">
                          <strong className="topbar-notification-title">{notification.title}</strong>
                          <span className="badge badge-warning">Product</span>
                        </div>
                        <span className="topbar-notification-message">{notification.message}</span>
                        <div className="topbar-notification-footer">
                          <Link
                            href={notification.href}
                            onClick={() => {
                              markNotificationAsRead(notification.id);
                              setShowNotifications(false);
                            }}
                            className="topbar-notification-link"
                          >
                            Open
                          </Link>
                          <div className="topbar-notification-actions">
                            {!isRead && (
                              <button
                                type="button"
                                className="bm-btn-ghost topbar-notification-action-btn"
                                onClick={() => markNotificationAsRead(notification.id)}
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              type="button"
                              className="bm-btn-ghost topbar-notification-action-btn"
                              onClick={() => deleteNotification(notification.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="topbar-divider" />
        <div className="admin-pill">
          <div className="admin-avatar">{admin.name.charAt(0).toUpperCase()}</div>
          <div className="admin-info">
            <span className="admin-name">{admin.name}</span>
            <span className="admin-role">{ROLE_LABELS[admin.role] ?? "Staff"}</span>
          </div>
          <IconChevronDown />
        </div>
        <button type="button" className="topbar-logout-btn" onClick={logout} aria-label="Sign out">
          <IconLogout />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
