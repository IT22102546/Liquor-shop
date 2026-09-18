import type { NextFunction, Request, Response } from "express";
import { validate } from "../../common/utils/errors";
import { sendSuccess } from "../../common/utils/response";
import { posLoginSchema } from "./dto/pos-login.dto";
import * as posAuthService from "./pos-auth.service";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(posLoginSchema, req.body);
    const result = await posAuthService.loginPosAdmin(dto);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await posAuthService.getPosAdminFromToken(req.headers.authorization);
    return sendSuccess(res, admin);
  } catch (error) {
    return next(error);
  }
}
