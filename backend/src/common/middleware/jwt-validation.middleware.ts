import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { AppException } from "@common/errors/app-exception";
import { ErrorCode } from "@common/errors/error-codes.enum";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

/**
 * Global JWT validation middleware for additional security layer
 * This runs before route guards and provides early validation
 */
@Injectable()
export class JwtValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtValidationMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip validation for public routes
    const publicPaths = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/health",
      "/api/docs",
      "/api-json",
    ];

    const isPublicPath = publicPaths.some((path) => req.path.startsWith(path));
    if (isPublicPath) {
      return next();
    }

    // Extract token
    const token = this.extractToken(req);

    // If no token, let the guards handle it
    if (!token) {
      return next();
    }

    try {
      // Perform early validation with strict options
      await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("jwt.secret"),
        algorithms: ["HS256"],
        ignoreExpiration: false,
        clockTolerance: 0,
      });

      next();
    } catch (error) {
      // Log suspicious activity
      this.logger.warn(
        `Invalid token attempt on ${req.method} ${req.path} from IP: ${req.ip}`,
        error instanceof Error ? error.message : String(error)
      );

      // Don't expose detailed error information
      throw AppException.unauthorized(
        "Invalid or expired authentication token"
      );
    }
  }

  private extractToken(req: Request): string | null {
    // Check cookie first
    if (req.cookies?.access_token) {
      return req.cookies.access_token;
    }

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }
}
