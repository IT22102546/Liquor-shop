import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = this.sanitizeObject(req.params);
    }

    next();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== "object" || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
    }

    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value !== "string") {
      return value;
    }

    // Remove potentially dangerous HTML tags and scripts
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove <script> tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "") // Remove <iframe> tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "") // Remove <object> tags
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "") // Remove <embed> tags
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove inline event handlers (onclick, onerror, etc.)
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/data:text\/html/gi, ""); // Remove data:text/html
  }
}
