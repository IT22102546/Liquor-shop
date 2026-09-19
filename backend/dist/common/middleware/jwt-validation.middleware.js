"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var JwtValidationMiddleware_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtValidationMiddleware = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("@common/errors/app-exception");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
let JwtValidationMiddleware = JwtValidationMiddleware_1 = class JwtValidationMiddleware {
    jwtService;
    configService;
    logger = new common_1.Logger(JwtValidationMiddleware_1.name);
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async use(req, res, next) {
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
        const token = this.extractToken(req);
        if (!token) {
            return next();
        }
        try {
            await this.jwtService.verifyAsync(token, {
                secret: this.configService.get("jwt.secret"),
                algorithms: ["HS256"],
                ignoreExpiration: false,
                clockTolerance: 0,
            });
            next();
        }
        catch (error) {
            this.logger.warn(`Invalid token attempt on ${req.method} ${req.path} from IP: ${req.ip}`, error instanceof Error ? error.message : String(error));
            throw app_exception_1.AppException.unauthorized("Invalid or expired authentication token");
        }
    }
    extractToken(req) {
        if (req.cookies?.access_token) {
            return req.cookies.access_token;
        }
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
};
exports.JwtValidationMiddleware = JwtValidationMiddleware;
exports.JwtValidationMiddleware = JwtValidationMiddleware = JwtValidationMiddleware_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], JwtValidationMiddleware);
