import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { prismaModelHasObjectField } from "../../common/utils/prisma-model";
import {
  AccountLevel,
  ChequeStatus,
  PaymentMethod,
  TransactionDirection,
  TransactionType,
} from "../../generated/prisma";
import type {
  CreateAccountDto,
  UpdateAccountDto,
  CreateReceiptDto,
  UpdateReceiptDto,
  CreateVoucherDto,
  UpdateVoucherDto,
  ReceiptQueryDto,
  InvoiceQueueQueryDto,
  InvoicePaymentQueryDto,
  GenerateReceiptFromPaymentDto,
  CreateDepositDto,
  DepositQueryDto,
  VoucherQueryDto,
  LedgerQueryDto,
} from "./dto/account.dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCOUNT_TRANSFER_TYPE = "ACCOUNT_TRANSFER";
const TRANSFER_TRANSACTION_TYPE = "TRANSFER";
const VOUCHER_TYPE_LABELS: Record<string, string> = {
  VEHICLE_CLEARANCE: "Vehicle Clearance Payment",
  BILL: "Bill",
  OTHER_PAYMENT: "Other Payment",
  PERMIT: "Permit Payment",
  LEASING_PAYMENT: "Leasing Payment",
  LOAN_PAYMENT: "Loan Payment",
  SALARY: "Salary",
  CUSTOMER_REFUND: "Customer Refund",
  VEHICLE_PURCHASE: "Vehicle Purchase",
  ADVANCE_REFUND: "Advance Invoice Refund",
  [ACCOUNT_TRANSFER_TYPE]: "Account Transfer",
};

async function generateAccountCode(): Promise<string> {
  const count = await prisma.account.count();
  return `ACC-${String(count + 1).padStart(3, "0")}`;
}

function voucherTypeLabel(type: string): string {
  return VOUCHER_TYPE_LABELS[type] ?? type;
}

function calculateTotalReceivable(p: {
  finalSellingPrice: number;
  totalWithInterest: number | null;
  hasRegistrationFee: boolean;
  registrationFeeAmount: number;
  purchaseChannel: string;
  leasingDownPaymentAmount: number;
}): number {
  const regFee = p.hasRegistrationFee ? p.registrationFeeAmount : 0;
  if (p.purchaseChannel === "LEASING") {
    return p.leasingDownPaymentAmount + regFee;
  }
  return (p.totalWithInterest ?? p.finalSellingPrice) + regFee;
}

type VoucherRow = Prisma.AccountVoucherGetPayload<{
  include: {
    account: { select: { id: true; name: true; code: true } };
  };
}>;

type AccountSummary = {
  id: number;
  name: string;
  code: string;
};

type RawVoucherRow = {
  id: number;
  voucherNo: string;
  accountId: number;
  toAccountId: number | null;
  type: string;
  amount: number;
  description: string | null;
  payee: string | null;
  paymentDate: Date | null;
  referenceNo: string | null;
  isVoided: boolean;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  account_id: number;
  account_name: string;
  account_code: string;
  toAccount_id: number | null;
  toAccount_name: string | null;
  toAccount_code: string | null;
};

type RawTransferTransaction = {
  id: number;
  accountId: number;
  direction: string;
  amount: number;
};

type RawLedgerTransaction = {
  id: number;
  type: string;
  direction: string;
  amount: number;
  refNo: string | null;
  description: string | null;
  chequeNo: string | null;
  isReversal: boolean;
  createdById: number;
  createdAt: Date;
};

type RawQueryClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Prisma.PrismaPromise<T>;
};

async function resolveVoucherToAccount(
  client: Pick<typeof prisma, "account">,
  toAccountId: number | null
): Promise<AccountSummary | null> {
  if (!toAccountId) return null;
  return client.account.findUnique({
    where: { id: toAccountId },
    select: { id: true, name: true, code: true },
  });
}

