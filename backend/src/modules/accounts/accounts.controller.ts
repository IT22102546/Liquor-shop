import type { NextFunction, Request, Response } from "express";
import { sendCreated, sendSuccess } from "../../common/utils/response";
import { AppError, validate } from "../../common/utils/errors";
import {
  createAccountSchema,
  updateAccountSchema,
  createReceiptSchema,
  updateReceiptSchema,
  createVoucherSchema,
  updateVoucherSchema,
  receiptQuerySchema,
  invoiceQueueQuerySchema,
  invoicePaymentQuerySchema,
  generateReceiptFromPaymentSchema,
  createDepositSchema,
  depositQuerySchema,
  voucherQuerySchema,
  ledgerQuerySchema,
} from "./dto/account.dto";
import * as service from "./accounts.service";

function parseId(raw: string | string[] | undefined, name = "id"): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw AppError.validation({ [name]: [`${name} must be a positive integer`] });
  }
  return n;
}

function getAdminId(req: Request): number {
  return (req.user as { id: number }).id;
}

// ─── Chart of Accounts ────────────────────────────────────────────────────────

export async function getAccounts(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await service.listAccounts());
  } catch (e) {
    return next(e);
  }
}

export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(createAccountSchema, req.body);
    return sendCreated(res, await service.createAccount(dto));
  } catch (e) {
    return next(e);
  }
}

export async function updateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const dto = validate(updateAccountSchema, req.body);
    return sendSuccess(res, await service.updateAccount(id, dto));
  } catch (e) {
    return next(e);
  }
}

export async function toggleAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.toggleAccountActive(id));
  } catch (e) {
    return next(e);
  }
}

// ─── Invoice Queue ────────────────────────────────────────────────────────────

export async function getPurchasesForReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(invoiceQueueQuerySchema, req.query);
    return sendSuccess(res, await service.listPurchasesForReceipt(dto));
  } catch (e) {
    return next(e);
  }
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

export async function getReceipts(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(receiptQuerySchema, req.query);
    return sendSuccess(res, await service.listReceipts(dto));
  } catch (e) {
    return next(e);
  }
}

export async function getReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.getReceiptById(id));
  } catch (e) {
    return next(e);
  }
}

export async function createReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(createReceiptSchema, req.body);
    return sendCreated(res, await service.createReceipt(dto, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function updateReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const dto = validate(updateReceiptSchema, req.body);
    return sendSuccess(res, await service.updateReceipt(id, dto, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function voidReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.voidReceipt(id, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function bounceReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.bounceReceipt(id, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function clearCheque(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.clearCheque(id));
  } catch (e) {
    return next(e);
  }
}

// ─── Invoice Payment Queue ────────────────────────────────────────────────────

export async function getInvoicePayments(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(invoicePaymentQuerySchema, req.query);
    return sendSuccess(res, await service.listInvoicePayments(dto));
  } catch (e) {
    return next(e);
  }
}

export async function generateReceiptFromPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const dto = validate(generateReceiptFromPaymentSchema, req.body);
    return sendCreated(res, await service.generateReceiptFromPayment(id, dto, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

export async function getDeposits(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(depositQuerySchema, req.query);
    return sendSuccess(res, await service.listDeposits(dto));
  } catch (e) {
    return next(e);
  }
}

export async function getDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.getDeposit(id));
  } catch (e) {
    return next(e);
  }
}

export async function createDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(createDepositSchema, req.body);
    return sendCreated(res, await service.createDeposit(dto, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function reverseDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.reverseDeposit(id, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

// ─── Vouchers ─────────────────────────────────────────────────────────────────

export async function getVouchers(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(voucherQuerySchema, req.query);
    return sendSuccess(res, await service.listVouchers(dto));
  } catch (e) {
    return next(e);
  }
}

export async function getVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.getVoucherById(id));
  } catch (e) {
    return next(e);
  }
}

export async function createVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(createVoucherSchema, req.body);
    return sendCreated(res, await service.createVoucher(dto, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function updateVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const dto = validate(updateVoucherSchema, req.body);
    return sendSuccess(res, await service.updateVoucher(id, dto, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

export async function voidVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.voidVoucher(id, getAdminId(req)));
  } catch (e) {
    return next(e);
  }
}

// ─── General Ledger ───────────────────────────────────────────────────────────

export async function getLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = validate(ledgerQuerySchema, req.query);
    return sendSuccess(res, await service.getLedger(dto));
  } catch (e) {
    return next(e);
  }
}

// ─── Account Balance ──────────────────────────────────────────────────────────

export async function getAccountBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    return sendSuccess(res, await service.getAccountBalance(id));
  } catch (e) {
    return next(e);
  }
}
