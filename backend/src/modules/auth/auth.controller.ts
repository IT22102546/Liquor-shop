import type { Request, Response, NextFunction } from "express";
import { validate } from "../../common/utils/errors";
import { sendSuccess, sendCreated } from "../../common/utils/response";
import { registerSchema } from "./dto/register.dto";
import { loginSchema } from "./dto/login.dto";
import { refreshSchema } from "./dto/refresh.dto";
import * as authService from "./auth.service";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(registerSchema, req.body);
    const result = await authService.registerUser(dto);
    return sendCreated(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(loginSchema, req.body);
    const result = await authService.loginUser(dto);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = validate(refreshSchema, req.body);
    const result = await authService.refreshAccessToken(refreshToken);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logoutUser(req.user!.id);
    return sendSuccess(res, { message: "Logged out successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.id);
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}