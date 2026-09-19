"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAccounts = listAccounts;
exports.createAccount = createAccount;
exports.updateAccount = updateAccount;
exports.toggleAccountActive = toggleAccountActive;
exports.listPurchasesForReceipt = listPurchasesForReceipt;
exports.listReceipts = listReceipts;
exports.createReceipt = createReceipt;
exports.updateReceipt = updateReceipt;
exports.voidReceipt = voidReceipt;
exports.bounceReceipt = bounceReceipt;
exports.clearCheque = clearCheque;
exports.getReceiptById = getReceiptById;
exports.listVouchers = listVouchers;
exports.createVoucher = createVoucher;
exports.updateVoucher = updateVoucher;
exports.voidVoucher = voidVoucher;
exports.getVoucherById = getVoucherById;
exports.listInvoicePayments = listInvoicePayments;
exports.generateReceiptFromPayment = generateReceiptFromPayment;
exports.listDeposits = listDeposits;
exports.getDeposit = getDeposit;
exports.createDeposit = createDeposit;
exports.reverseDeposit = reverseDeposit;
exports.getLedger = getLedger;
exports.getAccountBalance = getAccountBalance;
const prisma_1 = require("../../generated/prisma");
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
const prisma_model_1 = require("../../common/utils/prisma-model");
const prisma_2 = require("../../generated/prisma");
const ACCOUNT_TRANSFER_TYPE = "ACCOUNT_TRANSFER";
const TRANSFER_TRANSACTION_TYPE = "TRANSFER";
const VOUCHER_TYPE_LABELS = {
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
async function generateAccountCode() {
    const count = await prisma_client_1.prisma.account.count();
    return `ACC-${String(count + 1).padStart(3, "0")}`;
}
function voucherTypeLabel(type) {
    return VOUCHER_TYPE_LABELS[type] ?? type;
}
function calculateTotalReceivable(p) {
    const regFee = p.hasRegistrationFee ? p.registrationFeeAmount : 0;
    if (p.purchaseChannel === "LEASING") {
        return p.leasingDownPaymentAmount + regFee;
    }
    return (p.totalWithInterest ?? p.finalSellingPrice) + regFee;
}
async function resolveVoucherToAccount(client, toAccountId) {
    if (!toAccountId)
        return null;
    return client.account.findUnique({
        where: { id: toAccountId },
        select: { id: true, name: true, code: true },
    });
}
async function createVoucherDraft(tx, dto, adminId) {
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
    const [created] = await tx.$queryRaw `
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
        throw new errors_1.AppError("Failed to create account transfer voucher", 500);
    }
    return created;
}
async function createTransferTransaction(tx, data) {
    await tx.$executeRaw `
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
async function findRawVoucherById(client, id) {
    const [voucher] = await client.$queryRaw `
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
function mapRawVoucherRow(row) {
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
function mapVoucherRow(row, toAccount) {
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
async function listAccounts() {
    const accounts = await prisma_client_1.prisma.account.findMany({
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
async function createAccount(dto) {
    const code = await generateAccountCode();
    const mainAccountIds = [...new Set(dto.mainAccountIds)];
    if (dto.level === prisma_2.AccountLevel.SUB && mainAccountIds.length > 0) {
        const validMainCount = await prisma_client_1.prisma.account.count({
            where: { id: { in: mainAccountIds }, level: prisma_2.AccountLevel.MAIN, isActive: true },
        });
        if (validMainCount !== mainAccountIds.length) {
            throw new errors_1.AppError("One or more selected main accounts are invalid or inactive", 400);
        }
    }
    return prisma_client_1.prisma.account.create({
        data: {
            name: dto.name,
            type: dto.type,
            level: dto.level,
            openingBalance: dto.openingBalance ?? 0,
            code,
            ...(dto.level === prisma_2.AccountLevel.SUB && mainAccountIds.length > 0
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
async function updateAccount(id, dto) {
    const account = await prisma_client_1.prisma.account.findUnique({
        where: { id },
        include: { subLinks: true, mainLinks: true },
    });
    if (!account)
        throw errors_1.AppError.notFound("Account not found");
    const level = dto.level ?? account.level;
    const mainAccountIds = [...new Set(dto.mainAccountIds ?? account.subLinks.map((link) => link.mainAccountId))];
    if (level === prisma_2.AccountLevel.MAIN && mainAccountIds.length > 0) {
        throw new errors_1.AppError("Main accounts cannot be linked beneath other main accounts", 400);
    }
    if (level === prisma_2.AccountLevel.SUB && mainAccountIds.length > 0) {
        const validMainCount = await prisma_client_1.prisma.account.count({
            where: {
                id: { in: mainAccountIds, not: id },
                level: prisma_2.AccountLevel.MAIN,
                isActive: true,
            },
        });
        if (validMainCount !== mainAccountIds.length) {
            throw new errors_1.AppError("One or more selected main accounts are invalid or inactive", 400);
        }
    }
    if (level !== account.level) {
        const usageCount = await prisma_client_1.prisma.accountTransaction.count({ where: { accountId: id } });
        if (usageCount > 0 || account.mainLinks.length > 0 || account.subLinks.length > 0) {
            throw new errors_1.AppError("An account with transactions or relationships cannot change level", 400);
        }
    }
    return prisma_client_1.prisma.$transaction(async (tx) => {
        await tx.accountRelationship.deleteMany({ where: { subAccountId: id } });
        if (level === prisma_2.AccountLevel.SUB && mainAccountIds.length > 0) {
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
async function toggleAccountActive(id) {
    const account = await prisma_client_1.prisma.account.findUnique({ where: { id } });
    if (!account)
        throw errors_1.AppError.notFound("Account not found");
    return prisma_client_1.prisma.account.update({
        where: { id },
        data: { isActive: !account.isActive },
    });
}
async function listPurchasesForReceipt(dto) {
    const fromDate = dto.from ? new Date(dto.from) : undefined;
    const toDate = dto.to ? new Date(dto.to + "T23:59:59.999Z") : undefined;
    const searchClause = dto.search?.trim()
        ? {
            OR: [
                {
                    customer: {
                        OR: [
                            { firstName: { contains: dto.search, mode: "insensitive" } },
                            { lastName: { contains: dto.search, mode: "insensitive" } },
                            { nic: { contains: dto.search, mode: "insensitive" } },
                        ],
                    },
                },
                { invoiceGroupCode: { contains: dto.search, mode: "insensitive" } },
            ],
        }
        : {};
    const purchaseInclude = {
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
    if ((0, prisma_model_1.prismaModelHasObjectField)(prisma_client_1.prisma, "PosCustomerPurchase", "preOrder")) {
        purchaseInclude.preOrder = {
            select: { id: true, displayId: true, brand: true, model: true, colour: true },
        };
    }
    const purchases = await prisma_client_1.prisma.posCustomerPurchase.findMany({
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
        const totalReceipted = p.receipts.reduce((sum, r) => sum + r.amount, 0);
        const outstanding = Math.max(0, totalReceivable - totalReceipted);
        const itemLabel = p.bikeVehicle
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
            receiptCount: p.receipts.length,
            purchasedAt: p.purchasedAt,
        };
    });
    return dto.showAll ? rows : rows.filter((r) => r.outstanding > 0);
}
async function listReceipts(dto) {
    const skip = (dto.page - 1) * dto.limit;
    const fromDate = dto.from ? new Date(`${dto.from}T00:00:00`) : undefined;
    const toDate = dto.to ? new Date(`${dto.to}T23:59:59.999`) : undefined;
    const where = {
        ...(dto.accountId && { accountId: dto.accountId }),
        ...(fromDate || toDate ? { createdAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } } : {}),
        ...(dto.search?.trim() && {
            OR: [
                { receiptNo: { contains: dto.search, mode: "insensitive" } },
                {
                    purchase: {
                        customer: {
                            OR: [
                                { firstName: { contains: dto.search, mode: "insensitive" } },
                                { lastName: { contains: dto.search, mode: "insensitive" } },
                                { nic: { contains: dto.search, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ],
        }),
    };
    const [total, receipts] = await Promise.all([
        prisma_client_1.prisma.accountReceipt.count({ where }),
        prisma_client_1.prisma.accountReceipt.findMany({
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
async function createReceipt(dto, adminId) {
    const [account, purchase] = await Promise.all([
        prisma_client_1.prisma.account.findUnique({ where: { id: dto.accountId } }),
        prisma_client_1.prisma.posCustomerPurchase.findUnique({ where: { id: dto.purchaseId } }),
    ]);
    if (!account || !account.isActive)
        throw errors_1.AppError.notFound("Account not found or inactive");
    if (!purchase)
        throw errors_1.AppError.notFound("Purchase/invoice not found");
    const isChecque = dto.paymentMethod === prisma_2.PaymentMethod.CHEQUE;
    return prisma_client_1.prisma.$transaction(async (tx) => {
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
                chequeStatus: isChecque ? prisma_2.ChequeStatus.PENDING : undefined,
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
                    type: prisma_2.TransactionType.RECEIPT,
                    direction: prisma_2.TransactionDirection.DR,
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
async function updateReceipt(id, dto, adminId) {
    const receipt = await prisma_client_1.prisma.accountReceipt.findUnique({
        where: { id },
        include: { transactions: { where: { isReversal: false } } },
    });
    if (!receipt)
        throw errors_1.AppError.notFound("Receipt not found");
    if (receipt.isVoided)
        throw new errors_1.AppError("Cannot edit a voided receipt", 400);
    if (dto.accountId !== undefined) {
        const account = await prisma_client_1.prisma.account.findUnique({ where: { id: dto.accountId } });
        if (!account || !account.isActive)
            throw errors_1.AppError.notFound("Account not found or inactive");
    }
    const isChecque = (dto.paymentMethod ?? receipt.paymentMethod) === prisma_2.PaymentMethod.CHEQUE;
    return prisma_client_1.prisma.$transaction(async (tx) => {
        const originalTx = receipt.transactions.find((t) => t.type === prisma_2.TransactionType.RECEIPT);
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
async function voidReceipt(id, adminId) {
    const receipt = await prisma_client_1.prisma.accountReceipt.findUnique({
        where: { id },
        include: { transactions: true },
    });
    if (!receipt)
        throw errors_1.AppError.notFound("Receipt not found");
    if (receipt.isVoided)
        throw new errors_1.AppError("Receipt is already voided", 400);
    const originalTx = receipt.transactions.find((t) => t.type === prisma_2.TransactionType.RECEIPT && !t.isReversal);
    return prisma_client_1.prisma.$transaction(async (tx) => {
        await tx.accountReceipt.update({ where: { id }, data: { isVoided: true } });
        if (originalTx && receipt.accountId) {
            await tx.accountTransaction.create({
                data: {
                    accountId: receipt.accountId,
                    type: prisma_2.TransactionType.REVERSAL,
                    direction: prisma_2.TransactionDirection.CR,
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
async function bounceReceipt(id, adminId) {
    const receipt = await prisma_client_1.prisma.accountReceipt.findUnique({ where: { id } });
    if (!receipt)
        throw errors_1.AppError.notFound("Receipt not found");
    if (receipt.paymentMethod !== prisma_2.PaymentMethod.CHEQUE) {
        throw new errors_1.AppError("Only cheque receipts can be marked as bounced", 400);
    }
    if (receipt.chequeStatus !== prisma_2.ChequeStatus.PENDING) {
        throw new errors_1.AppError("Cheque is not in PENDING status", 400);
    }
    if (!receipt.isDeposited) {
        throw new errors_1.AppError("Cheque must be deposited before it can be marked as bounced", 400);
    }
    return prisma_client_1.prisma.$transaction(async (tx) => {
        await tx.accountReceipt.update({
            where: { id },
            data: { chequeStatus: prisma_2.ChequeStatus.BOUNCED, isDeposited: false },
        });
        await tx.accountDepositItem.deleteMany({ where: { receiptId: id } });
        if (receipt.accountId) {
            await tx.accountTransaction.create({
                data: {
                    accountId: receipt.accountId,
                    type: prisma_2.TransactionType.REVERSAL,
                    direction: prisma_2.TransactionDirection.CR,
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
async function clearCheque(id) {
    const receipt = await prisma_client_1.prisma.accountReceipt.findUnique({ where: { id } });
    if (!receipt)
        throw errors_1.AppError.notFound("Receipt not found");
    if (receipt.paymentMethod !== prisma_2.PaymentMethod.CHEQUE) {
        throw new errors_1.AppError("Not a cheque receipt", 400);
    }
    if (receipt.chequeStatus !== prisma_2.ChequeStatus.PENDING) {
        throw new errors_1.AppError("Cheque is not in PENDING status", 400);
    }
    if (!receipt.isDeposited) {
        throw new errors_1.AppError("Cheque must be deposited before it can be cleared", 400);
    }
    return prisma_client_1.prisma.accountReceipt.update({
        where: { id },
        data: { chequeStatus: prisma_2.ChequeStatus.CLEARED },
    });
}
async function getReceiptById(id) {
    const receipt = await prisma_client_1.prisma.accountReceipt.findUnique({
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
    if (!receipt)
        throw errors_1.AppError.notFound("Receipt not found");
    return receipt;
}
async function listVouchers(dto) {
    const skip = (dto.page - 1) * dto.limit;
    const filters = [];
    if (dto.accountId) {
        filters.push(prisma_1.Prisma.sql `v."accountId" = ${dto.accountId}`);
    }
    if (dto.type) {
        filters.push(prisma_1.Prisma.sql `v."type"::text = ${dto.type}`);
    }
    if (dto.search) {
        const search = `%${dto.search}%`;
        const matchingTypes = Object.entries(VOUCHER_TYPE_LABELS)
            .filter(([, label]) => label.toLowerCase().includes(dto.search.toLowerCase()))
            .map(([type]) => type);
        const typeLabelFilter = matchingTypes.length > 0
            ? prisma_1.Prisma.sql `OR v."type"::text IN (${prisma_1.Prisma.join(matchingTypes)})`
            : prisma_1.Prisma.empty;
        filters.push(prisma_1.Prisma.sql `(
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
        ? prisma_1.Prisma.sql `WHERE ${prisma_1.Prisma.join(filters, " AND ")}`
        : prisma_1.Prisma.empty;
    const [totalRows, vouchers] = await Promise.all([
        prisma_client_1.prisma.$queryRaw `
      SELECT COUNT(*)::int AS "count"
      FROM "account_vouchers" v
      JOIN "accounts" a ON a."id" = v."accountId"
      LEFT JOIN "accounts" ta ON ta."id" = v."toAccountId"
      ${whereSql}
    `,
        prisma_client_1.prisma.$queryRaw `
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
async function createVoucher(dto, adminId) {
    const account = await prisma_client_1.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account || !account.isActive)
        throw errors_1.AppError.notFound("Account not found or inactive");
    let toAccount = null;
    if (dto.type === ACCOUNT_TRANSFER_TYPE) {
        toAccount = await prisma_client_1.prisma.account.findUnique({ where: { id: dto.toAccountId } });
        if (!toAccount || !toAccount.isActive)
            throw errors_1.AppError.notFound("Destination account not found or inactive");
    }
    const allTx = await prisma_client_1.prisma.accountTransaction.findMany({
        where: { accountId: dto.accountId },
        select: { direction: true, amount: true },
    });
    const currentBalance = account.openingBalance +
        allTx.reduce((sum, t) => sum + (t.direction === prisma_2.TransactionDirection.DR ? t.amount : -t.amount), 0);
    if (currentBalance < dto.amount) {
        throw new errors_1.AppError(`Insufficient funds. Available balance: Rs. ${currentBalance.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`, 400);
    }
    return prisma_client_1.prisma.$transaction(async (tx) => {
        const created = await createVoucherDraft(tx, dto, adminId);
        if (dto.type === ACCOUNT_TRANSFER_TYPE) {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "toAccountId" = ${dto.toAccountId}
        WHERE "id" = ${created.id}
      `;
        }
        if (dto.payee !== undefined) {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "payee" = ${dto.payee}
        WHERE "id" = ${created.id}
      `;
        }
        if (dto.paymentDate !== undefined) {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "paymentDate" = ${dto.paymentDate}
        WHERE "id" = ${created.id}
      `;
        }
        if (dto.referenceNo !== undefined) {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "referenceNo" = ${dto.referenceNo}
        WHERE "id" = ${created.id}
      `;
        }
        const voucherNo = `VCH-${String(created.id).padStart(5, "0")}`;
        if (dto.type === ACCOUNT_TRANSFER_TYPE && toAccount) {
            await Promise.all([
                tx.$executeRaw `
          UPDATE "account_vouchers"
          SET "voucherNo" = ${voucherNo}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${created.id}
        `,
                createTransferTransaction(tx, {
                    accountId: dto.accountId,
                    direction: "CR",
                    amount: dto.amount,
                    voucherId: created.id,
                    refNo: voucherNo,
                    description: dto.description ?? `Transfer to ${toAccount.name}`,
                    createdById: adminId,
                }),
                createTransferTransaction(tx, {
                    accountId: dto.toAccountId,
                    direction: "DR",
                    amount: dto.amount,
                    voucherId: created.id,
                    refNo: voucherNo,
                    description: dto.description ?? `Transfer from ${account.name}`,
                    createdById: adminId,
                }),
            ]);
            const voucher = await findRawVoucherById(tx, created.id);
            if (!voucher)
                throw new errors_1.AppError("Failed to load created account transfer voucher", 500);
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
                    type: prisma_2.TransactionType.VOUCHER,
                    direction: prisma_2.TransactionDirection.CR,
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
async function updateVoucher(id, dto, adminId) {
    const voucherMeta = await findRawVoucherById(prisma_client_1.prisma, id);
    if (!voucherMeta)
        throw errors_1.AppError.notFound("Voucher not found");
    if (voucherMeta.isVoided)
        throw new errors_1.AppError("Cannot edit a voided voucher", 400);
    const isTransfer = voucherMeta.type === ACCOUNT_TRANSFER_TYPE;
    if (isTransfer) {
        if (dto.type !== undefined || dto.amount !== undefined) {
            throw new errors_1.AppError("Type and amount cannot be changed on an account transfer", 400);
        }
        return prisma_client_1.prisma.$transaction(async (tx) => {
            if (dto.description !== undefined) {
                await tx.$executeRaw `
          UPDATE "account_vouchers"
          SET "description" = ${dto.description}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
            }
            if (dto.payee !== undefined) {
                await tx.$executeRaw `
          UPDATE "account_vouchers"
          SET "payee" = ${dto.payee}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
            }
            if (dto.paymentDate !== undefined) {
                await tx.$executeRaw `
          UPDATE "account_vouchers"
          SET "paymentDate" = ${dto.paymentDate}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
            }
            if (dto.referenceNo !== undefined) {
                await tx.$executeRaw `
          UPDATE "account_vouchers"
          SET "referenceNo" = ${dto.referenceNo}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `;
            }
            const updated = await findRawVoucherById(tx, id);
            if (!updated)
                throw errors_1.AppError.notFound("Voucher not found");
            return { ...mapRawVoucherRow(updated), typeLabel: voucherTypeLabel(updated.type) };
        });
    }
    const voucher = await prisma_client_1.prisma.accountVoucher.findUnique({
        where: { id },
        include: { transactions: { where: { isReversal: false } } },
    });
    if (!voucher)
        throw errors_1.AppError.notFound("Voucher not found");
    if (voucher.isVoided)
        throw new errors_1.AppError("Cannot edit a voided voucher", 400);
    if (dto.type === ACCOUNT_TRANSFER_TYPE) {
        throw new errors_1.AppError("Existing vouchers cannot be converted to account transfers", 400);
    }
    const originalTx = voucher.transactions.find((t) => t.type === prisma_2.TransactionType.VOUCHER);
    return prisma_client_1.prisma.$transaction(async (tx) => {
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
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "payee" = ${dto.payee}
        WHERE "id" = ${id}
      `;
        }
        if (dto.paymentDate !== undefined) {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "paymentDate" = ${dto.paymentDate}
        WHERE "id" = ${id}
      `;
        }
        if (dto.referenceNo !== undefined) {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "referenceNo" = ${dto.referenceNo}
        WHERE "id" = ${id}
      `;
        }
        return { ...mapVoucherRow(updated, await resolveVoucherToAccount(tx, updated.toAccountId)), typeLabel: voucherTypeLabel(updated.type) };
    });
}
async function voidVoucher(id, adminId) {
    const voucherMeta = await findRawVoucherById(prisma_client_1.prisma, id);
    if (!voucherMeta)
        throw errors_1.AppError.notFound("Voucher not found");
    if (voucherMeta.isVoided)
        throw new errors_1.AppError("Voucher is already voided", 400);
    if (voucherMeta.type === ACCOUNT_TRANSFER_TYPE) {
        return prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `
        UPDATE "account_vouchers"
        SET "isVoided" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `;
            const transferTransactions = await tx.$queryRaw `
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
            const reversals = [];
            if (sourceTx) {
                reversals.push(tx.accountTransaction.create({
                    data: {
                        accountId: sourceTx.accountId,
                        type: prisma_2.TransactionType.REVERSAL,
                        direction: prisma_2.TransactionDirection.DR,
                        amount: sourceTx.amount,
                        voucherId: id,
                        refNo: voucherMeta.voucherNo,
                        description: `Void of transfer ${voucherMeta.voucherNo}`,
                        isReversal: true,
                        createdById: adminId,
                    },
                }));
            }
            if (destTx) {
                reversals.push(tx.accountTransaction.create({
                    data: {
                        accountId: destTx.accountId,
                        type: prisma_2.TransactionType.REVERSAL,
                        direction: prisma_2.TransactionDirection.CR,
                        amount: destTx.amount,
                        voucherId: id,
                        refNo: voucherMeta.voucherNo,
                        description: `Void of transfer ${voucherMeta.voucherNo}`,
                        isReversal: true,
                        createdById: adminId,
                    },
                }));
            }
            await Promise.all(reversals);
            return { message: "Voucher voided successfully" };
        });
    }
    const voucher = await prisma_client_1.prisma.accountVoucher.findUnique({
        where: { id },
        include: { transactions: true },
    });
    if (!voucher)
        throw errors_1.AppError.notFound("Voucher not found");
    if (voucher.isVoided)
        throw new errors_1.AppError("Voucher is already voided", 400);
    return prisma_client_1.prisma.$transaction(async (tx) => {
        await tx.accountVoucher.update({ where: { id }, data: { isVoided: true } });
        const originalTx = voucher.transactions.find((t) => t.type === prisma_2.TransactionType.VOUCHER && !t.isReversal);
        if (originalTx) {
            await tx.accountTransaction.create({
                data: {
                    accountId: voucher.accountId,
                    type: prisma_2.TransactionType.REVERSAL,
                    direction: prisma_2.TransactionDirection.DR,
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
async function getVoucherById(id) {
    const voucher = await findRawVoucherById(prisma_client_1.prisma, id);
    if (!voucher)
        throw errors_1.AppError.notFound("Voucher not found");
    return { ...mapRawVoucherRow(voucher), typeLabel: voucherTypeLabel(voucher.type) };
}
async function listInvoicePayments(dto) {
    const skip = (dto.page - 1) * dto.limit;
    const fromDate = dto.from ? new Date(`${dto.from}T00:00:00`) : undefined;
    const toDate = dto.to ? new Date(`${dto.to}T23:59:59.999`) : undefined;
    const searchClause = dto.search?.trim()
        ? {
            purchase: {
                OR: [
                    { customer: { firstName: { contains: dto.search, mode: "insensitive" } } },
                    { customer: { lastName: { contains: dto.search, mode: "insensitive" } } },
                    { customer: { nic: { contains: dto.search, mode: "insensitive" } } },
                    { invoiceGroupCode: { contains: dto.search, mode: "insensitive" } },
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
    const purchaseSelect = {
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
    if ((0, prisma_model_1.prismaModelHasObjectField)(prisma_client_1.prisma, "PosCustomerPurchase", "preOrder")) {
        purchaseSelect.preOrder = {
            select: { displayId: true, brand: true, model: true, colour: true },
        };
    }
    const [total, payments] = await Promise.all([
        prisma_client_1.prisma.invoicePayment.count({ where }),
        prisma_client_1.prisma.invoicePayment.findMany({
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
    ]);
    const data = payments.map((p) => {
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
async function generateReceiptFromPayment(paymentId, dto, adminId) {
    const payment = await prisma_client_1.prisma.invoicePayment.findUnique({
        where: { id: paymentId },
        include: { purchase: true },
    });
    if (!payment)
        throw errors_1.AppError.notFound("Invoice payment not found");
    if (payment.receiptId !== null)
        throw new errors_1.AppError("Receipt already generated for this payment", 400);
    const isChecque = payment.paymentMethod === prisma_2.PaymentMethod.CHEQUE;
    return prisma_client_1.prisma.$transaction(async (tx) => {
        const created = await tx.accountReceipt.create({
            data: {
                receiptNo: "TEMP",
                purchaseId: payment.purchaseId,
                amount: payment.amount,
                paymentMethod: payment.paymentMethod,
                chequeNo: isChecque ? (payment.chequeNo ?? undefined) : undefined,
                chequeBank: isChecque ? (payment.chequeBank ?? undefined) : undefined,
                chequeDate: isChecque ? (payment.chequeDate ?? undefined) : undefined,
                chequeStatus: isChecque ? prisma_2.ChequeStatus.PENDING : undefined,
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
async function listDeposits(dto) {
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
        prisma_client_1.prisma.accountDeposit.count({ where }),
        prisma_client_1.prisma.accountDeposit.findMany({
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
async function getDeposit(id) {
    const deposit = await prisma_client_1.prisma.accountDeposit.findUnique({
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
    if (!deposit)
        throw errors_1.AppError.notFound("Deposit not found");
    return deposit;
}
async function createDeposit(dto, adminId) {
    const [account, subAccount] = await Promise.all([
        prisma_client_1.prisma.account.findUnique({ where: { id: dto.accountId } }),
        dto.subAccountId
            ? prisma_client_1.prisma.account.findUnique({ where: { id: dto.subAccountId } })
            : Promise.resolve(null),
    ]);
    if (!account || !account.isActive || account.level !== prisma_2.AccountLevel.MAIN) {
        throw errors_1.AppError.notFound("Main account not found or inactive");
    }
    if (dto.subAccountId) {
        if (!subAccount || !subAccount.isActive || subAccount.level !== prisma_2.AccountLevel.SUB) {
            throw errors_1.AppError.notFound("Sub account not found or inactive");
        }
        const relationship = await prisma_client_1.prisma.accountRelationship.findUnique({
            where: {
                mainAccountId_subAccountId: {
                    mainAccountId: dto.accountId,
                    subAccountId: dto.subAccountId,
                },
            },
        });
        if (!relationship)
            throw new errors_1.AppError("Sub account is not linked to the selected main account", 400);
    }
    const receipts = await prisma_client_1.prisma.accountReceipt.findMany({
        where: { id: { in: dto.receiptIds }, isVoided: false, isDeposited: false },
        include: {
            purchase: {
                select: { customer: { select: { firstName: true, lastName: true } } },
            },
        },
    });
    if (receipts.length !== dto.receiptIds.length) {
        throw new errors_1.AppError("Some receipts are invalid, already deposited, or voided", 400);
    }
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    const chequeNos = receipts
        .filter((r) => r.paymentMethod === prisma_2.PaymentMethod.CHEQUE && r.chequeNo)
        .map((r) => r.chequeNo);
    const depositChequeNo = chequeNos.length > 0 ? chequeNos.join(", ") : undefined;
    return prisma_client_1.prisma.$transaction(async (tx) => {
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
                where: { id: { in: dto.receiptIds }, paymentMethod: prisma_2.PaymentMethod.CHEQUE },
                data: { chequeStatus: prisma_2.ChequeStatus.PENDING },
            }),
            tx.accountTransaction.create({
                data: {
                    accountId: dto.accountId,
                    type: prisma_2.TransactionType.DEPOSIT,
                    direction: prisma_2.TransactionDirection.DR,
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
                        type: prisma_2.TransactionType.DEPOSIT,
                        direction: prisma_2.TransactionDirection.DR,
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
async function reverseDeposit(depositId, adminId) {
    const deposit = await prisma_client_1.prisma.accountDeposit.findUnique({
        where: { id: depositId },
        include: {
            items: true,
            transactions: { where: { isReversal: false } },
        },
    });
    if (!deposit)
        throw errors_1.AppError.notFound("Deposit not found");
    if (deposit.isReversed)
        throw new errors_1.AppError("Deposit is already reversed", 400);
    return prisma_client_1.prisma.$transaction(async (tx) => {
        await tx.accountDeposit.update({
            where: { id: depositId },
            data: { isReversed: true, reversedAt: new Date() },
        });
        await tx.accountDepositItem.deleteMany({ where: { depositId } });
        await tx.accountReceipt.updateMany({
            where: { id: { in: deposit.items.map((i) => i.receiptId) } },
            data: { isDeposited: false },
        });
        await tx.accountTransaction.createMany({
            data: deposit.transactions.map((transaction) => ({
                accountId: transaction.accountId,
                type: prisma_2.TransactionType.REVERSAL,
                direction: transaction.direction === prisma_2.TransactionDirection.DR
                    ? prisma_2.TransactionDirection.CR
                    : prisma_2.TransactionDirection.DR,
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
async function getLedger(dto) {
    const account = await prisma_client_1.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account)
        throw errors_1.AppError.notFound("Account not found");
    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to + "T23:59:59.999Z");
    const preTransactions = await prisma_client_1.prisma.$queryRaw `
    SELECT "direction"::text AS "direction", "amount"
    FROM "account_transactions"
    WHERE "accountId" = ${dto.accountId}
      AND "createdAt" < ${fromDate}
  `;
    const openingBalance = account.openingBalance +
        preTransactions.reduce((sum, t) => {
            return sum + (t.direction === "DR" ? t.amount : -t.amount);
        }, 0);
    const transactions = await prisma_client_1.prisma.$queryRaw `
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
                : t.type === prisma_2.TransactionType.RECEIPT
                    ? "Receipt"
                    : t.type === prisma_2.TransactionType.DEPOSIT
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
async function getAccountBalance(accountId) {
    const account = await prisma_client_1.prisma.account.findUnique({ where: { id: accountId } });
    if (!account)
        throw errors_1.AppError.notFound("Account not found");
    const transactions = await prisma_client_1.prisma.accountTransaction.findMany({
        where: { accountId },
        select: { direction: true, amount: true },
    });
    const balance = account.openingBalance +
        transactions.reduce((sum, t) => sum + (t.direction === prisma_2.TransactionDirection.DR ? t.amount : -t.amount), 0);
    return { accountId, balance };
}