async function createVoucherDraft(
  tx: Prisma.TransactionClient,
  dto: CreateVoucherDto,
  adminId: number
): Promise<{ id: number }> {
  if (dto.type !== ACCOUNT_TRANSFER_TYPE) {
    return tx.accountVoucher.create({
      data: {
        voucherNo: "TEMP",
        accountId: dto.accountId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        createdById: adminId,
      },
      select: { id: true },
    });
  }

  const [created] = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO "account_vouchers" (
      "voucherNo",
      "accountId",
      "type",
      "amount",
      "description",
      "createdById",
      "updatedAt"
    )
    VALUES (
      ${"TEMP"},
      ${dto.accountId},
      ${ACCOUNT_TRANSFER_TYPE}::"VoucherType",
      ${dto.amount},
      ${dto.description ?? null},
      ${adminId},
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `;

  if (!created) {
    throw new AppError("Failed to create account transfer voucher", 500);
  }

  return created;
}

async function createTransferTransaction(
  tx: Prisma.TransactionClient,
  data: {
    accountId: number;
    direction: "DR" | "CR";
    amount: number;
    voucherId: number;
    refNo: string;
    description: string;
    createdById: number;
  }
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "account_transactions" (
      "accountId",
      "type",
      "direction",
      "amount",
      "voucherId",
      "refNo",
      "description",
      "createdById"
    )
    VALUES (
      ${data.accountId},
      ${TRANSFER_TRANSACTION_TYPE}::"TransactionType",
      ${data.direction}::"TransactionDirection",
      ${data.amount},
      ${data.voucherId},
      ${data.refNo},
      ${data.description},
      ${data.createdById}
    )
  `;
}

async function findRawVoucherById(
  client: RawQueryClient,
  id: number
): Promise<RawVoucherRow | null> {
  const [voucher] = await client.$queryRaw<RawVoucherRow[]>`
    SELECT
      v."id",
      v."voucherNo",
      v."accountId",
      v."toAccountId",
      v."type"::text AS "type",
      v."amount",
      v."description",
      v."payee",
      v."paymentDate",
      v."referenceNo",
      v."isVoided",
      v."createdById",
      v."createdAt",
      v."updatedAt",
      a."id" AS "account_id",
      a."name" AS "account_name",
      a."code" AS "account_code",
      ta."id" AS "toAccount_id",
      ta."name" AS "toAccount_name",
      ta."code" AS "toAccount_code"
    FROM "account_vouchers" v
    JOIN "accounts" a ON a."id" = v."accountId"
    LEFT JOIN "accounts" ta ON ta."id" = v."toAccountId"
    WHERE v."id" = ${id}
    LIMIT 1
  `;

  return voucher ?? null;
}

function mapRawVoucherRow(row: RawVoucherRow) {
  return {
    id: row.id,
    voucherNo: row.voucherNo,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    type: row.type,
    amount: row.amount,
    description: row.description,
    payee: row.payee,
    paymentDate: row.paymentDate,
    referenceNo: row.referenceNo,
    isVoided: row.isVoided,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    account: {
      id: row.account_id,
      name: row.account_name,
      code: row.account_code,
    },
    toAccount: row.toAccount_id
      ? {
          id: row.toAccount_id,
          name: row.toAccount_name ?? "",
          code: row.toAccount_code ?? "",
        }
      : null,
  };
}

function mapVoucherRow(row: VoucherRow, toAccount: AccountSummary | null) {
  return {
    id: row.id,
    voucherNo: row.voucherNo,
    accountId: row.accountId,
    type: row.type,
    amount: row.amount,
    description: row.description,
    payee: row.payee,
    paymentDate: row.paymentDate,
    referenceNo: row.referenceNo,
    isVoided: row.isVoided,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    account: row.account,
    toAccount,
  };
}

// ─── Chart of Accounts ────────────────────────────────────────────────────────

export async function listAccounts() {
  const accounts = await prisma.account.findMany({
    orderBy: { code: "asc" },
    include: {
      mainLinks: {
        include: { subAccount: { select: { id: true, name: true, code: true } } },
      },
      subLinks: {
        include: { mainAccount: { select: { id: true, name: true, code: true } } },
      },
    },
  });
  return accounts.map(({ mainLinks, subLinks, ...account }) => ({
    ...account,
    subAccounts: mainLinks.map((link) => link.subAccount),
    mainAccounts: subLinks.map((link) => link.mainAccount),
  }));
}

export async function createAccount(dto: CreateAccountDto) {
  const code = await generateAccountCode();
  const mainAccountIds = [...new Set(dto.mainAccountIds)];
  if (dto.level === AccountLevel.SUB && mainAccountIds.length > 0) {
    const validMainCount = await prisma.account.count({
      where: { id: { in: mainAccountIds }, level: AccountLevel.MAIN, isActive: true },
    });
    if (validMainCount !== mainAccountIds.length) {
      throw new AppError("One or more selected main accounts are invalid or inactive", 400);
    }
  }

  return prisma.account.create({
    data: {
      name: dto.name,
      type: dto.type,
      level: dto.level,
      openingBalance: dto.openingBalance ?? 0,
      code,
      ...(dto.level === AccountLevel.SUB && mainAccountIds.length > 0
        ? { subLinks: { create: mainAccountIds.map((mainAccountId) => ({ mainAccountId })) } }
        : {}),
    },
    include: {
      subLinks: {
        include: { mainAccount: { select: { id: true, name: true, code: true } } },
      },
    },
  });
}

export async function updateAccount(id: number, dto: UpdateAccountDto) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: { subLinks: true, mainLinks: true },
  });
  if (!account) throw AppError.notFound("Account not found");
  const level = dto.level ?? account.level;
  const mainAccountIds = [...new Set(
    dto.mainAccountIds ?? account.subLinks.map((link) => link.mainAccountId),
  )];

  if (level === AccountLevel.MAIN && mainAccountIds.length > 0) {
    throw new AppError("Main accounts cannot be linked beneath other main accounts", 400);
  }
  if (level === AccountLevel.SUB && mainAccountIds.length > 0) {
    const validMainCount = await prisma.account.count({
      where: {
        id: { in: mainAccountIds, not: id },
        level: AccountLevel.MAIN,
        isActive: true,
      },
    });
    if (validMainCount !== mainAccountIds.length) {
      throw new AppError("One or more selected main accounts are invalid or inactive", 400);
    }
  }

  if (level !== account.level) {
    const usageCount = await prisma.accountTransaction.count({ where: { accountId: id } });
    if (usageCount > 0 || account.mainLinks.length > 0 || account.subLinks.length > 0) {
      throw new AppError("An account with transactions or relationships cannot change level", 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.accountRelationship.deleteMany({ where: { subAccountId: id } });
    if (level === AccountLevel.SUB && mainAccountIds.length > 0) {
      await tx.accountRelationship.createMany({
        data: mainAccountIds.map((mainAccountId) => ({ mainAccountId, subAccountId: id })),
      });
    }
    return tx.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        level,
        ...(dto.openingBalance !== undefined && { openingBalance: dto.openingBalance }),
      },
    });
  });
}

export async function toggleAccountActive(id: number) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) throw AppError.notFound("Account not found");
  return prisma.account.update({
    where: { id },
    data: { isActive: !account.isActive },
  });
}

// ─── Invoice Queue (for creating receipts) ───────────────────────────────────

