import type { NextFunction, Request, Response } from "express";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { AppError, validate } from "../../common/utils/errors";
import {
  createInvoiceAccountSchema,
  createLeasingCompanySchema,
  createPurchaseSchema,
  createInvoiceTermSchema,
  createPosUserSchema,
  purchaseQuerySchema,
  posUserQuerySchema,
  settlePurchaseSchema,
  updateInvoiceAccountSchema,
  updateLeasingCompanySchema,
  updateInvoiceTermSchema,
  updatePosUserSchema,
  updatePurchaseSchema,
} from "./dto/pos-user.dto";
import * as service from "./pos-user-management.service";

function parsePositiveIntParam(
  paramName: string,
  raw: string | string[] | undefined,
) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw AppError.validation({
      [paramName]: [`${paramName} must be a positive integer`],
    });
  }
  return parsed;
}

export async function getProvinceDistrictMeta(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return sendSuccess(res, service.getProvinceDistrictMeta());
  } catch (error) {
    return next(error);
  }
}

export async function getDreamBikeOptions(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return sendSuccess(res, await service.listDreamBikeOptions());
  } catch (error) {
    return next(error);
  }
}

export async function getPosUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = validate(posUserQuerySchema, req.query);
    return sendSuccess(res, await service.listPosUsers(query));
  } catch (error) {
    return next(error);
  }
}

export async function getPosUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parsePositiveIntParam("id", req.params.id);
    return sendSuccess(res, await service.getPosUser(id));
  } catch (error) {
    return next(error);
  }
}

export async function createPosUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(createPosUserSchema, req.body);
    return sendCreated(res, await service.createPosUser(dto));
  } catch (error) {
    return next(error);
  }
}

export async function updatePosUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(updatePosUserSchema, req.body);
    const id = parsePositiveIntParam("id", req.params.id);
    return sendSuccess(res, await service.updatePosUser(id, dto));
  } catch (error) {
    return next(error);
  }
}

export async function deletePosUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parsePositiveIntParam("id", req.params.id);
    await service.deletePosUser(id);
    return sendSuccess(res, { message: "User deleted" });
  } catch (error) {
    return next(error);
  }
}

export async function createPurchase(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(createPurchaseSchema, req.body);
    const id = parsePositiveIntParam("id", req.params.id);
    const data = await service.createPurchase(id, dto);
    return sendCreated(res, data);
  } catch (error) {
    return next(error);
  }
}

export async function getPurchases(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = validate(purchaseQuerySchema, req.query);
    return sendSuccess(res, await service.listPurchases(query));
  } catch (error) {
    return next(error);
  }
}

export async function getPurchasesByUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = validate(purchaseQuerySchema, req.query);
    const id = parsePositiveIntParam("id", req.params.id);
    return sendSuccess(res, await service.listPurchasesByUser(id, query));
  } catch (error) {
    return next(error);
  }
}

export async function settlePurchase(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(settlePurchaseSchema, req.body);
    const id = parsePositiveIntParam("id", req.params.id);
    const purchaseId = parsePositiveIntParam(
      "purchaseId",
      req.params.purchaseId,
    );
    return sendSuccess(res, await service.settlePurchase(id, purchaseId, dto));
  } catch (error) {
    return next(error);
  }
}

export async function getPurchaseInstallments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const purchaseId = parsePositiveIntParam(
      "purchaseId",
      req.params.purchaseId,
    );
    return sendSuccess(res, await service.getPurchaseInstallments(purchaseId));
  } catch (error) {
    return next(error);
  }
}

export async function updatePurchase(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const purchaseId = parsePositiveIntParam("purchaseId", req.params.purchaseId);
    const dto = validate(updatePurchaseSchema, req.body);
    return sendSuccess(res, await service.updatePurchase(purchaseId, dto));
  } catch (error) {
    return next(error);
  }
}

export async function getInvoiceAccounts(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return sendSuccess(res, await service.listInvoiceAccounts());
  } catch (error) {
    return next(error);
  }
}

export async function createInvoiceAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(createInvoiceAccountSchema, req.body);
    return sendCreated(res, await service.createInvoiceAccount(dto));
  } catch (error) {
    return next(error);
  }
}

export async function updateInvoiceAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(updateInvoiceAccountSchema, req.body);
    const accountId = parsePositiveIntParam("accountId", req.params.accountId);
    return sendSuccess(res, await service.updateInvoiceAccount(accountId, dto));
  } catch (error) {
    return next(error);
  }
}

export async function deleteInvoiceAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const accountId = parsePositiveIntParam("accountId", req.params.accountId);
    await service.deleteInvoiceAccount(accountId);
    return sendSuccess(res, { message: "Invoice account deleted" });
  } catch (error) {
    return next(error);
  }
}

export async function getInvoiceTerms(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return sendSuccess(res, await service.listInvoiceTerms());
  } catch (error) {
    return next(error);
  }
}

export async function createInvoiceTerm(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(createInvoiceTermSchema, req.body);
    return sendCreated(res, await service.createInvoiceTerm(dto));
  } catch (error) {
    return next(error);
  }
}

export async function updateInvoiceTerm(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(updateInvoiceTermSchema, req.body);
    const termId = parsePositiveIntParam("termId", req.params.termId);
    return sendSuccess(res, await service.updateInvoiceTerm(termId, dto));
  } catch (error) {
    return next(error);
  }
}

export async function deleteInvoiceTerm(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const termId = parsePositiveIntParam("termId", req.params.termId);
    await service.deleteInvoiceTerm(termId);
    return sendSuccess(res, { message: "Invoice term deleted" });
  } catch (error) {
    return next(error);
  }
}

export async function getLeasingCompanies(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return sendSuccess(res, await service.listLeasingCompanies());
  } catch (error) {
    return next(error);
  }
}

export async function createLeasingCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(createLeasingCompanySchema, req.body);
    return sendCreated(res, await service.createLeasingCompany(dto));
  } catch (error) {
    return next(error);
  }
}

export async function updateLeasingCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dto = validate(updateLeasingCompanySchema, req.body);
    const companyId = parsePositiveIntParam("companyId", req.params.companyId);
    return sendSuccess(res, await service.updateLeasingCompany(companyId, dto));
  } catch (error) {
    return next(error);
  }
}

export async function deleteLeasingCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = parsePositiveIntParam("companyId", req.params.companyId);
    await service.deleteLeasingCompany(companyId);
    return sendSuccess(res, { message: "Leasing company deleted" });
  } catch (error) {
    return next(error);
  }
}

export async function getLeasingCompanyApplications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = validate(purchaseQuerySchema, req.query);
    const companyId = parsePositiveIntParam("companyId", req.params.companyId);
    return sendSuccess(
      res,
      await service.listLeasingApplicationsByCompany(companyId, query),
    );
  } catch (error) {
    return next(error);
  }
}
