import express from "express";
import cors from "cors";
import path from "path";
import { env } from "./config/env";
import {
  errorHandler,
  notFoundHandler,
} from "./common/middleware/error.middleware";
import authRoutes from "./modules/auth/auth.routes";
import bikesRoutes from "./modules/bikes/bikes.routes";
import posAuthRoutes from "./modules/pos-auth/pos-auth.routes";
import bikeManagementRoutes from "./modules/bike-management/bike-management.routes";
import posUserManagementRoutes from "./modules/pos-user-management/pos-user-management.routes";
import preOrdersPosRouter, {
  publicPreOrdersRouter,
} from "./modules/pre-orders/pre-orders.routes";
import contactRequestsPosRouter, {
  publicContactRequestsRouter,
} from "./modules/contact-requests/contact-requests.routes";
import accountsRouter from "./modules/accounts/accounts.routes";

const app = express();

/* ──────────────────── Global middleware ──────────────────── */
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ──────────────────── Static uploads ────────────────────── */
const backendRoot = process.cwd().endsWith("backend")
  ? process.cwd()
  : path.join(process.cwd(), "apps", "backend");
const uploadsPath = path.join(backendRoot, "uploads");
console.log("[static] Serving uploads from:", uploadsPath);
app.use("/uploads", express.static(uploadsPath));

/* ──────────────────── Health check ──────────────────────── */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/* ──────────────────── API Routes ────────────────────────── */
app.use("/api/auth", authRoutes);
app.use("/api/bikes", bikesRoutes);
app.use("/api/pre-orders", publicPreOrdersRouter);
app.use("/api/pos/auth", posAuthRoutes);
app.use("/api/pos/bike-management", bikeManagementRoutes);
app.use("/api/pos/user-management", posUserManagementRoutes);
app.use("/api/pos/pre-orders", preOrdersPosRouter);
app.use("/api/contact-requests", publicContactRequestsRouter);
app.use("/api/pos/contact-requests", contactRequestsPosRouter);
app.use("/api/pos/accounts", accountsRouter);

/* ──────────────────── Error handling ────────────────────── */
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