export async function listPurchasesForReceipt(dto: InvoiceQueueQueryDto) {
  const fromDate = dto.from ? new Date(dto.from) : undefined;
  const toDate = dto.to ? new Date(dto.to + "T23:59:59.999Z") : undefined;

  const searchClause = dto.search?.trim()
    ? {
        OR: [
          {
            customer: {
              OR: [
                { firstName: { contains: dto.search, mode: "insensitive" as const } },
                { lastName: { contains: dto.search, mode: "insensitive" as const } },
                { nic: { contains: dto.search, mode: "insensitive" as const } },
              ],
            },
          },
          { invoiceGroupCode: { contains: dto.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const purchaseInclude: any = {
    customer: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nic: true,
        mobileNumber: true,
        address: true,
      },
    },
    bikeVehicle: {
      select: {
        displayId: true,
        brand: { select: { name: true } },
        model: { select: { name: true } },
      },
    },
    inventoryProduct: {
      select: { displayId: true, name: true },
    },
    receipts: {
      where: { isVoided: false },
      select: { amount: true },
    },
  };

  if (
    prismaModelHasObjectField(
      prisma as any,
      "PosCustomerPurchase",
      "preOrder",
    )
  ) {
    purchaseInclude.preOrder = {
      select: { id: true, displayId: true, brand: true, model: true, colour: true },
    };
  }

  const purchases: any[] = await (prisma.posCustomerPurchase as any).findMany({
    where: {
      ...searchClause,
      ...(fromDate && { purchasedAt: { gte: fromDate } }),
      ...(toDate && { purchasedAt: { lte: toDate } }),
    },
    include: purchaseInclude,
    orderBy: { purchasedAt: "desc" },
    take: dto.limit,
  });

  const rows = purchases.map((p) => {
    const totalReceivable = calculateTotalReceivable(p);
    const totalReceipted = (p.receipts as Array<{ amount: number }>).reduce((sum, r) => sum + r.amount, 0);
    const outstanding = Math.max(0, totalReceivable - totalReceipted);

    const itemLabel =
      p.bikeVehicle
        ? `${p.bikeVehicle.brand.name} ${p.bikeVehicle.model.name} (${p.bikeVehicle.displayId})`
        : p.inventoryProduct
        ? `${p.inventoryProduct.name} (${p.inventoryProduct.displayId})`
        : p.preOrder
        ? `${p.preOrder.brand} ${p.preOrder.model} (${p.preOrder.displayId})`
        : p.customCategory
        ? `${p.customCategory}${p.customDescription ? ` — ${p.customDescription}` : ""}`
        : "—";

    return {
      id: p.id,
      invoiceRef: p.invoiceGroupCode ?? `INV-${String(p.id).padStart(5, "0")}`,
      customer: p.customer,
      itemLabel,
      itemType: p.itemType,
      customCategory: p.customCategory ?? null,
      customDescription: p.customDescription ?? null,
      purchaseChannel: p.purchaseChannel,
      paymentType: p.paymentType,
      finalSellingPrice: p.finalSellingPrice,
      hasRegistrationFee: p.hasRegistrationFee,
      registrationFeeAmount: p.registrationFeeAmount,
      leasingDownPaymentAmount: p.leasingDownPaymentAmount,
      totalReceivable,
      totalReceipted,
      outstanding,
      receiptCount: (p.receipts as any[]).length,
      purchasedAt: p.purchasedAt,
    };
  });

  return dto.showAll ? rows : rows.filter((r) => r.outstanding > 0);
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

export async function listReceipts(dto: ReceiptQueryDto) {
  const skip = (dto.page - 1) * dto.limit;

  const fromDate = dto.from ? new Date(`${dto.from}T00:00:00`) : undefined;
  const toDate = dto.to ? new Date(`${dto.to}T23:59:59.999`) : undefined;

  const where = {
    ...(dto.accountId && { accountId: dto.accountId }),
    ...(fromDate || toDate ? { createdAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } } : {}),
    ...(dto.search?.trim() && {
      OR: [
        { receiptNo: { contains: dto.search, mode: "insensitive" as const } },
        {
          purchase: {
            customer: {
              OR: [
                { firstName: { contains: dto.search, mode: "insensitive" as const } },
                { lastName: { contains: dto.search, mode: "insensitive" as const } },
                { nic: { contains: dto.search, mode: "insensitive" as const } },
              ],
            },
          },
        },
      ],
    }),
  };

  const [total, receipts] = await Promise.all([
    prisma.accountReceipt.count({ where }),
    prisma.accountReceipt.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, code: true } },
        purchase: {
          select: {
            id: true,
            invoiceGroupCode: true,
            customer: { select: { firstName: true, lastName: true, nic: true, mobileNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: dto.limit,
    }),
  ]);

  return {
    data: receipts,
    pagination: { total, page: dto.page, limit: dto.limit, pages: Math.ceil(total / dto.limit) },
  };
}

export async function createReceipt(dto: CreateReceiptDto, adminId: number) {
  const [account, purchase] = await Promise.all([
    prisma.account.findUnique({ where: { id: dto.accountId } }),
    prisma.posCustomerPurchase.findUnique({ where: { id: dto.purchaseId } }),
  ]);
  if (!account || !account.isActive) throw AppError.notFound("Account not found or inactive");
  if (!purchase) throw AppError.notFound("Purchase/invoice not found");

  const isChecque = dto.paymentMethod === PaymentMethod.CHEQUE;

  return prisma.$transaction(async (tx) => {
    const created = await tx.accountReceipt.create({
      data: {
        receiptNo: "TEMP",
        purchaseId: dto.purchaseId,
        accountId: dto.accountId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        chequeNo: isChecque ? dto.chequeNo : undefined,
        chequeBank: isChecque ? dto.chequeBank : undefined,
        chequeDate: isChecque ? dto.chequeDate : undefined,
        chequeStatus: isChecque ? ChequeStatus.PENDING : undefined,
        description: dto.description,
        createdById: adminId,
      },
    });

    const receiptNo = `REC-${String(created.id).padStart(5, "0")}`;

    const [receipt] = await Promise.all([
      tx.accountReceipt.update({
        where: { id: created.id },
        data: { receiptNo },
        include: {
          account: { select: { id: true, name: true, code: true } },
          purchase: {
            select: {
              id: true,
              invoiceGroupCode: true,
              customer: { select: { firstName: true, lastName: true, nic: true, mobileNumber: true, address: true } },
            },
          },
        },
      }),
      tx.accountTransaction.create({
        data: {
          accountId: dto.accountId,
          type: TransactionType.RECEIPT,
          direction: TransactionDirection.DR,
          amount: dto.amount,
          receiptId: created.id,
          refNo: receiptNo,
          description: dto.description,
          chequeNo: isChecque ? dto.chequeNo : undefined,
          createdById: adminId,
        },
      }),
    ]);

    return receipt;
  });
}

export async function updateReceipt(id: number, dto: UpdateReceiptDto, adminId: number) {
  const receipt = await prisma.accountReceipt.findUnique({
    where: { id },
    include: { transactions: { where: { isReversal: false } } },
  });
  if (!receipt) throw AppError.notFound("Receipt not found");
  if (receipt.isVoided) throw new AppError("Cannot edit a voided receipt", 400);

  if (dto.accountId !== undefined) {
    const account = await prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account || !account.isActive) throw AppError.notFound("Account not found or inactive");
  }

  const isChecque =
    (dto.paymentMethod ?? receipt.paymentMethod) === PaymentMethod.CHEQUE;

  return prisma.$transaction(async (tx) => {
    const originalTx = receipt.transactions.find((t) => t.type === TransactionType.RECEIPT);

    if (originalTx) {
      await tx.accountTransaction.update({
        where: { id: originalTx.id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.accountId !== undefined && { accountId: dto.accountId }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(isChecque && dto.chequeNo !== undefined && { chequeNo: dto.chequeNo }),
        },
      });
    }

    return tx.accountReceipt.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
        ...(isChecque && dto.chequeNo !== undefined && { chequeNo: dto.chequeNo }),
        ...(isChecque && dto.chequeBank !== undefined && { chequeBank: dto.chequeBank }),
        ...(isChecque && dto.chequeDate !== undefined && { chequeDate: dto.chequeDate }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: {
        account: { select: { id: true, name: true, code: true } },
        purchase: {
          select: {
            id: true,
            invoiceGroupCode: true,
            customer: { select: { firstName: true, lastName: true, nic: true } },
          },
        },
      },
    });
  });
}

