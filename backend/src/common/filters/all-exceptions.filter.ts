import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "../../generated/prisma";

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  details?: any;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.handleException(exception, request);

    // Log the error
    this.logError(exception, errorResponse, request);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private handleException(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const message =
        typeof exceptionResponse === "object" && "message" in exceptionResponse
          ? (exceptionResponse as any).message
          : exception.message;

      const error =
        typeof exceptionResponse === "object" && "error" in exceptionResponse
          ? (exceptionResponse as any).error
          : "Error";

      return {
        statusCode: status,
        message: Array.isArray(message) ? message.join(", ") : message,
        error,
        timestamp,
        path,
      };
    }

    // Handle Prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, timestamp, path);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Database validation error",
        error: "Validation Error",
        timestamp,
        path,
        details:
          process.env.NODE_ENV === "development"
            ? exception.message
            : undefined,
      };
    }

    // Handle generic errors
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          process.env.NODE_ENV === "development"
            ? exception.message
            : "Internal server error",
        error: "Internal Server Error",
        timestamp,
        path,
        details:
          process.env.NODE_ENV === "development"
            ? { stack: exception.stack }
            : undefined,
      };
    }

    // Unknown error type
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "An unexpected error occurred",
      error: "Internal Server Error",
      timestamp,
      path,
    };
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
    path: string
  ): ErrorResponse {
    switch (exception.code) {
      case "P2002":
        // Unique constraint violation
        const fields = (exception.meta?.target as string[]) || ["field"];
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${fields.join(", ")} already exists`,
          error: "Conflict",
          timestamp,
          path,
        };

      case "P2003":
        // Foreign key constraint violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Related record not found",
          error: "Bad Request",
          timestamp,
          path,
        };

      case "P2025":
        // Record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: "Record not found",
          error: "Not Found",
          timestamp,
          path,
        };

      case "P2014":
        // Required relation violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Required relation constraint violated",
          error: "Bad Request",
          timestamp,
          path,
        };

      case "P2016":
        // Query interpretation error
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Invalid query",
          error: "Bad Request",
          timestamp,
          path,
        };

      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Database error occurred",
          error: "Internal Server Error",
          timestamp,
          path,
          details:
            process.env.NODE_ENV === "development"
              ? { code: exception.code, meta: exception.meta }
              : undefined,
        };
    }
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request
  ): void {
    const logMessage = {
      statusCode: errorResponse.statusCode,
      message: errorResponse.message,
      path: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.get("user-agent"),
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        JSON.stringify(logMessage),
        exception instanceof Error ? exception.stack : undefined
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(JSON.stringify(logMessage));
    }
  }
}
