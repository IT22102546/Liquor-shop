import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../utils/errors";
import type { Role } from "../../generated/prisma";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: Role;
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized("No token provided"));
  }

  const token = header.split(" ")[1];
  try {
    // FIX: Use any to bypass type checking
    const decoded: any = jwt.verify(token, env.JWT_SECRET);

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    return next(AppError.unauthorized("Invalid or expired token"));
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    return next();
  };
}