export async function voidReceipt(id: number, adminId: number) {
  const receipt = await prisma.accountReceipt.findUnique({
    where: { id },
    include: { transactions: true },
  });
  if (!receipt) throw AppError.notFound("Receipt not found");
  if (receipt.isVoided) throw new AppError("Receipt is already voided", 400);

  const originalTx = receipt.transactions.find(
    (t) => t.type === TransactionType.RECEIPT && !t.isReversal
  );

  return prisma.$transaction(async (tx) => {
    await tx.accountReceipt.update({ where: { id }, data: { isVoided: true } });

    if (originalTx && receipt.accountId) {
      await tx.accountTransaction.create({
        data: {
          accountId: receipt.accountId,
          type: TransactionType.REVERSAL,
          direction: TransactionDirection.CR,
          amount: originalTx.amount,
          receiptId: id,
          refNo: receipt.receiptNo,
          description: `Void of ${receipt.receiptNo}`,
          isReversal: true,
          createdById: adminId,
        },
      });
    }

    return { message: "Receipt voided successfully" };
  });
}

export async function bounceReceipt(id: number, adminId: number) {
  const receipt = await prisma.accountReceipt.findUnique({ where: { id } });
  if (!receipt) throw AppError.notFound("Receipt not found");
  if (receipt.paymentMethod !== PaymentMethod.CHEQUE) {
    throw new AppError("Only cheque receipts can be marked as bounced", 400);
  }
  if (receipt.chequeStatus !== ChequeStatus.PENDING) {
    throw new AppError("Cheque is not in PENDING status", 400);
  }
  if (!receipt.isDeposited) {
    throw new AppError("Cheque must be deposited before it can be marked as bounced", 400);
  }

  return prisma.$transaction(async (tx) => {
    await tx.accountReceipt.update({
      where: { id },
      data: { chequeStatus: ChequeStatus.BOUNCED, isDeposited: false },
    });

    await tx.accountDepositItem.deleteMany({ where: { receiptId: id } });

    if (receipt.accountId) {
      await tx.accountTransaction.create({
        data: {
          accountId: receipt.accountId,
          type: TransactionType.REVERSAL,
          direction: TransactionDirection.CR,
          amount: receipt.amount,
          receiptId: id,
          refNo: receipt.receiptNo,
          description: `Cheque bounced: ${receipt.receiptNo}`,
          chequeNo: receipt.chequeNo ?? undefined,
          isReversal: true,
          createdById: adminId,
        },
      });
    }

    return { message: "Cheque marked as bounced and transaction reversed" };
  });
}

export async function clearCheque(id: number) {
  const receipt = await prisma.accountReceipt.findUnique({ where: { id } });
  if (!receipt) throw AppError.notFound("Receipt not found");
  if (receipt.paymentMethod !== PaymentMethod.CHEQUE) {
    throw new AppError("Not a cheque receipt", 400);
  }
  if (receipt.chequeStatus !== ChequeStatus.PENDING) {
    throw new AppError("Cheque is not in PENDING status", 400);
  }
  if (!receipt.isDeposited) {
    throw new AppError("Cheque must be deposited before it can be cleared", 400);
  }
  return prisma.accountReceipt.update({
    where: { id },
    data: { chequeStatus: ChequeStatus.CLEARED },
  });
}

export async function getReceiptById(id: number) {
  const receipt = await prisma.accountReceipt.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true, code: true, type: true } },
      purchase: {
        select: {
          id: true,
          invoiceGroupCode: true,
          finalSellingPrice: true,
          hasRegistrationFee: true,
          registrationFeeAmount: true,
          purchaseChannel: true,
          leasingDownPaymentAmount: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              nic: true,
              mobileNumber: true,
              address: true,
              district: true,
            },
          },
          bikeVehicle: {
            select: { displayId: true, brand: { select: { name: true } }, model: { select: { name: true } } },
          },
          inventoryProduct: { select: { displayId: true, name: true } },
        },
      },
    },
  });
  if (!receipt) throw AppError.notFound("Receipt not found");
  return receipt;
}

// ─── Vouchers ─────────────────────────────────────────────────────────────────

