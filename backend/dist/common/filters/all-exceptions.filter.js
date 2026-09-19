"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const prisma_1 = require("../../generated/prisma");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const errorResponse = this.handleException(exception, request);
        this.logError(exception, errorResponse, request);
        response.status(errorResponse.statusCode).json(errorResponse);
    }
    handleException(exception, request) {
        const timestamp = new Date().toISOString();
        const path = request.url;
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            const message = typeof exceptionResponse === "object" && "message" in exceptionResponse
                ? exceptionResponse.message
                : exception.message;
            const error = typeof exceptionResponse === "object" && "error" in exceptionResponse
                ? exceptionResponse.error
                : "Error";
            return {
                statusCode: status,
                message: Array.isArray(message) ? message.join(", ") : message,
                error,
                timestamp,
                path,
            };
        }
        if (exception instanceof prisma_1.Prisma.PrismaClientKnownRequestError) {
            return this.handlePrismaError(exception, timestamp, path);
        }
        if (exception instanceof prisma_1.Prisma.PrismaClientValidationError) {
            return {
                statusCode: common_1.HttpStatus.BAD_REQUEST,
                message: "Database validation error",
                error: "Validation Error",
                timestamp,
                path,
                details: process.env.NODE_ENV === "development"
                    ? exception.message
                    : undefined,
            };
        }
        if (exception instanceof Error) {
            return {
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: process.env.NODE_ENV === "development"
                    ? exception.message
                    : "Internal server error",
                error: "Internal Server Error",
                timestamp,
                path,
                details: process.env.NODE_ENV === "development"
                    ? { stack: exception.stack }
                    : undefined,
            };
        }
        return {
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message: "An unexpected error occurred",
            error: "Internal Server Error",
            timestamp,
            path,
        };
    }
    handlePrismaError(exception, timestamp, path) {
        switch (exception.code) {
            case "P2002":
                const fields = exception.meta?.target || ["field"];
                return {
                    statusCode: common_1.HttpStatus.CONFLICT,
                    message: `A record with this ${fields.join(", ")} already exists`,
                    error: "Conflict",
                    timestamp,
                    path,
                };
            case "P2003":
                return {
                    statusCode: common_1.HttpStatus.BAD_REQUEST,
                    message: "Related record not found",
                    error: "Bad Request",
                    timestamp,
                    path,
                };
            case "P2025":
                return {
                    statusCode: common_1.HttpStatus.NOT_FOUND,
                    message: "Record not found",
                    error: "Not Found",
                    timestamp,
                    path,
                };
            case "P2014":
                return {
                    statusCode: common_1.HttpStatus.BAD_REQUEST,
                    message: "Required relation constraint violated",
                    error: "Bad Request",
                    timestamp,
                    path,
                };
            case "P2016":
                return {
                    statusCode: common_1.HttpStatus.BAD_REQUEST,
                    message: "Invalid query",
                    error: "Bad Request",
                    timestamp,
                    path,
                };
            default:
                return {
                    statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                    message: "Database error occurred",
                    error: "Internal Server Error",
                    timestamp,
                    path,
                    details: process.env.NODE_ENV === "development"
                        ? { code: exception.code, meta: exception.meta }
                        : undefined,
                };
        }
    }
    logError(exception, errorResponse, request) {
        const logMessage = {
            statusCode: errorResponse.statusCode,
            message: errorResponse.message,
            path: request.url,
            method: request.method,
            ip: request.ip,
            userAgent: request.get("user-agent"),
        };
        if (errorResponse.statusCode >= 500) {
            this.logger.error(JSON.stringify(logMessage), exception instanceof Error ? exception.stack : undefined);
        }
        else if (errorResponse.statusCode >= 400) {
            this.logger.warn(JSON.stringify(logMessage));
        }
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
