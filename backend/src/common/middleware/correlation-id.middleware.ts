import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existing = (req.headers["x-correlation-id"] ||
      req.headers["x-request-id"]) as string | undefined;
    const correlationId = existing || randomUUID();

    // Attach to request and response for downstream access
    (req as any).correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    // Also standardize header on request for any libraries reading it
    req.headers["x-correlation-id"] = correlationId;

    next();
  }
}