export async function listVouchers(dto: VoucherQueryDto) {
  const skip = (dto.page - 1) * dto.limit;
  const filters: Prisma.Sql[] = [];

  if (dto.accountId) {
    filters.push(Prisma.sql`v."accountId" = ${dto.accountId}`);
  }
  if (dto.type) {
    filters.push(Prisma.sql`v."type"::text = ${dto.type}`);
  }
  if (dto.search) {
    const search = `%${dto.search}%`;
    const matchingTypes = Object.entries(VOUCHER_TYPE_LABELS)
      .filter(([, label]) => label.toLowerCase().includes(dto.search!.toLowerCase()))
      .map(([type]) => type);
    const typeLabelFilter = matchingTypes.length > 0
      ? Prisma.sql`OR v."type"::text IN (${Prisma.join(matchingTypes)})`
      : Prisma.empty;
    filters.push(Prisma.sql`(
      v."voucherNo" ILIKE ${search}
      OR REPLACE(v."type"::text, '_', ' ') ILIKE ${search}
      ${typeLabelFilter}
      OR COALESCE(v."payee", '') ILIKE ${search}
      OR COALESCE(v."description", '') ILIKE ${search}
      OR COALESCE(v."referenceNo", '') ILIKE ${search}
      OR a."name" ILIKE ${search}
      OR a."code" ILIKE ${search}
      OR COALESCE(ta."name", '') ILIKE ${search}
      OR COALESCE(ta."code", '') ILIKE ${search}
    )`);
  }

  const whereSql = filters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;

  const [totalRows, vouchers] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "account_vouchers" v
      JOIN "accounts" a ON a."id" = v."accountId"
      LEFT JOIN "accounts" ta ON ta."id" = v."toAccountId"
      ${whereSql}
    `,
    prisma.$queryRaw<RawVoucherRow[]>`
      SELECT
        v."id",
        v."voucherNo",
        v."accountId",
        v."toAccountId",
        v."type"::text AS "type",
        v."amount",
        v."description",
        v."payee",
        v."paymentDate",
        v."referenceNo",
        v."isVoided",
        v."createdById",
        v."createdAt",
        v."updatedAt",
        a."id" AS "account_id",
        a."name" AS "account_name",
        a."code" AS "account_code",
        ta."id" AS "toAccount_id",
        ta."name" AS "toAccount_name",
        ta."code" AS "toAccount_code"
      FROM "account_vouchers" v
      JOIN "accounts" a ON a."id" = v."accountId"
      LEFT JOIN "accounts" ta ON ta."id" = v."toAccountId"
      ${whereSql}
      ORDER BY v."createdAt" DESC
      OFFSET ${skip}
      LIMIT ${dto.limit}
    `,
  ]);

  const total = totalRows[0]?.count ?? 0;
  const data = vouchers.map((v) => ({
    ...mapRawVoucherRow(v),
    typeLabel: voucherTypeLabel(v.type),
  }));

  return {
    data,
    pagination: { total, page: dto.page, limit: dto.limit, pages: Math.ceil(total / dto.limit) },
  };
}

export async function createVoucher(dto: CreateVoucherDto, adminId: number) {
  const account = await prisma.account.findUnique({ where: { id: dto.accountId } });
  if (!account || !account.isActive) throw AppError.notFound("Account not found or inactive");

  let toAccount = null;
  if (dto.type === ACCOUNT_TRANSFER_TYPE) {
    toAccount = await prisma.account.findUnique({ where: { id: dto.toAccountId } });
    if (!toAccount || !toAccount.isActive) throw AppError.notFound("Destination account not found or inactive");
  }

  const allTx = await prisma.accountTransaction.findMany({
    where: { accountId: dto.accountId },
    select: { direction: true, amount: true },
  });
  const currentBalance =
    account.openingBalance +
    allTx.reduce(
      (sum, t) => sum + (t.direction === TransactionDirection.DR ? t.amount : -t.amount),
      0
    );
  if (currentBalance < dto.amount) {
    throw new AppError(
      `Insufficient funds. Available balance: Rs. ${currentBalance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`,
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    const created = await createVoucherDraft(tx, dto, adminId);

    if (dto.type === ACCOUNT_TRANSFER_TYPE) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "toAccountId" = ${dto.toAccountId!}
        WHERE "id" = ${created.id}
      `;
    }

    if (dto.payee !== undefined) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "payee" = ${dto.payee}
        WHERE "id" = ${created.id}
      `;
    }

    if (dto.paymentDate !== undefined) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "paymentDate" = ${dto.paymentDate}
        WHERE "id" = ${created.id}
      `;
    }

    if (dto.referenceNo !== undefined) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "referenceNo" = ${dto.referenceNo}
        WHERE "id" = ${created.id}
      `;
    }

    const voucherNo = `VCH-${String(created.id).padStart(5, "0")}`;

    if (dto.type === ACCOUNT_TRANSFER_TYPE && toAccount) {
      await Promise.all([
        tx.$executeRaw`
          UPDATE "account_vouchers"
          SET "voucherNo" = ${voucherNo}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${created.id}
        `,
        // CR on source account (money leaves)
        createTransferTransaction(tx, {
          accountId: dto.accountId,
          direction: "CR",
          amount: dto.amount,
          voucherId: created.id,
          refNo: voucherNo,
          description: dto.description ?? `Transfer to ${toAccount.name}`,
          createdById: adminId,
        }),
        // DR on destination account (money enters)
        createTransferTransaction(tx, {
          accountId: dto.toAccountId!,
          direction: "DR",
          amount: dto.amount,
          voucherId: created.id,
          refNo: voucherNo,
          description: dto.description ?? `Transfer from ${account.name}`,
          createdById: adminId,
        }),
      ]);

      const voucher = await findRawVoucherById(tx, created.id);
      if (!voucher) throw new AppError("Failed to load created account transfer voucher", 500);
      return { ...mapRawVoucherRow(voucher), typeLabel: voucherTypeLabel(voucher.type) };
    }

    const [voucher] = await Promise.all([
      tx.accountVoucher.update({
        where: { id: created.id },
        data: {
          voucherNo,
          ...(dto.description !== undefined && { description: dto.description }),
        },
        include: {
          account: { select: { id: true, name: true, code: true } },
        },
      }),
      tx.accountTransaction.create({
        data: {
          accountId: dto.accountId,
          type: TransactionType.VOUCHER,
          direction: TransactionDirection.CR,
          amount: dto.amount,
          voucherId: created.id,
          refNo: voucherNo,
          description: dto.description ?? voucherTypeLabel(dto.type),
          createdById: adminId,
        },
      }),
    ]);

    return { ...mapVoucherRow(voucher, null), typeLabel: voucherTypeLabel(voucher.type) };
  });
}

export async function updateVoucher(id: number, dto: UpdateVoucherDto, adminId: number) {
  const voucherMeta = await findRawVoucherById(prisma, id);
  if (!voucherMeta) throw AppError.notFound("Voucher not found");
  if (voucherMeta.isVoided) throw new AppError("Cannot edit a voided voucher", 400);

  const isTransfer = voucherMeta.type === ACCOUNT_TRANSFER_TYPE;

  if (isTransfer) {
    if (dto.type !== undefined || dto.amount !== undefined) {
      throw new AppError("Type and amount cannot be changed on an account transfer", 400);
    }

    return prisma.$transaction(async (tx) => {
      if (dto.description !== undefined) {
        await tx.$executeRaw`
          UPDATE "account_vouchers"
          SET "description" = ${dto.description}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
      }

      if (dto.payee !== undefined) {
        await tx.$executeRaw`
          UPDATE "account_vouchers"
          SET "payee" = ${dto.payee}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
      }

      if (dto.paymentDate !== undefined) {
        await tx.$executeRaw`
          UPDATE "account_vouchers"
          SET "paymentDate" = ${dto.paymentDate}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
      }

      if (dto.referenceNo !== undefined) {
        await tx.$executeRaw`
          UPDATE "account_vouchers"
          SET "referenceNo" = ${dto.referenceNo}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
      }

      const updated = await findRawVoucherById(tx, id);
      if (!updated) throw AppError.notFound("Voucher not found");
      return { ...mapRawVoucherRow(updated), typeLabel: voucherTypeLabel(updated.type) };
    });
  }

  const voucher = await prisma.accountVoucher.findUnique({
    where: { id },
    include: { transactions: { where: { isReversal: false } } },
  });
  if (!voucher) throw AppError.notFound("Voucher not found");
  if (voucher.isVoided) throw new AppError("Cannot edit a voided voucher", 400);

  if (dto.type === ACCOUNT_TRANSFER_TYPE) {
    throw new AppError("Existing vouchers cannot be converted to account transfers", 400);
  }

  const originalTx = voucher.transactions.find((t) => t.type === TransactionType.VOUCHER);

  return prisma.$transaction(async (tx) => {
    if (originalTx && dto.amount !== undefined) {
      await tx.accountTransaction.update({
        where: { id: originalTx.id },
        data: {
          amount: dto.amount,
          ...(dto.description !== undefined && { description: dto.description }),
        },
      });
    }

    const updated = await tx.accountVoucher.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: {
        account: { select: { id: true, name: true, code: true } },
      },
    });

    if (dto.payee !== undefined) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "payee" = ${dto.payee}
        WHERE "id" = ${id}
      `;
    }

    if (dto.paymentDate !== undefined) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "paymentDate" = ${dto.paymentDate}
        WHERE "id" = ${id}
      `;
    }

    if (dto.referenceNo !== undefined) {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "referenceNo" = ${dto.referenceNo}
        WHERE "id" = ${id}
      `;
    }

    return { ...mapVoucherRow(updated, await resolveVoucherToAccount(tx, updated.toAccountId)), typeLabel: voucherTypeLabel(updated.type) };
  });
}

