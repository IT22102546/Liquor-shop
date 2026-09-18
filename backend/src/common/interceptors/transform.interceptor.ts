import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Request } from "express";

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    correlationId?: string;
    version?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = (request as any).correlationId;

    return next.handle().pipe(
      map((data) => {
        // If data already has a success field, it's likely already wrapped
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }

        // Handle paginated responses
        if (data && typeof data === "object" && "pagination" in data) {
          return {
            success: true,
            data: data.data,
            pagination: data.pagination,
            meta: {
              timestamp: new Date().toISOString(),
              correlationId,
              version: "1",
            },
          };
        }

        // Standard response wrapper
        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            correlationId,
            version: "1",
          },
        };
      })
    );
  }
}
