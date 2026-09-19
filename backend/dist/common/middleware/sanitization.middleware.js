"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizationMiddleware = void 0;
const common_1 = require("@nestjs/common");
let SanitizationMiddleware = class SanitizationMiddleware {
    use(req, res, next) {
        if (req.body) {
            req.body = this.sanitizeObject(req.body);
        }
        if (req.query) {
            req.query = this.sanitizeObject(req.query);
        }
        if (req.params) {
            req.params = this.sanitizeObject(req.params);
        }
        next();
    }
    sanitizeObject(obj) {
        if (typeof obj !== "object" || obj === null) {
            return this.sanitizeValue(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.sanitizeObject(item));
        }
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = this.sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }
    sanitizeValue(value) {
        if (typeof value !== "string") {
            return value;
        }
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
            .replace(/javascript:/gi, "")
            .replace(/data:text\/html/gi, "");
    }
};
exports.SanitizationMiddleware = SanitizationMiddleware;
exports.SanitizationMiddleware = SanitizationMiddleware = __decorate([
    (0, common_1.Injectable)()
], SanitizationMiddleware);