export async function voidVoucher(id: number, adminId: number) {
  const voucherMeta = await findRawVoucherById(prisma, id);
  if (!voucherMeta) throw AppError.notFound("Voucher not found");
  if (voucherMeta.isVoided) throw new AppError("Voucher is already voided", 400);

  if (voucherMeta.type === ACCOUNT_TRANSFER_TYPE) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "account_vouchers"
        SET "isVoided" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `;

      const transferTransactions = await tx.$queryRaw<RawTransferTransaction[]>`
        SELECT
          "id",
          "accountId",
          "direction"::text AS "direction",
          "amount"
        FROM "account_transactions"
        WHERE "voucherId" = ${id}
          AND "type"::text = ${TRANSFER_TRANSACTION_TYPE}
          AND "isReversal" = false
      `;

      const sourceTx = transferTransactions.find((t) => t.direction === "CR");
      const destTx = transferTransactions.find((t) => t.direction === "DR");
      const reversals: Promise<unknown>[] = [];

      if (sourceTx) {
        reversals.push(
          tx.accountTransaction.create({
            data: {
              accountId: sourceTx.accountId,
              type: TransactionType.REVERSAL,
              direction: TransactionDirection.DR,
              amount: sourceTx.amount,
              voucherId: id,
              refNo: voucherMeta.voucherNo,
              description: `Void of transfer ${voucherMeta.voucherNo}`,
              isReversal: true,
              createdById: adminId,
            },
          })
        );
      }

      if (destTx) {
        reversals.push(
          tx.accountTransaction.create({
            data: {
              accountId: destTx.accountId,
              type: TransactionType.REVERSAL,
              direction: TransactionDirection.CR,
              amount: destTx.amount,
              voucherId: id,
              refNo: voucherMeta.voucherNo,
              description: `Void of transfer ${voucherMeta.voucherNo}`,
              isReversal: true,
              createdById: adminId,
            },
          })
        );
      }

      await Promise.all(reversals);

      return { message: "Voucher voided successfully" };
    });
  }

  const voucher = await prisma.accountVoucher.findUnique({
    where: { id },
    include: { transactions: true },
  });
  if (!voucher) throw AppError.notFound("Voucher not found");
  if (voucher.isVoided) throw new AppError("Voucher is already voided", 400);

  return prisma.$transaction(async (tx) => {
    await tx.accountVoucher.update({ where: { id }, data: { isVoided: true } });

    const originalTx = voucher.transactions.find(
      (t) => t.type === TransactionType.VOUCHER && !t.isReversal
    );

    if (originalTx) {
      await tx.accountTransaction.create({
        data: {
          accountId: voucher.accountId,
          type: TransactionType.REVERSAL,
          direction: TransactionDirection.DR,
          amount: originalTx.amount,
          voucherId: id,
          refNo: voucher.voucherNo,
          description: `Void of ${voucher.voucherNo}`,
          isReversal: true,
          createdById: adminId,
        },
      });
    }

    return { message: "Voucher voided successfully" };
  });
}

export async function getVoucherById(id: number) {
  const voucher = await findRawVoucherById(prisma, id);
  if (!voucher) throw AppError.notFound("Voucher not found");
  return { ...mapRawVoucherRow(voucher), typeLabel: voucherTypeLabel(voucher.type) };
}

// ─── Invoice Payment Queue ────────────────────────────────────────────────────

export async function listInvoicePayments(dto: InvoicePaymentQueryDto) {
  const skip = (dto.page - 1) * dto.limit;

  const fromDate = dto.from ? new Date(`${dto.from}T00:00:00`) : undefined;
  const toDate = dto.to ? new Date(`${dto.to}T23:59:59.999`) : undefined;

  const searchClause = dto.search?.trim()
    ? {
        purchase: {
          OR: [
            { customer: { firstName: { contains: dto.search, mode: "insensitive" as const } } },
            { customer: { lastName: { contains: dto.search, mode: "insensitive" as const } } },
            { customer: { nic: { contains: dto.search, mode: "insensitive" as const } } },
            { invoiceGroupCode: { contains: dto.search, mode: "insensitive" as const } },
          ],
        },
      }
    : {};

  const where = {
    receiptId: null,
    ...searchClause,
    ...(fromDate || toDate
      ? { paidAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } }
      : {}),
  };

  const purchaseSelect: any = {
    id: true,
    invoiceGroupCode: true,
    itemType: true,
    customCategory: true,
    customDescription: true,
    customer: { select: { firstName: true, lastName: true, nic: true, mobileNumber: true } },
    bikeVehicle: {
      select: { displayId: true, brand: { select: { name: true } }, model: { select: { name: true } } },
    },
    inventoryProduct: { select: { displayId: true, name: true } },
  };

  if (
    prismaModelHasObjectField(
      prisma as any,
      "PosCustomerPurchase",
      "preOrder",
    )
  ) {
    purchaseSelect.preOrder = {
      select: { displayId: true, brand: true, model: true, colour: true },
    };
  }

  const [total, payments] = await Promise.all([
    prisma.invoicePayment.count({ where }),
    (prisma as any).invoicePayment.findMany({
      where,
      include: {
        purchase: {
          select: purchaseSelect,
        },
      },
      orderBy: { paidAt: "desc" },
      skip,
      take: dto.limit,
    }),
  ]) as [number, any[]];

  const data = (payments as any[]).map((p) => {
    const pur = p.purchase;
    const itemLabel = pur.bikeVehicle
      ? `${pur.bikeVehicle.brand.name} ${pur.bikeVehicle.model.name} (${pur.bikeVehicle.displayId})`
      : pur.inventoryProduct
      ? `${pur.inventoryProduct.name} (${pur.inventoryProduct.displayId})`
      : pur.preOrder
      ? `${pur.preOrder.brand} ${pur.preOrder.model} (${pur.preOrder.displayId})`
      : pur.customCategory
      ? `${pur.customCategory}${pur.customDescription ? ` — ${pur.customDescription}` : ""}`
      : "—";
    return {
      ...p,
      invoiceRef: pur.invoiceGroupCode ?? `INV-${String(p.purchaseId).padStart(5, "0")}`,
      itemLabel,
    };
  });

  return {
    data,
    pagination: { total, page: dto.page, limit: dto.limit, pages: Math.ceil(total / dto.limit) },
  };
}

export async function generateReceiptFromPayment(
  paymentId: number,
  dto: GenerateReceiptFromPaymentDto,
  adminId: number,
) {
  const payment = await prisma.invoicePayment.findUnique({
    where: { id: paymentId },
    include: { purchase: true },
  });
  if (!payment) throw AppError.notFound("Invoice payment not found");
  if (payment.receiptId !== null) throw new AppError("Receipt already generated for this payment", 400);

  const isChecque = payment.paymentMethod === PaymentMethod.CHEQUE;

  return prisma.$transaction(async (tx) => {
    const created = await tx.accountReceipt.create({
      data: {
        receiptNo: "TEMP",
        purchaseId: payment.purchaseId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        chequeNo: isChecque ? (payment.chequeNo ?? undefined) : undefined,
        chequeBank: isChecque ? (payment.chequeBank ?? undefined) : undefined,
        chequeDate: isChecque ? (payment.chequeDate ?? undefined) : undefined,
        chequeStatus: isChecque ? ChequeStatus.PENDING : undefined,
        description: dto.description ?? payment.description ?? undefined,
        createdById: adminId,
      },
    });

    const receiptNo = `REC-${String(created.id).padStart(5, "0")}`;

    const [receipt] = await Promise.all([
      tx.accountReceipt.update({
        where: { id: created.id },
        data: { receiptNo },
        include: {
          account: { select: { id: true, name: true, code: true } },
          purchase: {
            select: {
              id: true,
              invoiceGroupCode: true,
              customer: { select: { firstName: true, lastName: true, nic: true, mobileNumber: true, address: true } },
              bikeVehicle: {
                select: { displayId: true, brand: { select: { name: true } }, model: { select: { name: true } } },
              },
              inventoryProduct: { select: { displayId: true, name: true } },
            },
          },
        },
      }),
      tx.invoicePayment.update({
        where: { id: paymentId },
        data: { receiptId: created.id },
      }),
    ]);

    return receipt;
  });
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

export async function listDeposits(dto: DepositQueryDto) {
  const skip = (dto.page - 1) * dto.limit;
  const fromDate = dto.from ? new Date(`${dto.from}T00:00:00`) : undefined;
  const toDate = dto.to ? new Date(`${dto.to}T23:59:59.999`) : undefined;

  const where = {
    ...(dto.accountId && { accountId: dto.accountId }),
    ...(fromDate || toDate
      ? { createdAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } }
      : {}),
  };

  const [total, deposits] = await Promise.all([
    prisma.accountDeposit.count({ where }),
    prisma.accountDeposit.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, code: true } },
        subAccount: { select: { id: true, name: true, code: true } },
        items: { select: { id: true, receiptId: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: dto.limit,
    }),
  ]);

  return {
    data: deposits.map((d) => ({ ...d, receiptCount: d.items.length })),
    pagination: { total, page: dto.page, limit: dto.limit, pages: Math.ceil(total / dto.limit) },
  };
}

export async function getDeposit(id: number) {
  const deposit = await prisma.accountDeposit.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true, code: true } },
      subAccount: { select: { id: true, name: true, code: true } },
      items: {
        include: {
          receipt: {
            include: {
              purchase: {
                select: {
                  id: true,
                  invoiceGroupCode: true,
                  customer: { select: { firstName: true, lastName: true, nic: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!deposit) throw AppError.notFound("Deposit not found");
  return deposit;
}

export async function createDeposit(dto: CreateDepositDto, adminId: number) {
  const [account, subAccount] = await Promise.all([
    prisma.account.findUnique({ where: { id: dto.accountId } }),
    dto.subAccountId
      ? prisma.account.findUnique({ where: { id: dto.subAccountId } })
      : Promise.resolve(null),
  ]);
  if (!account || !account.isActive || account.level !== AccountLevel.MAIN) {
    throw AppError.notFound("Main account not found or inactive");
  }
  if (dto.subAccountId) {
    if (!subAccount || !subAccount.isActive || subAccount.level !== AccountLevel.SUB) {
      throw AppError.notFound("Sub account not found or inactive");
    }
    const relationship = await prisma.accountRelationship.findUnique({
      where: {
        mainAccountId_subAccountId: {
          mainAccountId: dto.accountId,
          subAccountId: dto.subAccountId,
        },
      },
    });
    if (!relationship) throw new AppError("Sub account is not linked to the selected main account", 400);
  }

  const receipts = await prisma.accountReceipt.findMany({
    where: { id: { in: dto.receiptIds }, isVoided: false, isDeposited: false },
    include: {
      purchase: {
        select: { customer: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (receipts.length !== dto.receiptIds.length) {
    throw new AppError("Some receipts are invalid, already deposited, or voided", 400);
  }

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
  const chequeNos = receipts
    .filter((r) => r.paymentMethod === PaymentMethod.CHEQUE && r.chequeNo)
    .map((r) => r.chequeNo as string);
  const depositChequeNo = chequeNos.length > 0 ? chequeNos.join(", ") : undefined;

  return prisma.$transaction(async (tx) => {
    // Receipts are confirmed isDeposited=false above, so any existing deposit items
    // for them must belong to previously reversed deposits. Remove them so re-deposit works.
    await tx.accountDepositItem.deleteMany({
      where: { receiptId: { in: receipts.map((r) => r.id) } },
    });

    const deposit = await tx.accountDeposit.create({
      data: {
        depositNo: "TEMP",
        accountId: dto.accountId,
        subAccountId: dto.subAccountId,
        totalAmount,
        notes: dto.notes,
        createdById: adminId,
      },
    });

    const depositNo = `DEP-${String(deposit.id).padStart(5, "0")}`;

    await Promise.all([
      tx.accountDeposit.update({ where: { id: deposit.id }, data: { depositNo } }),
      tx.accountDepositItem.createMany({
        data: receipts.map((r) => ({ depositId: deposit.id, receiptId: r.id, amount: r.amount })),
      }),
      tx.accountReceipt.updateMany({
        where: { id: { in: dto.receiptIds } },
        data: { isDeposited: true, accountId: dto.accountId },
      }),
      tx.accountReceipt.updateMany({
        where: { id: { in: dto.receiptIds }, paymentMethod: PaymentMethod.CHEQUE },
        data: { chequeStatus: ChequeStatus.PENDING },
      }),
      tx.accountTransaction.create({
        data: {
          accountId: dto.accountId,
          type: TransactionType.DEPOSIT,
          direction: TransactionDirection.DR,
          amount: totalAmount,
          depositId: deposit.id,
          refNo: depositNo,
          description: subAccount
            ? `${subAccount.name}${dto.notes ? ` — ${dto.notes}` : ""}`
            : dto.notes ?? `Deposit batch ${depositNo}`,
          chequeNo: depositChequeNo,
          createdById: adminId,
        },
      }),
    ]);

    if (subAccount) {
      await tx.accountTransaction.createMany({
        data: receipts.map((receipt) => {
          const customerName = [
            receipt.purchase.customer.firstName,
            receipt.purchase.customer.lastName,
          ].filter(Boolean).join(" ");
          return {
            accountId: subAccount.id,
            type: TransactionType.DEPOSIT,
            direction: TransactionDirection.DR,
            amount: receipt.amount,
            depositId: deposit.id,
            refNo: receipt.receiptNo,
            description: customerName || `Receipt ${receipt.receiptNo}`,
            chequeNo: receipt.chequeNo,
            createdById: adminId,
          };
        }),
      });
    }

    return { ...deposit, depositNo, receiptCount: receipts.length, account, subAccount };
  });
}

export async function reverseDeposit(depositId: number, adminId: number) {
  const deposit = await prisma.accountDeposit.findUnique({
    where: { id: depositId },
    include: {
      items: true,
      transactions: { where: { isReversal: false } },
    },
  });
  if (!deposit) throw AppError.notFound("Deposit not found");
  if (deposit.isReversed) throw new AppError("Deposit is already reversed", 400);

  return prisma.$transaction(async (tx) => {
    await tx.accountDeposit.update({
      where: { id: depositId },
      data: { isReversed: true, reversedAt: new Date() },
    });

    // Remove deposit items so the same receipts can be re-deposited after reversal.
    // The AccountDeposit record + AccountTransaction provide the full audit trail.
    await tx.accountDepositItem.deleteMany({ where: { depositId } });

    await tx.accountReceipt.updateMany({
      where: { id: { in: deposit.items.map((i) => i.receiptId) } },
      data: { isDeposited: false },
    });

    await tx.accountTransaction.createMany({
      data: deposit.transactions.map((transaction) => ({
        accountId: transaction.accountId,
        type: TransactionType.REVERSAL,
        direction:
          transaction.direction === TransactionDirection.DR
            ? TransactionDirection.CR
            : TransactionDirection.DR,
        amount: transaction.amount,
        depositId,
        refNo: transaction.refNo ?? deposit.depositNo,
        description: `Reversal of ${transaction.description ?? `deposit ${deposit.depositNo}`}`,
        chequeNo: transaction.chequeNo,
        isReversal: true,
        createdById: adminId,
      })),
    });

    return { message: "Deposit reversed successfully" };
  });
}

// ─── General Ledger ───────────────────────────────────────────────────────────

export async function getLedger(dto: LedgerQueryDto) {
  const account = await prisma.account.findUnique({ where: { id: dto.accountId } });
  if (!account) throw AppError.notFound("Account not found");

  const fromDate = new Date(dto.from);
  const toDate = new Date(dto.to + "T23:59:59.999Z");

  // Opening balance = account.openingBalance + all DR before fromDate - all CR before fromDate
  const preTransactions = await prisma.$queryRaw<Array<{ direction: string; amount: number }>>`
    SELECT "direction"::text AS "direction", "amount"
    FROM "account_transactions"
    WHERE "accountId" = ${dto.accountId}
      AND "createdAt" < ${fromDate}
  `;

  const openingBalance =
    account.openingBalance +
    preTransactions.reduce((sum, t) => {
      return sum + (t.direction === "DR" ? t.amount : -t.amount);
    }, 0);

  // Transactions within date range
  const transactions = await prisma.$queryRaw<RawLedgerTransaction[]>`
    SELECT
      "id",
      "type"::text AS "type",
      "direction"::text AS "direction",
      "amount",
      "refNo",
      "description",
      "chequeNo",
      "isReversal",
      "createdById",
      "createdAt"
    FROM "account_transactions"
    WHERE "accountId" = ${dto.accountId}
      AND "createdAt" >= ${fromDate}
      AND "createdAt" <= ${toDate}
    ORDER BY "createdAt" ASC
  `;

  let runningBalance = openingBalance;
  const rows = transactions.map((t) => {
    const drAmount = t.direction === "DR" ? t.amount : 0;
    const crAmount = t.direction === "CR" ? t.amount : 0;
    runningBalance = runningBalance + drAmount - crAmount;

    return {
      id: t.id,
      type: t.type,
      typeLabel: t.isReversal
        ? "Reversal"
        : t.type === TransactionType.RECEIPT
        ? "Receipt"
        : t.type === TransactionType.DEPOSIT
        ? "Deposit"
        : t.type === TRANSFER_TRANSACTION_TYPE
        ? "Transfer"
        : "Voucher",
      refNo: t.refNo,
      createdById: t.createdById,
      date: t.createdAt,
      description: t.description,
      chequeNo: t.chequeNo,
      drAmount,
      crAmount,
      balance: runningBalance,
    };
  });

  const totalDr = rows.reduce((s, r) => s + r.drAmount, 0);
  const totalCr = rows.reduce((s, r) => s + r.crAmount, 0);

  return {
    account: {
      id: account.id,
      name: account.name,
      code: account.code,
      type: account.type,
      level: account.level,
    },
    openingBalance,
    rows,
    totalDr,
    totalCr,
    closingBalance: openingBalance + totalDr - totalCr,
  };
}

// ─── Account Balance ──────────────────────────────────────────────────────────

export async function getAccountBalance(accountId: number) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw AppError.notFound("Account not found");

  const transactions = await prisma.accountTransaction.findMany({
    where: { accountId },
    select: { direction: true, amount: true },
  });

  const balance =
    account.openingBalance +
    transactions.reduce(
      (sum, t) => sum + (t.direction === TransactionDirection.DR ? t.amount : -t.amount),
      0
    );

  return { accountId, balance };
}
