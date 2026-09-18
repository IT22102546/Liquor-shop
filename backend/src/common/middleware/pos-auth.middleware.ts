import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../utils/errors";

type PosJwtPayload = { sub: number; email: string; type: "pos_admin" };

/**
 * Middleware that validates the POS admin JWT token (type === "pos_admin").
 * Used to protect POS-specific routes instead of the regular user authenticate().
 */
export function authenticatePosAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized("No token provided"));
  }

  const token = header.slice(7);
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(AppError.unauthorized("Invalid or expired token"));
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    (decoded as { type?: unknown }).type !== "pos_admin"
  ) {
    return next(AppError.forbidden("POS admin access required"));
  }

  const p = decoded as PosJwtPayload;
  // Attach a minimal stub so code that reads req.user still works
  (req as unknown as { user: unknown }).user = { id: p.sub, email: p.email, role: "POS_ADMIN" };
  return next();
}
