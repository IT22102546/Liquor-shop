import type { NextFunction, Request, Response } from "express";
import { validate } from "../../common/utils/errors";
import { sendSuccess } from "../../common/utils/response";
import { posLoginSchema } from "./dto/pos-login.dto";
import { createPosStaffSchema, updatePosStaffSchema } from "./dto/pos-staff.dto";
import * as posAuthService from "./pos-auth.service";
import { logActivity, requestMeta } from "../activity-log/activity-log.service";

export async function login(req: Request, res: Response, next: NextFunction) {
  const attemptedEmail = typeof req.body?.email === "string" ? req.body.email.trim().slice(0, 200) : null;
  try {
    const dto = validate(posLoginSchema, req.body);
    const result = await posAuthService.loginPosAdmin(dto);
    void logActivity({
      action: "auth.login",
      category: "AUTH",
      summary: `${result.admin.name} signed in`,
      actorId: result.admin.id,
      actorName: result.admin.name,
      actorEmail: result.admin.email,
      actorRole: result.admin.role,
      entityType: "staff",
      entityId: result.admin.id,
      ...requestMeta(req),
    });
    return sendSuccess(res, result);
  } catch (error) {
    void logActivity({
      action: "auth.login_failed",
      category: "AUTH",
      summary: `Failed sign-in attempt${attemptedEmail ? ` for ${attemptedEmail}` : ""}`,
      actorEmail: attemptedEmail,
      ...requestMeta(req),
    });
    return next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as Request & { user: { id: number; email: string; role: string } }).user;
    await logActivity({
      action: "auth.logout",
      category: "AUTH",
      summary: "Signed out",
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      entityType: "staff",
      entityId: user.id,
      ...requestMeta(req),
    });
    return sendSuccess(res, { message: "Signed out" });
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
