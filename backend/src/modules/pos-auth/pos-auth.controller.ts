import type { NextFunction, Request, Response } from "express";
import { validate } from "../../common/utils/errors";
import { sendSuccess } from "../../common/utils/response";
import { posLoginSchema } from "./dto/pos-login.dto";
import { createPosStaffSchema, updatePosStaffSchema } from "./dto/pos-staff.dto";
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

export async function listStaff(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await posAuthService.listPosStaff());
  } catch (error) {
    return next(error);
  }
}

export async function createStaff(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await posAuthService.createPosStaff(validate(createPosStaffSchema, req.body)));
  } catch (error) {
    return next(error);
  }
}

export async function updateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const currentAdminId = (req as Request & { user: { id: number } }).user.id;
    return sendSuccess(res, await posAuthService.updatePosStaff(
      Number(req.params.id),
      currentAdminId,
      validate(updatePosStaffSchema, req.body),
    ));
  } catch (error) {
    return next(error);
  }
}
