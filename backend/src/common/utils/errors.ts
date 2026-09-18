import { z } from "zod";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(message, 403);
  }

  static notFound(message = "Not found") {
    return new AppError(message, 404);
  }

  static conflict(message = "Conflict") {
    return new AppError(message, 409);
  }

  static validation(errors: unknown) {
    return new AppError("Validation failed", 422, errors);
  }
}

// Zod validation helper: throws AppError on failure
export function validate<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw AppError.validation(result.error.flatten());
  }
  return result.data;
}
