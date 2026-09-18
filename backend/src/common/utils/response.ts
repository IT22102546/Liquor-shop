import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(res: Response, message: string, statusCode = 400, errors?: unknown) {
  return res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });
}

export function sendCreated<T>(res: Response, data: T) {
  return sendSuccess(res, data, 201);
}
