"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvinceDistrictMeta = getProvinceDistrictMeta;
exports.listDreamBikeOptions = listDreamBikeOptions;
exports.listLeasingCompanies = listLeasingCompanies;
exports.createLeasingCompany = createLeasingCompany;
exports.updateLeasingCompany = updateLeasingCompany;
exports.deleteLeasingCompany = deleteLeasingCompany;
exports.listLeasingApplicationsByCompany = listLeasingApplicationsByCompany;
exports.listPosUsers = listPosUsers;
exports.getPosUser = getPosUser;
exports.createPosUser = createPosUser;
exports.updatePosUser = updatePosUser;
exports.deletePosUser = deletePosUser;
exports.checkoutSale = checkoutSale;
exports.createPurchase = createPurchase;
exports.listPurchases = listPurchases;
exports.listPurchasesByUser = listPurchasesByUser;
exports.settlePurchase = settlePurchase;
exports.updatePurchase = updatePurchase;
exports.getPurchaseInstallments = getPurchaseInstallments;
exports.listInvoiceAccounts = listInvoiceAccounts;
exports.createInvoiceAccount = createInvoiceAccount;
exports.updateInvoiceAccount = updateInvoiceAccount;
exports.deleteInvoiceAccount = deleteInvoiceAccount;
exports.listInvoiceTerms = listInvoiceTerms;
exports.createInvoiceTerm = createInvoiceTerm;
exports.updateInvoiceTerm = updateInvoiceTerm;
exports.deleteInvoiceTerm = deleteInvoiceTerm;
const prisma_1 = require("../../generated/prisma");
const prisma_client_1 = require("../../database/prisma.client");
const errors_1 = require("../../common/utils/errors");
const prisma_model_1 = require("../../common/utils/prisma-model");
const PROVINCE_DISTRICT_MAP = {
    Western: ["Colombo", "Gampaha", "Kalutara"],
    Central: ["Kandy", "Matale", "Nuwara Eliya"],
    Southern: ["Galle", "Matara", "Hambantota"],
    Northern: ["Jaffna", "Kilinochchi", "Mannar", "Mullaitivu", "Vavuniya"],
    Eastern: ["Trincomalee", "Batticaloa", "Ampara"],
    "North Western": ["Kurunegala", "Puttalam"],
    "North Central": ["Anuradhapura", "Polonnaruwa"],
    Uva: ["Badulla", "Monaragala"],
    Sabaragamuwa: ["Ratnapura", "Kegalle"],
};
const customerInclude = {
    dreamBikes: {
        include: {
            bikeVehicle: {
                select: {
                    id: true,
                    displayId: true,
                    status: true,
                    colour: true,
                    year: true,
                    sellingPrice: true,
                    brand: { select: { name: true } },
                    model: { select: { name: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    },
};
function normalizeSearch(search) {
    const value = search?.trim();
    return value && value.length > 0 ? value : undefined;
}
function roundCurrency(value) {
    return Math.round(value * 100) / 100;
}
function normalizeExtraCosts(costs) {
    return (costs ?? []).map((cost) => ({
        label: cost.label.trim(),
        amount: roundCurrency(cost.amount),
    }));
}
function getExtraCostsTotal(costs) {
    return roundCurrency(normalizeExtraCosts(costs).reduce((sum, cost) => sum + cost.amount, 0));
}
function getStoredExtraCostsTotal(value) {
    if (!Array.isArray(value))
        return 0;
    return roundCurrency(value.reduce((sum, cost) => {
        if (!cost || typeof cost !== "object")
            return sum;
        const amount = Number(cost.amount);
        return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
    }, 0));
}
function nullableTrimmedText(value) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
}
function resolvePaymentDetails(finalSellingPrice, paymentType, downPaymentAmount) {
    if (paymentType === "DIRECT") {
        return {
            downPaymentAmount: roundCurrency(finalSellingPrice),
            remainingAmount: 0,
            settlementStatus: "SETTLED",
        };
    }
    const normalizedDownPayment = roundCurrency(downPaymentAmount ?? 0);
    if (normalizedDownPayment <= 0) {
        throw errors_1.AppError.validation({
            downPaymentAmount: ["Downpayment amount must be greater than 0"],
        });
    }
    if (normalizedDownPayment > finalSellingPrice) {
        throw errors_1.AppError.validation({
            downPaymentAmount: [
                "Downpayment amount cannot exceed final selling price",
            ],
        });
    }
    const remainingAmount = roundCurrency(finalSellingPrice - normalizedDownPayment);
    return {
        downPaymentAmount: normalizedDownPayment,
        remainingAmount,
        settlementStatus: remainingAmount > 0 ? "TO_SETTLE" : "SETTLED",
    };
}
const invoiceAccountSelectSql = prisma_1.Prisma.sql `
  "id",
  "accountHolder",
  "accountNumber",
  "bankName",
  "branchName",
  "sortOrder",
  "isActive",
  "createdAt",
  "updatedAt"
`;
function getRawDatabaseErrorCode(error) {
    const metaCode = error.meta?.code;
    return typeof metaCode === "string" ? metaCode : error.code;
}
function handleInvoiceAccountPersistenceError(error) {
    if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError) {
        const rawCode = getRawDatabaseErrorCode(error);
        if (error.code === "P2025") {
            throw errors_1.AppError.notFound("Invoice account not found");
        }
        if (error.code === "P2002" || rawCode === "23505") {
            throw errors_1.AppError.conflict("Invoice account already exists");
        }
        if (error.code === "P2021" || rawCode === "42P01") {
            throw new errors_1.AppError("Invoice account table is unavailable. Run database migrations in apps/backend and restart the backend server.", 500);
        }
        if (error.code === "P2022" || rawCode === "42703") {
            throw new errors_1.AppError("Invoice account table is not up to date. Run database migrations in apps/backend and restart the backend server.", 500);
        }
    }
    throw error;
}
async function listInvoiceAccountsWithRawSql() {
    return prisma_client_1.prisma.$queryRaw `
    SELECT ${invoiceAccountSelectSql}
    FROM "pos_invoice_accounts"
    ORDER BY "sortOrder" ASC, "id" ASC
  `;
}
async function getNextInvoiceAccountSortOrder() {
    const [row] = await prisma_client_1.prisma.$queryRaw `
    SELECT MAX("sortOrder")::int AS "sortOrder"
    FROM "pos_invoice_accounts"
  `;
    return (row?.sortOrder ?? 0) + 1;
}
async function createInvoiceAccountWithRawSql(dto) {
    const sortOrder = dto.sortOrder ?? (await getNextInvoiceAccountSortOrder());
    const [account] = await prisma_client_1.prisma.$queryRaw `
    INSERT INTO "pos_invoice_accounts" (
      "accountHolder",
      "accountNumber",
      "bankName",
      "branchName",
      "sortOrder",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${dto.accountHolder},
      ${dto.accountNumber},
      ${dto.bankName},
      ${nullableTrimmedText(dto.branchName)},
      ${sortOrder},
      ${dto.isActive ?? true},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING ${invoiceAccountSelectSql}
  `;
    return account;
}
async function updateInvoiceAccountWithRawSql(accountId, dto) {
    const [account] = await prisma_client_1.prisma.$queryRaw `
    UPDATE "pos_invoice_accounts"
    SET
      "accountHolder" = CASE WHEN ${dto.accountHolder != null} THEN ${dto.accountHolder ?? ""} ELSE "accountHolder" END,
      "accountNumber" = CASE WHEN ${dto.accountNumber != null} THEN ${dto.accountNumber ?? ""} ELSE "accountNumber" END,
      "bankName" = CASE WHEN ${dto.bankName != null} THEN ${dto.bankName ?? ""} ELSE "bankName" END,
      "branchName" = CASE WHEN ${dto.branchName !== undefined} THEN ${nullableTrimmedText(dto.branchName)} ELSE "branchName" END,
      "sortOrder" = CASE WHEN ${dto.sortOrder != null} THEN ${dto.sortOrder ?? 1} ELSE "sortOrder" END,
      "isActive" = CASE WHEN ${dto.isActive != null} THEN ${dto.isActive ?? true} ELSE "isActive" END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${accountId}
    RETURNING ${invoiceAccountSelectSql}
  `;
    if (!account) {
        throw errors_1.AppError.notFound("Invoice account not found");
    }
    return account;
}
async function deleteInvoiceAccountWithRawSql(accountId) {
    const deletedRows = await prisma_client_1.prisma.$queryRaw `
    DELETE FROM "pos_invoice_accounts"
    WHERE "id" = ${accountId}
    RETURNING "id"
  `;
    if (deletedRows.length === 0) {
        throw errors_1.AppError.notFound("Invoice account not found");
    }
}
function getPurchaseModelClient(db) {
    const model = db?.posCustomerPurchase;
    if (!model) {
        throw new errors_1.AppError("Purchase model is unavailable. Run 'npm run db:generate' in apps/backend and restart the backend server.", 500);
    }
    return model;
}
function getInvoiceAccountModelClient(db) {
    return db?.posInvoiceAccount ?? null;
}
function getInvoiceTermModelClient(db) {
    const model = db?.posInvoiceTerm;
    if (!model) {
        throw new errors_1.AppError("Invoice term model is unavailable. Run 'npm run db:generate' in apps/backend and restart the backend server.", 500);
    }
    return model;
}
function getLeasingCompanyModelClient(db) {
    const model = db?.posLeasingCompany;
    if (!model) {
        throw new errors_1.AppError("Leasing company model is unavailable. Run 'npm run db:generate' in apps/backend and restart the backend server.", 500);
    }
    return model;
}
function getInstallmentModelClient(db) {
    const model = db?.posInstallment;
    if (!model) {
        throw new errors_1.AppError("Installment model is unavailable. Run 'npm run db:generate' in apps/backend and restart the backend server.", 500);
    }
    return model;
}
function getInvoicePaymentModelClient(db) {
    const model = db?.invoicePayment;
    if (!model) {
        return null;
    }
    return model;
}
function mapUniqueConstraint(error) {
    const target = `${error.meta?.target ?? ""}`;
    if (target.includes("nic"))
        return errors_1.AppError.conflict("NIC already exists");
    if (target.includes("mobileNumber"))
        return errors_1.AppError.conflict("Mobile number already exists");
    if (target.includes("email"))
        return errors_1.AppError.conflict("Email already exists");
    return errors_1.AppError.conflict("Record already exists");
}
function ensureDistrictInProvince(province, district) {
    const validDistricts = PROVINCE_DISTRICT_MAP[province];
    if (!validDistricts) {
        throw errors_1.AppError.validation({ province: ["Invalid province"] });
    }
    if (!validDistricts.includes(district)) {
        throw errors_1.AppError.validation({
            district: ["District does not match selected province"],
        });
    }
}
async function ensureDreamBikesExist(dreamBikeIds) {
    if (dreamBikeIds.length === 0)
        return;
    const found = await prisma_client_1.prisma.bikeVehicle.findMany({
        where: { id: { in: dreamBikeIds } },
        select: { id: true },
    });
    if (found.length !== dreamBikeIds.length) {
        throw errors_1.AppError.validation({
            dreamBikeIds: ["One or more selected dream bikes are invalid"],
        });
    }
}
function mapCustomer(customer) {
    return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        nic: customer.nic,
        mobileNumber: customer.mobileNumber,
        email: customer.email,
        province: customer.province,
        district: customer.district,
        address: customer.address,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        dreamBikes: customer.dreamBikes.map((entry) => ({
            relationId: entry.id,
            bikeId: entry.bikeVehicleId,
            displayId: entry.bikeVehicle.displayId,
            brandName: entry.bikeVehicle.brand.name,
            modelName: entry.bikeVehicle.model.name,
            colour: entry.bikeVehicle.colour,
            year: entry.bikeVehicle.year,
            sellingPrice: entry.bikeVehicle.sellingPrice,
            availability: entry.bikeVehicle.status,
        })),
    };
}
function getProvinceDistrictMeta() {
    return {
        provinces: Object.entries(PROVINCE_DISTRICT_MAP).map(([name, districts]) => ({
            name,
            districts,
        })),
    };
}
async function listDreamBikeOptions() {
    const bikes = await prisma_client_1.prisma.bikeVehicle.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 5000,
        select: {
            id: true,
            displayId: true,
            status: true,
            colour: true,
            year: true,
            sellingPrice: true,
            brand: { select: { name: true } },
            model: { select: { name: true } },
        },
    });
    return bikes.map((bike) => ({
        id: bike.id,
        displayId: bike.displayId,
        brandName: bike.brand.name,
        modelName: bike.model.name,
        colour: bike.colour,
        year: bike.year,
        sellingPrice: bike.sellingPrice,
        availability: bike.status,
    }));
}
async function listLeasingCompanies() {
    const model = getLeasingCompanyModelClient(prisma_client_1.prisma);
    const companies = await model.findMany({
        orderBy: [{ name: "asc" }],
    });
    return {
        companies,
    };
}
async function createLeasingCompany(dto) {
    const model = getLeasingCompanyModelClient(prisma_client_1.prisma);
    try {
        return await model.create({
            data: {
                name: dto.name,
            },
        });
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw errors_1.AppError.conflict("Leasing company name already exists");
        }
        throw error;
    }
}
async function updateLeasingCompany(companyId, dto) {
    const model = getLeasingCompanyModelClient(prisma_client_1.prisma);
    try {
        return await model.update({
            where: { id: companyId },
            data: {
                ...(dto.name != null ? { name: dto.name } : {}),
            },
        });
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw errors_1.AppError.conflict("Leasing company name already exists");
        }
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025") {
            throw errors_1.AppError.notFound("Leasing company not found");
        }
        throw error;
    }
}
async function deleteLeasingCompany(companyId) {
    const model = getLeasingCompanyModelClient(prisma_client_1.prisma);
    try {
        await model.delete({ where: { id: companyId } });
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025") {
            throw errors_1.AppError.notFound("Leasing company not found");
        }
        throw error;
    }
}
async function listLeasingApplicationsByCompany(companyId, query) {
    const companyModel = getLeasingCompanyModelClient(prisma_client_1.prisma);
    const purchaseModel = getPurchaseModelClient(prisma_client_1.prisma);
    const company = await companyModel.findUnique({ where: { id: companyId } });
    if (!company)
        throw errors_1.AppError.notFound("Leasing company not found");
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
        purchaseModel.findMany({
            where: {
                purchaseChannel: "LEASING",
                leasingCompanyId: companyId,
            },
            skip,
            take: limit,
            orderBy: { purchasedAt: "desc" },
            include: {
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        nic: true,
                        mobileNumber: true,
                        address: true,
                        province: true,
                        district: true,
                    },
                },
                bikeVehicle: {
                    select: {
                        id: true,
                        displayId: true,
                        colour: true,
                        brand: { select: { name: true } },
                        model: { select: { name: true } },
                    },
                },
            },
        }),
        purchaseModel.count({
            where: {
                purchaseChannel: "LEASING",
                leasingCompanyId: companyId,
            },
        }),
    ]);
    return {
        company,
        applications: rows.map((row) => ({
            id: row.id,
            purchasedAt: row.purchasedAt,
            invoiceGroupCode: row.invoiceGroupCode,
            purchaseMode: row.purchaseMode,
            finalSellingPrice: row.finalSellingPrice,
            downPaymentAmount: row.downPaymentAmount,
            remainingAmount: row.remainingAmount,
            settlementStatus: row.settlementStatus,
            leasingDownPaymentAmount: row.leasingDownPaymentAmount,
            leasingFinancedAmount: row.leasingFinancedAmount,
            customer: row.customer,
            bike: row.bikeVehicle
                ? {
                    id: row.bikeVehicle.id,
                    displayId: row.bikeVehicle.displayId,
                    brand: row.bikeVehicle.brand.name,
                    model: row.bikeVehicle.model.name,
                    colour: row.bikeVehicle.colour,
                }
                : null,
        })),
        total,
        page,
        limit,
    };
}
async function listPosUsers(query) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const where = search
        ? {
            OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { nic: { contains: search, mode: "insensitive" } },
                { mobileNumber: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { province: { contains: search, mode: "insensitive" } },
                { district: { contains: search, mode: "insensitive" } },
            ],
        }
        : {};
    const [users, total] = await Promise.all([
        prisma_client_1.prisma.posCustomer.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: customerInclude,
        }),
        prisma_client_1.prisma.posCustomer.count({ where }),
    ]);
    return {
        users: users.map(mapCustomer),
        total,
        page,
        limit,
    };
}
async function getPosUser(id) {
    const user = await prisma_client_1.prisma.posCustomer.findUnique({
        where: { id },
        include: customerInclude,
    });
    if (!user)
        throw errors_1.AppError.notFound("User not found");
    return mapCustomer(user);
}
async function createPosUser(dto) {
    const dreamBikeIds = dto.dreamBikeIds ?? [];
    ensureDistrictInProvince(dto.province, dto.district);
    await ensureDreamBikesExist(dreamBikeIds);
    try {
        const created = await prisma_client_1.prisma.posCustomer.create({
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                nic: dto.nic,
                mobileNumber: dto.mobileNumber,
                email: dto.email,
                province: dto.province,
                district: dto.district,
                address: dto.address,
                dreamBikes: {
                    create: dreamBikeIds.map((bikeId) => ({ bikeVehicleId: bikeId })),
                },
            },
            include: customerInclude,
        });
        return mapCustomer(created);
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw mapUniqueConstraint(error);
        }
        throw error;
    }
}
async function updatePosUser(id, dto) {
    const existing = await prisma_client_1.prisma.posCustomer.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing)
        throw errors_1.AppError.notFound("User not found");
    const updateData = {};
    if (dto.firstName !== undefined)
        updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined)
        updateData.lastName = dto.lastName;
    if (dto.nic !== undefined)
        updateData.nic = dto.nic;
    if (dto.mobileNumber !== undefined)
        updateData.mobileNumber = dto.mobileNumber;
    if (dto.email !== undefined)
        updateData.email = dto.email ?? null;
    if (dto.province !== undefined)
        updateData.province = dto.province;
    if (dto.district !== undefined)
        updateData.district = dto.district;
    if (dto.address !== undefined)
        updateData.address = dto.address;
    const effectiveProvince = dto.province;
    const effectiveDistrict = dto.district;
    if (effectiveProvince && effectiveDistrict) {
        ensureDistrictInProvince(effectiveProvince, effectiveDistrict);
    }
    else if (effectiveProvince || effectiveDistrict) {
        const current = await prisma_client_1.prisma.posCustomer.findUnique({
            where: { id },
            select: { province: true, district: true },
        });
        if (!current)
            throw errors_1.AppError.notFound("User not found");
        ensureDistrictInProvince(effectiveProvince ?? current.province, effectiveDistrict ?? current.district);
    }
    if (dto.dreamBikeIds !== undefined) {
        const dreamBikeIds = dto.dreamBikeIds ?? [];
        await ensureDreamBikesExist(dreamBikeIds);
        updateData.dreamBikes = {
            deleteMany: {},
            create: dreamBikeIds.map((bikeId) => ({ bikeVehicleId: bikeId })),
        };
    }
    try {
        const updated = await prisma_client_1.prisma.posCustomer.update({
            where: { id },
            data: updateData,
            include: customerInclude,
        });
        return mapCustomer(updated);
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw mapUniqueConstraint(error);
        }
        throw error;
    }
}
async function deletePosUser(id) {
    const existing = await prisma_client_1.prisma.posCustomer.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing)
        throw errors_1.AppError.notFound("User not found");
    await prisma_client_1.prisma.posCustomer.delete({ where: { id } });
}
async function checkoutSale(dto) {
    const mergedItems = Array.from(dto.items.reduce((items, item) => {
        const existing = items.get(item.productId);
        if (existing) {
            existing.quantity += item.quantity;
            existing.unitPrice = item.unitPrice;
        }
        else {
            items.set(item.productId, { ...item });
        }
        return items;
    }, new Map()).values());
    const products = await prisma_client_1.prisma.inventoryProduct.findMany({
        where: { id: { in: mergedItems.map((item) => item.productId) } },
        select: { id: true, name: true, displayId: true, quantity: true },
    });
    if (products.length !== mergedItems.length) {
        throw errors_1.AppError.validation({ items: ["One or more products no longer exist"] });
    }
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const item of mergedItems) {
        const product = productById.get(item.productId);
        if (item.quantity > product.quantity) {
            throw errors_1.AppError.validation({
                items: [`Only ${product.quantity} unit(s) of ${product.name} are available`],
            });
        }
    }
    const invoiceGroupCode = `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const total = roundCurrency(mergedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const result = await prisma_client_1.prisma.$transaction(async (tx) => {
        const customer = await tx.posCustomer.upsert({
            where: { nic: "WALK-IN" },
            update: {},
            create: {
                firstName: "Walk-in",
                lastName: "Customer",
                nic: "WALK-IN",
                mobileNumber: "WALK-IN",
                province: "North Western",
                district: "Kurunegala",
                address: "Bar Shop counter sale",
            },
        });
        const purchases = [];
        for (const item of mergedItems) {
            const product = productById.get(item.productId);
            const updated = await tx.inventoryProduct.updateMany({
                where: { id: item.productId, quantity: { gte: item.quantity } },
                data: {
                    quantity: { decrement: item.quantity },
                    soldQuantity: { increment: item.quantity },
                    lastSoldAt: new Date(),
                },
            });
            if (updated.count !== 1) {
                throw new errors_1.AppError(`${product.name} does not have enough stock`, 409);
            }
            const lineTotal = roundCurrency(item.unitPrice * item.quantity);
            const purchase = await tx.posCustomerPurchase.create({
                data: {
                    customerId: customer.id,
                    itemType: "INVENTORY",
                    purchaseMode: mergedItems.length > 1 ? "BULK" : "SINGLE",
                    invoiceGroupCode,
                    inventoryProductId: item.productId,
                    quantity: item.quantity,
                    currentSellingPrice: item.unitPrice,
                    finalSellingPrice: lineTotal,
                    paymentType: "DIRECT",
                    downPaymentAmount: lineTotal,
                    remainingAmount: 0,
                    settlementStatus: "SETTLED",
                    purchaseChannel: "PERSONAL",
                },
            });
            if (lineTotal > 0) {
                await tx.invoicePayment.create({
                    data: {
                        purchaseId: purchase.id,
                        amount: lineTotal,
                        paymentMethod: dto.paymentMethod,
                        description: `Counter sale — ${invoiceGroupCode}`,
                    },
                });
            }
            purchases.push({
                id: purchase.id,
                productId: item.productId,
                displayId: product.displayId,
                name: product.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal,
            });
        }
        return { customerId: customer.id, purchases };
    });
    return {
        invoiceGroupCode,
        paymentMethod: dto.paymentMethod,
        total,
        itemCount: mergedItems.reduce((sum, item) => sum + item.quantity, 0),
        ...result,
    };
}
async function createInvoicePaymentRecord(purchaseId, dto, invoiceGroupCode) {
    let amount = 0;
    if (dto.purchaseChannel === "LEASING") {
        amount = dto.leasingDownPaymentAmount ?? 0;
    }
    else if (dto.paymentType === "DOWNPAYMENT" || (dto.downPaymentAmount != null && dto.downPaymentAmount > 0 && dto.downPaymentAmount < dto.finalSellingPrice)) {
        amount = dto.downPaymentAmount ?? 0;
    }
    else {
        amount =
            dto.finalSellingPrice +
                (dto.hasRegistrationFee ? (dto.registrationFeeAmount ?? 0) : 0) +
                getExtraCostsTotal(dto.extraCosts);
    }
    if (amount <= 0)
        return;
    const invoiceRef = invoiceGroupCode ?? `INV-${String(purchaseId).padStart(5, "0")}`;
    await prisma_client_1.prisma.$executeRaw `
    INSERT INTO "invoice_payments" (
      "purchaseId",
      "amount",
      "paymentMethod",
      "chequeNo",
      "chequeBank",
      "chequeDate",
      "description",
      "paidAt"
    )
    VALUES (
      ${purchaseId},
      ${amount},
      ${dto.paymentMethod ?? "CASH"}::"PaymentMethod",
      ${dto.chequeNo ?? null},
      ${dto.chequeBank ?? null},
      ${dto.chequeDate ? new Date(dto.chequeDate) : null},
      ${`Initial payment — ${invoiceRef}`},
      CURRENT_TIMESTAMP
    )
  `;
}
async function createPurchase(customerId, dto) {
    const customer = await prisma_client_1.prisma.posCustomer.findUnique({
        where: { id: customerId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nic: true,
            mobileNumber: true,
            address: true,
        },
    });
    if (!customer)
        throw errors_1.AppError.notFound("User not found");
    const purchaseChannel = dto.purchaseChannel ?? "PERSONAL";
    const requestedPaymentType = dto.paymentType ?? "DIRECT";
    const inferredDownPayment = dto.downPaymentAmount != null &&
        Number.isFinite(dto.downPaymentAmount) &&
        dto.downPaymentAmount > 0 &&
        dto.downPaymentAmount < dto.finalSellingPrice;
    const paymentType = requestedPaymentType === "DOWNPAYMENT" || inferredDownPayment
        ? "DOWNPAYMENT"
        : "DIRECT";
    const purchaseMode = dto.purchaseMode ?? "SINGLE";
    const invoiceGroupCode = dto.invoiceGroupCode?.trim() || undefined;
    const hasRegistrationFee = dto.hasRegistrationFee === true;
    const registrationFeeAmount = hasRegistrationFee
        ? roundCurrency(dto.registrationFeeAmount ?? 0)
        : 0;
    if (hasRegistrationFee && registrationFeeAmount <= 0) {
        throw errors_1.AppError.validation({
            registrationFeeAmount: ["Registration fee amount must be greater than 0"],
        });
    }
    const extraCosts = normalizeExtraCosts(dto.extraCosts);
    const leasingCompanyId = purchaseChannel === "LEASING" ? dto.leasingCompanyId : undefined;
    const leasingDownPaymentAmount = purchaseChannel === "LEASING"
        ? roundCurrency(dto.leasingDownPaymentAmount ?? 0)
        : 0;
    if (purchaseChannel === "LEASING") {
        if (dto.purchaseType !== "BIKE" && dto.purchaseType !== "PRE_ORDER") {
            throw errors_1.AppError.validation({
                purchaseType: ["Leasing is supported only for bike and pre-order purchases"],
            });
        }
        if (!leasingCompanyId) {
            throw errors_1.AppError.validation({
                leasingCompanyId: ["Leasing company is required"],
            });
        }
        if (!Number.isFinite(leasingDownPaymentAmount) ||
            leasingDownPaymentAmount < 0 ||
            (dto.purchaseType === "BIKE" && leasingDownPaymentAmount <= 0)) {
            throw errors_1.AppError.validation({
                leasingDownPaymentAmount: [
                    dto.purchaseType === "BIKE"
                        ? "Leasing advance payment must be greater than 0"
                        : "Leasing downpayment amount must be a valid value",
                ],
            });
        }
        if (leasingDownPaymentAmount >= dto.finalSellingPrice) {
            throw errors_1.AppError.validation({
                leasingDownPaymentAmount: [
                    "Leasing downpayment must be less than final selling price",
                ],
            });
        }
        const leasingCompanyExists = await getLeasingCompanyModelClient(prisma_client_1.prisma).findUnique({
            where: { id: leasingCompanyId },
            select: { id: true },
        });
        if (!leasingCompanyExists) {
            throw errors_1.AppError.validation({
                leasingCompanyId: ["Selected leasing company does not exist"],
            });
        }
    }
    if (dto.purchaseType === "BIKE" &&
        purchaseChannel === "PERSONAL" &&
        paymentType === "DOWNPAYMENT" &&
        (dto.downPaymentAmount ?? 0) >= dto.finalSellingPrice) {
        throw errors_1.AppError.validation({
            downPaymentAmount: [
                "Advance payment must be less than the final selling price",
            ],
        });
    }
    const interestRate = paymentType === "DOWNPAYMENT" &&
        dto.interestRate != null &&
        dto.interestRate > 0
        ? dto.interestRate
        : undefined;
    const installmentMonths = paymentType === "DOWNPAYMENT" &&
        dto.installmentMonths != null &&
        dto.installmentMonths >= 1
        ? dto.installmentMonths
        : undefined;
    const totalWithInterest = interestRate != null && installmentMonths != null
        ? roundCurrency(dto.finalSellingPrice * (1 + interestRate / 100))
        : undefined;
    const monthlyInstallmentAmount = totalWithInterest != null && installmentMonths != null
        ? roundCurrency(totalWithInterest / installmentMonths)
        : undefined;
    const effectiveTotal = totalWithInterest ?? dto.finalSellingPrice;
    const paymentDetails = purchaseChannel === "LEASING"
        ? {
            downPaymentAmount: leasingDownPaymentAmount,
            remainingAmount: roundCurrency(effectiveTotal - leasingDownPaymentAmount),
            settlementStatus: roundCurrency(effectiveTotal - leasingDownPaymentAmount) > 0
                ? "TO_SETTLE"
                : "SETTLED",
        }
        : resolvePaymentDetails(effectiveTotal, paymentType, dto.downPaymentAmount);
    const leasingFinancedAmount = purchaseChannel === "LEASING"
        ? dto.purchaseType === "BIKE"
            ? 0
            : roundCurrency(effectiveTotal - leasingDownPaymentAmount)
        : 0;
    if (dto.purchaseType === "BIKE") {
        const bikeId = dto.bikeVehicleId;
        if (!bikeId)
            throw errors_1.AppError.validation({ bikeVehicleId: ["Bike is required"] });
        const bike = await prisma_client_1.prisma.bikeVehicle.findUnique({
            where: { id: bikeId },
            select: {
                id: true,
                status: true,
                sellingPrice: true,
                displayId: true,
                colour: true,
                year: true,
                engineCapacityCc: true,
                mileage: true,
                condition: true,
                registrationType: true,
                fileNo: true,
                registerNo: true,
                chassisNo: true,
                engineNo: true,
                description: true,
                brand: { select: { name: true } },
                model: { select: { name: true } },
            },
        });
        if (!bike)
            throw errors_1.AppError.notFound("Selected bike not found");
        if (bike.status !== "available")
            throw errors_1.AppError.validation({
                bikeVehicleId: ["Selected bike is not available"],
            });
        const result = await prisma_client_1.prisma.$transaction(async (tx) => {
            const purchase = await getPurchaseModelClient(tx).create({
                data: {
                    customerId,
                    itemType: "BIKE",
                    purchaseMode,
                    invoiceGroupCode,
                    bikeVehicleId: bikeId,
                    quantity: 1,
                    currentSellingPrice: bike.sellingPrice,
                    finalSellingPrice: dto.finalSellingPrice,
                    paymentType: purchaseChannel === "LEASING"
                        ? paymentDetails.remainingAmount > 0
                            ? "DOWNPAYMENT"
                            : "DIRECT"
                        : paymentType,
                    downPaymentAmount: paymentDetails.downPaymentAmount,
                    remainingAmount: paymentDetails.remainingAmount,
                    settlementStatus: paymentDetails.settlementStatus,
                    purchaseChannel,
                    leasingCompanyId,
                    leasingDownPaymentAmount,
                    leasingFinancedAmount,
                    hasRegistrationFee,
                    registrationFeeAmount,
                    extraCosts,
                    interestRate,
                    installmentMonths,
                    monthlyInstallmentAmount,
                    totalWithInterest,
                },
            });
            if (installmentMonths != null && monthlyInstallmentAmount != null) {
                const baseDate = new Date(purchase.purchasedAt);
                const installmentData = Array.from({ length: installmentMonths }, (_, i) => {
                    const dueDate = new Date(baseDate);
                    dueDate.setMonth(dueDate.getMonth() + i + 1);
                    const isLast = i === installmentMonths - 1;
                    const dueAmount = isLast
                        ? roundCurrency((totalWithInterest ?? dto.finalSellingPrice) -
                            monthlyInstallmentAmount * (installmentMonths - 1))
                        : monthlyInstallmentAmount;
                    return {
                        purchaseId: purchase.id,
                        installmentNo: i + 1,
                        dueDate,
                        dueAmount,
                    };
                });
                await tx.posInstallment.createMany({ data: installmentData });
                const initialDownPayment = roundCurrency(purchase.downPaymentAmount ?? 0);
                if (initialDownPayment > 0) {
                    const createdInstallments = await tx.posInstallment.findMany({
                        where: { purchaseId: purchase.id },
                        orderBy: { installmentNo: "asc" },
                    });
                    let remainingDP = initialDownPayment;
                    for (const inst of createdInstallments) {
                        if (remainingDP <= 0)
                            break;
                        const pay = roundCurrency(Math.min(remainingDP, inst.dueAmount));
                        remainingDP = roundCurrency(remainingDP - pay);
                        if (pay >= inst.dueAmount) {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: {
                                    paidAmount: pay,
                                    status: "PAID",
                                    isPartial: false,
                                    settledAt: purchase.purchasedAt,
                                },
                            });
                            await tx.posInstallmentPayment.create({
                                data: {
                                    installmentId: inst.id,
                                    amount: pay,
                                    penaltyAmount: 0,
                                    note: "Initial advance payment",
                                    paidAt: purchase.purchasedAt,
                                },
                            });
                        }
                        else {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: { paidAmount: pay, status: "PARTIAL", isPartial: true },
                            });
                            await tx.posInstallmentPayment.create({
                                data: {
                                    installmentId: inst.id,
                                    amount: pay,
                                    penaltyAmount: 0,
                                    note: "Initial advance payment",
                                    paidAt: purchase.purchasedAt,
                                },
                            });
                        }
                    }
                }
            }
            await tx.bikeVehicle.update({
                where: { id: bikeId },
                data: {
                    status: "sold",
                    soldAt: new Date(),
                    sellingPrice: dto.finalSellingPrice,
                },
            });
            return purchase;
        });
        await createInvoicePaymentRecord(result.id, dto, result.invoiceGroupCode);
        return {
            id: result.id,
            itemType: "BIKE",
            customerId,
            quantity: 1,
            purchaseMode: result.purchaseMode,
            invoiceGroupCode: result.invoiceGroupCode,
            bikeVehicleId: bikeId,
            customer: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                nic: customer.nic,
                mobileNumber: customer.mobileNumber,
                address: customer.address,
            },
            bikeDisplayId: bike.displayId,
            bikeName: `${bike.brand.name} ${bike.model.name}`,
            bikeDetails: {
                brand: bike.brand.name,
                model: bike.model.name,
                colour: bike.colour,
                year: bike.year,
                engineCapacityCc: bike.engineCapacityCc,
                mileage: bike.mileage,
                condition: bike.condition,
                registrationType: bike.registrationType,
                fileNo: bike.fileNo,
                registerNo: bike.registerNo,
                chassisNo: bike.chassisNo,
                engineNo: bike.engineNo,
                description: bike.description,
            },
            currentSellingPrice: bike.sellingPrice,
            finalSellingPrice: dto.finalSellingPrice,
            paymentType: result.paymentType,
            downPaymentAmount: result.downPaymentAmount,
            remainingAmount: result.remainingAmount,
            settlementStatus: result.settlementStatus,
            purchaseChannel: result.purchaseChannel,
            leasingCompanyId: result.leasingCompanyId,
            leasingDownPaymentAmount: result.leasingDownPaymentAmount,
            leasingFinancedAmount: result.leasingFinancedAmount,
            hasRegistrationFee: result.hasRegistrationFee,
            registrationFeeAmount: result.registrationFeeAmount,
            extraCosts: result.extraCosts,
            interestRate: result.interestRate,
            installmentMonths: result.installmentMonths,
            monthlyInstallmentAmount: result.monthlyInstallmentAmount,
            totalWithInterest: result.totalWithInterest,
            purchasedAt: result.purchasedAt,
        };
    }
    if (dto.purchaseType === "INVENTORY") {
        const productId = dto.inventoryProductId;
        if (!productId)
            throw errors_1.AppError.validation({
                inventoryProductId: ["Inventory product is required"],
            });
        const product = await prisma_client_1.prisma.inventoryProduct.findUnique({
            where: { id: productId },
            include: {
                brand: { select: { name: true } },
                category: { select: { name: true } },
                supplier: { select: { name: true, code: true } },
            },
        });
        if (!product)
            throw errors_1.AppError.notFound("Selected inventory product not found");
        if ((dto.quantity ?? 1) > product.quantity) {
            throw errors_1.AppError.validation({
                quantity: [`Only ${product.quantity} item(s) available`],
            });
        }
        if (purchaseChannel === "LEASING") {
            throw errors_1.AppError.validation({
                purchaseType: ["Leasing is not available for inventory purchases"],
            });
        }
        const result = await prisma_client_1.prisma.$transaction(async (tx) => {
            const purchase = await getPurchaseModelClient(tx).create({
                data: {
                    customerId,
                    itemType: "INVENTORY",
                    purchaseMode,
                    invoiceGroupCode,
                    inventoryProductId: productId,
                    quantity: dto.quantity ?? 1,
                    currentSellingPrice: product.sellingPrice,
                    finalSellingPrice: dto.finalSellingPrice,
                    paymentType,
                    downPaymentAmount: paymentDetails.downPaymentAmount,
                    remainingAmount: paymentDetails.remainingAmount,
                    settlementStatus: paymentDetails.settlementStatus,
                    purchaseChannel: "PERSONAL",
                    leasingCompanyId: null,
                    leasingDownPaymentAmount: 0,
                    leasingFinancedAmount: 0,
                    hasRegistrationFee,
                    registrationFeeAmount,
                    extraCosts,
                    interestRate,
                    installmentMonths,
                    monthlyInstallmentAmount,
                    totalWithInterest,
                },
            });
            if (installmentMonths != null && monthlyInstallmentAmount != null) {
                const baseDate = new Date(purchase.purchasedAt);
                const installmentData = Array.from({ length: installmentMonths }, (_, i) => {
                    const dueDate = new Date(baseDate);
                    dueDate.setMonth(dueDate.getMonth() + i + 1);
                    const isLast = i === installmentMonths - 1;
                    const dueAmount = isLast
                        ? roundCurrency((totalWithInterest ?? dto.finalSellingPrice) -
                            monthlyInstallmentAmount * (installmentMonths - 1))
                        : monthlyInstallmentAmount;
                    return {
                        purchaseId: purchase.id,
                        installmentNo: i + 1,
                        dueDate,
                        dueAmount,
                    };
                });
                await tx.posInstallment.createMany({ data: installmentData });
                const initialDownPayment = roundCurrency(purchase.downPaymentAmount ?? 0);
                if (initialDownPayment > 0) {
                    const createdInstallments = await tx.posInstallment.findMany({
                        where: { purchaseId: purchase.id },
                        orderBy: { installmentNo: "asc" },
                    });
                    let remainingDP = initialDownPayment;
                    for (const inst of createdInstallments) {
                        if (remainingDP <= 0)
                            break;
                        const pay = roundCurrency(Math.min(remainingDP, inst.dueAmount));
                        remainingDP = roundCurrency(remainingDP - pay);
                        if (pay >= inst.dueAmount) {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: {
                                    paidAmount: pay,
                                    status: "PAID",
                                    isPartial: false,
                                    settledAt: purchase.purchasedAt,
                                },
                            });
                            await tx.posInstallmentPayment.create({
                                data: {
                                    installmentId: inst.id,
                                    amount: pay,
                                    penaltyAmount: 0,
                                    note: "Initial advance payment",
                                    paidAt: purchase.purchasedAt,
                                },
                            });
                        }
                        else {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: { paidAmount: pay, status: "PARTIAL", isPartial: true },
                            });
                            await tx.posInstallmentPayment.create({
                                data: {
                                    installmentId: inst.id,
                                    amount: pay,
                                    penaltyAmount: 0,
                                    note: "Initial advance payment",
                                    paidAt: purchase.purchasedAt,
                                },
                            });
                        }
                    }
                }
            }
            await tx.inventoryProduct.update({
                where: { id: productId },
                data: {
                    quantity: { decrement: dto.quantity ?? 1 },
                    soldQuantity: { increment: dto.quantity ?? 1 },
                    lastSoldAt: new Date(),
                    sellingPrice: dto.finalSellingPrice,
                },
            });
            return purchase;
        });
        await createInvoicePaymentRecord(result.id, dto, result.invoiceGroupCode);
        return {
            id: result.id,
            itemType: "INVENTORY",
            customerId,
            quantity: dto.quantity ?? 1,
            purchaseMode: result.purchaseMode,
            invoiceGroupCode: result.invoiceGroupCode,
            inventoryProductId: productId,
            customer: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                nic: customer.nic,
                mobileNumber: customer.mobileNumber,
                address: customer.address,
            },
            productDisplayId: product.displayId,
            productName: product.name,
            productDetails: {
                brand: product.brand.name,
                category: product.category.name,
                supplier: product.supplier
                    ? `${product.supplier.name} (${product.supplier.code})`
                    : null,
                inStockBeforePurchase: product.quantity,
                description: product.description,
            },
            currentSellingPrice: product.sellingPrice,
            finalSellingPrice: dto.finalSellingPrice,
            paymentType: result.paymentType,
            downPaymentAmount: result.downPaymentAmount,
            remainingAmount: result.remainingAmount,
            settlementStatus: result.settlementStatus,
            purchaseChannel: result.purchaseChannel,
            leasingCompanyId: result.leasingCompanyId,
            leasingDownPaymentAmount: result.leasingDownPaymentAmount,
            leasingFinancedAmount: result.leasingFinancedAmount,
            hasRegistrationFee: result.hasRegistrationFee,
            registrationFeeAmount: result.registrationFeeAmount,
            extraCosts: result.extraCosts,
            interestRate: result.interestRate,
            installmentMonths: result.installmentMonths,
            monthlyInstallmentAmount: result.monthlyInstallmentAmount,
            totalWithInterest: result.totalWithInterest,
            purchasedAt: result.purchasedAt,
        };
    }
    if (dto.purchaseType === "PRE_ORDER") {
        const preOrderId = dto.preOrderId;
        const preOrder = await prisma_client_1.prisma.preOrder.findUnique({
            where: { id: preOrderId },
            select: { id: true, displayId: true, brand: true, model: true, colour: true, price: true },
        });
        if (!preOrder)
            throw errors_1.AppError.notFound("Selected pre-order not found");
        const result = await prisma_client_1.prisma.$transaction(async (tx) => {
            const purchase = await getPurchaseModelClient(tx).create({
                data: {
                    customerId,
                    itemType: "PRE_ORDER",
                    purchaseMode: "SINGLE",
                    invoiceGroupCode,
                    preOrderId,
                    quantity: 1,
                    currentSellingPrice: preOrder.price,
                    finalSellingPrice: dto.finalSellingPrice,
                    paymentType: purchaseChannel === "LEASING"
                        ? paymentDetails.remainingAmount > 0
                            ? "DOWNPAYMENT"
                            : "DIRECT"
                        : paymentType,
                    downPaymentAmount: paymentDetails.downPaymentAmount,
                    remainingAmount: paymentDetails.remainingAmount,
                    settlementStatus: paymentDetails.settlementStatus,
                    purchaseChannel,
                    leasingCompanyId,
                    leasingDownPaymentAmount,
                    leasingFinancedAmount,
                    hasRegistrationFee: false,
                    registrationFeeAmount: 0,
                    extraCosts,
                    interestRate,
                    installmentMonths,
                    monthlyInstallmentAmount,
                    totalWithInterest,
                },
            });
            if (installmentMonths != null && monthlyInstallmentAmount != null) {
                const baseDate = new Date(purchase.purchasedAt);
                const installmentData = Array.from({ length: installmentMonths }, (_, i) => {
                    const dueDate = new Date(baseDate);
                    dueDate.setMonth(dueDate.getMonth() + i + 1);
                    const isLast = i === installmentMonths - 1;
                    const dueAmount = isLast
                        ? roundCurrency((totalWithInterest ?? dto.finalSellingPrice) -
                            monthlyInstallmentAmount * (installmentMonths - 1))
                        : monthlyInstallmentAmount;
                    return { purchaseId: purchase.id, installmentNo: i + 1, dueDate, dueAmount };
                });
                await tx.posInstallment.createMany({ data: installmentData });
                const initialDownPayment = roundCurrency(purchase.downPaymentAmount ?? 0);
                if (initialDownPayment > 0) {
                    const createdInstallments = await tx.posInstallment.findMany({
                        where: { purchaseId: purchase.id },
                        orderBy: { installmentNo: "asc" },
                    });
                    let remainingDP = initialDownPayment;
                    for (const inst of createdInstallments) {
                        if (remainingDP <= 0)
                            break;
                        const pay = roundCurrency(Math.min(remainingDP, inst.dueAmount));
                        remainingDP = roundCurrency(remainingDP - pay);
                        if (pay >= inst.dueAmount) {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: { paidAmount: pay, status: "PAID", isPartial: false, settledAt: purchase.purchasedAt },
                            });
                            await tx.posInstallmentPayment.create({
                                data: { installmentId: inst.id, amount: pay, penaltyAmount: 0, note: "Initial advance payment", paidAt: purchase.purchasedAt },
                            });
                        }
                        else {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: { paidAmount: pay, status: "PARTIAL", isPartial: true },
                            });
                            await tx.posInstallmentPayment.create({
                                data: { installmentId: inst.id, amount: pay, penaltyAmount: 0, note: "Initial advance payment", paidAt: purchase.purchasedAt },
                            });
                        }
                    }
                }
            }
            return purchase;
        });
        await createInvoicePaymentRecord(result.id, dto, result.invoiceGroupCode);
        return {
            id: result.id,
            itemType: "PRE_ORDER",
            customerId,
            quantity: 1,
            purchaseMode: result.purchaseMode,
            invoiceGroupCode: result.invoiceGroupCode,
            preOrderId,
            customer: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                nic: customer.nic,
                mobileNumber: customer.mobileNumber,
                address: customer.address,
            },
            preOrderDisplayId: preOrder.displayId,
            preOrderName: `${preOrder.brand} ${preOrder.model}`,
            finalSellingPrice: dto.finalSellingPrice,
            paymentType: result.paymentType,
            downPaymentAmount: result.downPaymentAmount,
            remainingAmount: result.remainingAmount,
            settlementStatus: result.settlementStatus,
            purchaseChannel: result.purchaseChannel,
            leasingCompanyId: result.leasingCompanyId,
            leasingDownPaymentAmount: result.leasingDownPaymentAmount,
            leasingFinancedAmount: result.leasingFinancedAmount,
            interestRate: result.interestRate,
            installmentMonths: result.installmentMonths,
            monthlyInstallmentAmount: result.monthlyInstallmentAmount,
            totalWithInterest: result.totalWithInterest,
            extraCosts: result.extraCosts,
            purchasedAt: result.purchasedAt,
        };
    }
    if (dto.purchaseType === "CUSTOM") {
        const customCategory = dto.customCategory?.trim() || "Miscellaneous";
        const customDescription = dto.customDescription.trim();
        if (purchaseChannel === "LEASING") {
            throw errors_1.AppError.validation({ purchaseChannel: ["Leasing is not available for custom invoices"] });
        }
        const result = await prisma_client_1.prisma.$transaction(async (tx) => {
            const purchase = await getPurchaseModelClient(tx).create({
                data: {
                    customerId,
                    itemType: "CUSTOM",
                    purchaseMode: "SINGLE",
                    invoiceGroupCode,
                    customCategory,
                    customDescription,
                    quantity: 1,
                    currentSellingPrice: null,
                    finalSellingPrice: dto.finalSellingPrice,
                    paymentType,
                    downPaymentAmount: paymentDetails.downPaymentAmount,
                    remainingAmount: paymentDetails.remainingAmount,
                    settlementStatus: paymentDetails.settlementStatus,
                    purchaseChannel: "PERSONAL",
                    leasingCompanyId: null,
                    leasingDownPaymentAmount: 0,
                    leasingFinancedAmount: 0,
                    hasRegistrationFee: false,
                    registrationFeeAmount: 0,
                    extraCosts,
                    interestRate,
                    installmentMonths,
                    monthlyInstallmentAmount,
                    totalWithInterest,
                },
            });
            if (installmentMonths != null && monthlyInstallmentAmount != null) {
                const baseDate = new Date(purchase.purchasedAt);
                const installmentData = Array.from({ length: installmentMonths }, (_, i) => {
                    const dueDate = new Date(baseDate);
                    dueDate.setMonth(dueDate.getMonth() + i + 1);
                    const isLast = i === installmentMonths - 1;
                    const dueAmount = isLast
                        ? roundCurrency((totalWithInterest ?? dto.finalSellingPrice) -
                            monthlyInstallmentAmount * (installmentMonths - 1))
                        : monthlyInstallmentAmount;
                    return { purchaseId: purchase.id, installmentNo: i + 1, dueDate, dueAmount };
                });
                await tx.posInstallment.createMany({ data: installmentData });
                const initialDownPayment = roundCurrency(purchase.downPaymentAmount ?? 0);
                if (initialDownPayment > 0) {
                    const createdInstallments = await tx.posInstallment.findMany({
                        where: { purchaseId: purchase.id },
                        orderBy: { installmentNo: "asc" },
                    });
                    let remainingDP = initialDownPayment;
                    for (const inst of createdInstallments) {
                        if (remainingDP <= 0)
                            break;
                        const pay = roundCurrency(Math.min(remainingDP, inst.dueAmount));
                        remainingDP = roundCurrency(remainingDP - pay);
                        if (pay >= inst.dueAmount) {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: { paidAmount: pay, status: "PAID", isPartial: false, settledAt: purchase.purchasedAt },
                            });
                            await tx.posInstallmentPayment.create({
                                data: { installmentId: inst.id, amount: pay, penaltyAmount: 0, note: "Initial advance payment", paidAt: purchase.purchasedAt },
                            });
                        }
                        else {
                            await tx.posInstallment.update({
                                where: { id: inst.id },
                                data: { paidAmount: pay, status: "PARTIAL", isPartial: true },
                            });
                            await tx.posInstallmentPayment.create({
                                data: { installmentId: inst.id, amount: pay, penaltyAmount: 0, note: "Initial advance payment", paidAt: purchase.purchasedAt },
                            });
                        }
                    }
                }
            }
            return purchase;
        });
        await createInvoicePaymentRecord(result.id, dto, result.invoiceGroupCode);
        return {
            id: result.id,
            itemType: "CUSTOM",
            customerId,
            customCategory,
            customDescription,
            customer: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                nic: customer.nic,
                mobileNumber: customer.mobileNumber,
                address: customer.address,
            },
            finalSellingPrice: dto.finalSellingPrice,
            paymentType: result.paymentType,
            downPaymentAmount: result.downPaymentAmount,
            remainingAmount: result.remainingAmount,
            settlementStatus: result.settlementStatus,
            interestRate: result.interestRate,
            installmentMonths: result.installmentMonths,
            monthlyInstallmentAmount: result.monthlyInstallmentAmount,
            totalWithInterest: result.totalWithInterest,
            extraCosts: result.extraCosts,
            purchasedAt: result.purchasedAt,
        };
    }
    throw errors_1.AppError.validation({ purchaseType: ["Unsupported purchase type"] });
}
async function listPurchases(query) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const where = search
        ? {
            OR: [
                {
                    customer: { firstName: { contains: search, mode: "insensitive" } },
                },
                { customer: { lastName: { contains: search, mode: "insensitive" } } },
                { customer: { nic: { contains: search, mode: "insensitive" } } },
                { customer: { mobileNumber: { contains: search, mode: "insensitive" } } },
                {
                    bikeVehicle: {
                        displayId: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    bikeVehicle: {
                        brand: { name: { contains: search, mode: "insensitive" } },
                    },
                },
                {
                    bikeVehicle: {
                        model: { name: { contains: search, mode: "insensitive" } },
                    },
                },
                {
                    leasingCompany: { name: { contains: search, mode: "insensitive" } },
                },
                {
                    inventoryProduct: {
                        displayId: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    inventoryProduct: {
                        name: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    inventoryProduct: {
                        brand: { name: { contains: search, mode: "insensitive" } },
                    },
                },
                { customCategory: { contains: search, mode: "insensitive" } },
                { customDescription: { contains: search, mode: "insensitive" } },
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
                province: true,
                district: true,
            },
        },
        bikeVehicle: {
            select: {
                id: true,
                displayId: true,
                colour: true,
                year: true,
                engineCapacityCc: true,
                mileage: true,
                condition: true,
                registrationType: true,
                fileNo: true,
                registerNo: true,
                chassisNo: true,
                engineNo: true,
                description: true,
                brand: { select: { name: true } },
                model: { select: { name: true } },
            },
        },
        inventoryProduct: {
            select: {
                id: true,
                displayId: true,
                name: true,
                quantity: true,
                soldQuantity: true,
                description: true,
                brand: { select: { name: true } },
                category: { select: { name: true } },
                supplier: { select: { name: true, code: true } },
            },
        },
        leasingCompany: {
            select: {
                id: true,
                name: true,
            },
        },
    };
    if ((0, prisma_model_1.prismaModelHasObjectField)(prisma_client_1.prisma, "PosCustomerPurchase", "preOrder")) {
        purchaseInclude.preOrder = {
            select: {
                id: true,
                displayId: true,
                brand: true,
                model: true,
                colour: true,
            },
        };
    }
    const [rows, total] = await Promise.all([
        getPurchaseModelClient(prisma_client_1.prisma).findMany({
            where,
            skip,
            take: limit,
            orderBy: { purchasedAt: "desc" },
            include: purchaseInclude,
        }),
        getPurchaseModelClient(prisma_client_1.prisma).count({ where }),
    ]);
    return {
        purchases: rows.map((row) => ({
            id: row.id,
            purchasedAt: row.purchasedAt,
            itemType: row.itemType,
            purchaseMode: row.purchaseMode,
            invoiceGroupCode: row.invoiceGroupCode,
            quantity: row.quantity,
            currentSellingPrice: row.currentSellingPrice,
            finalSellingPrice: row.finalSellingPrice,
            paymentType: row.paymentType,
            downPaymentAmount: row.downPaymentAmount,
            remainingAmount: row.remainingAmount,
            settlementStatus: row.settlementStatus,
            purchaseChannel: row.purchaseChannel,
            leasingCompany: row.leasingCompany
                ? {
                    id: row.leasingCompany.id,
                    name: row.leasingCompany.name,
                }
                : null,
            leasingDownPaymentAmount: row.leasingDownPaymentAmount,
            leasingFinancedAmount: row.leasingFinancedAmount,
            hasRegistrationFee: row.hasRegistrationFee,
            registrationFeeAmount: row.registrationFeeAmount,
            extraCosts: Array.isArray(row.extraCosts) ? row.extraCosts : [],
            interestRate: row.interestRate,
            installmentMonths: row.installmentMonths,
            monthlyInstallmentAmount: row.monthlyInstallmentAmount,
            totalWithInterest: row.totalWithInterest,
            customer: row.customer,
            bike: row.bikeVehicle
                ? {
                    id: row.bikeVehicle.id,
                    displayId: row.bikeVehicle.displayId,
                    brand: row.bikeVehicle.brand.name,
                    model: row.bikeVehicle.model.name,
                    colour: row.bikeVehicle.colour,
                    year: row.bikeVehicle.year,
                    engineCapacityCc: row.bikeVehicle.engineCapacityCc,
                    mileage: row.bikeVehicle.mileage,
                    condition: row.bikeVehicle.condition,
                    registrationType: row.bikeVehicle.registrationType,
                    fileNo: row.bikeVehicle.fileNo,
                    registerNo: row.bikeVehicle.registerNo,
                    chassisNo: row.bikeVehicle.chassisNo,
                    engineNo: row.bikeVehicle.engineNo,
                    description: row.bikeVehicle.description,
                }
                : null,
            inventory: row.inventoryProduct
                ? {
                    id: row.inventoryProduct.id,
                    displayId: row.inventoryProduct.displayId,
                    name: row.inventoryProduct.name,
                    brand: row.inventoryProduct.brand.name,
                    category: row.inventoryProduct.category.name,
                    supplier: row.inventoryProduct.supplier
                        ? `${row.inventoryProduct.supplier.name} (${row.inventoryProduct.supplier.code})`
                        : null,
                    description: row.inventoryProduct.description,
                }
                : null,
            preOrder: row.preOrder
                ? {
                    id: row.preOrder.id,
                    displayId: row.preOrder.displayId,
                    brand: row.preOrder.brand,
                    model: row.preOrder.model,
                    colour: row.preOrder.colour,
                }
                : null,
            customCategory: row.customCategory ?? null,
            customDescription: row.customDescription ?? null,
        })),
        total,
        page,
        limit,
    };
}
async function listPurchasesByUser(customerId, query) {
    const customer = await prisma_client_1.prisma.posCustomer.findUnique({
        where: { id: customerId },
        select: { id: true },
    });
    if (!customer)
        throw errors_1.AppError.notFound("User not found");
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const where = {
        customerId,
        ...(search
            ? {
                OR: [
                    {
                        bikeVehicle: {
                            displayId: { contains: search, mode: "insensitive" },
                        },
                    },
                    {
                        bikeVehicle: {
                            brand: { name: { contains: search, mode: "insensitive" } },
                        },
                    },
                    {
                        bikeVehicle: {
                            model: { name: { contains: search, mode: "insensitive" } },
                        },
                    },
                    {
                        inventoryProduct: {
                            displayId: { contains: search, mode: "insensitive" },
                        },
                    },
                    {
                        inventoryProduct: {
                            name: { contains: search, mode: "insensitive" },
                        },
                    },
                    {
                        inventoryProduct: {
                            brand: { name: { contains: search, mode: "insensitive" } },
                        },
                    },
                    {
                        inventoryProduct: {
                            category: { name: { contains: search, mode: "insensitive" } },
                        },
                    },
                    {
                        leasingCompany: {
                            name: { contains: search, mode: "insensitive" },
                        },
                    },
                ],
            }
            : {}),
    };
    const [rows, total] = await Promise.all([
        (() => {
            const purchaseInclude = {
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        nic: true,
                        mobileNumber: true,
                        address: true,
                        province: true,
                        district: true,
                    },
                },
                bikeVehicle: {
                    select: {
                        id: true,
                        displayId: true,
                        colour: true,
                        year: true,
                        engineCapacityCc: true,
                        mileage: true,
                        condition: true,
                        registrationType: true,
                        fileNo: true,
                        registerNo: true,
                        chassisNo: true,
                        engineNo: true,
                        description: true,
                        brand: { select: { name: true } },
                        model: { select: { name: true } },
                    },
                },
                inventoryProduct: {
                    select: {
                        id: true,
                        displayId: true,
                        name: true,
                        quantity: true,
                        soldQuantity: true,
                        description: true,
                        brand: { select: { name: true } },
                        category: { select: { name: true } },
                        supplier: { select: { name: true, code: true } },
                    },
                },
                leasingCompany: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            };
            if ((0, prisma_model_1.prismaModelHasObjectField)(prisma_client_1.prisma, "PosCustomerPurchase", "preOrder")) {
                purchaseInclude.preOrder = {
                    select: {
                        id: true,
                        displayId: true,
                        brand: true,
                        model: true,
                        colour: true,
                    },
                };
            }
            return getPurchaseModelClient(prisma_client_1.prisma).findMany({
                where,
                skip,
                take: limit,
                orderBy: { purchasedAt: "desc" },
                include: purchaseInclude,
            });
        })(),
        getPurchaseModelClient(prisma_client_1.prisma).count({ where }),
    ]);
    return {
        purchases: rows.map((row) => ({
            id: row.id,
            purchasedAt: row.purchasedAt,
            itemType: row.itemType,
            purchaseMode: row.purchaseMode,
            invoiceGroupCode: row.invoiceGroupCode,
            quantity: row.quantity,
            currentSellingPrice: row.currentSellingPrice,
            finalSellingPrice: row.finalSellingPrice,
            paymentType: row.paymentType,
            downPaymentAmount: row.downPaymentAmount,
            remainingAmount: row.remainingAmount,
            settlementStatus: row.settlementStatus,
            purchaseChannel: row.purchaseChannel,
            leasingCompany: row.leasingCompany
                ? {
                    id: row.leasingCompany.id,
                    name: row.leasingCompany.name,
                }
                : null,
            leasingDownPaymentAmount: row.leasingDownPaymentAmount,
            leasingFinancedAmount: row.leasingFinancedAmount,
            hasRegistrationFee: row.hasRegistrationFee,
            registrationFeeAmount: row.registrationFeeAmount,
            extraCosts: Array.isArray(row.extraCosts) ? row.extraCosts : [],
            interestRate: row.interestRate,
            installmentMonths: row.installmentMonths,
            monthlyInstallmentAmount: row.monthlyInstallmentAmount,
            totalWithInterest: row.totalWithInterest,
            customer: row.customer,
            bike: row.bikeVehicle
                ? {
                    id: row.bikeVehicle.id,
                    displayId: row.bikeVehicle.displayId,
                    brand: row.bikeVehicle.brand.name,
                    model: row.bikeVehicle.model.name,
                    colour: row.bikeVehicle.colour,
                    year: row.bikeVehicle.year,
                    engineCapacityCc: row.bikeVehicle.engineCapacityCc,
                    mileage: row.bikeVehicle.mileage,
                    condition: row.bikeVehicle.condition,
                    registrationType: row.bikeVehicle.registrationType,
                    fileNo: row.bikeVehicle.fileNo,
                    registerNo: row.bikeVehicle.registerNo,
                    chassisNo: row.bikeVehicle.chassisNo,
                    engineNo: row.bikeVehicle.engineNo,
                    description: row.bikeVehicle.description,
                }
                : null,
            inventory: row.inventoryProduct
                ? {
                    id: row.inventoryProduct.id,
                    displayId: row.inventoryProduct.displayId,
                    name: row.inventoryProduct.name,
                    brand: row.inventoryProduct.brand.name,
                    category: row.inventoryProduct.category.name,
                    supplier: row.inventoryProduct.supplier
                        ? `${row.inventoryProduct.supplier.name} (${row.inventoryProduct.supplier.code})`
                        : null,
                    description: row.inventoryProduct.description,
                }
                : null,
            preOrder: row.preOrder
                ? {
                    id: row.preOrder.id,
                    displayId: row.preOrder.displayId,
                    brand: row.preOrder.brand,
                    model: row.preOrder.model,
                    colour: row.preOrder.colour,
                }
                : null,
            customCategory: row.customCategory ?? null,
            customDescription: row.customDescription ?? null,
        })),
        total,
        page,
        limit,
    };
}
async function settlePurchase(customerId, purchaseId, dto) {
    const customer = await prisma_client_1.prisma.posCustomer.findUnique({
        where: { id: customerId },
        select: { id: true },
    });
    if (!customer)
        throw errors_1.AppError.notFound("User not found");
    const basePurchase = await getPurchaseModelClient(prisma_client_1.prisma).findFirst({
        where: { id: purchaseId, customerId },
        select: {
            id: true,
            customerId: true,
            itemType: true,
            invoiceGroupCode: true,
            remainingAmount: true,
            downPaymentAmount: true,
            finalSellingPrice: true,
            paymentType: true,
            settlementStatus: true,
            purchasedAt: true,
        },
    });
    if (!basePurchase)
        throw errors_1.AppError.notFound("Purchase record not found for this user");
    const targets = await getPurchaseModelClient(prisma_client_1.prisma).findMany({
        where: {
            customerId,
            ...(basePurchase.invoiceGroupCode
                ? { invoiceGroupCode: basePurchase.invoiceGroupCode }
                : { id: basePurchase.id }),
        },
        orderBy: [{ purchasedAt: "asc" }, { id: "asc" }],
        select: {
            id: true,
            itemType: true,
            remainingAmount: true,
            downPaymentAmount: true,
            finalSellingPrice: true,
            leasingDownPaymentAmount: true,
        },
    });
    const totalRemainingBefore = roundCurrency(targets.reduce((sum, row) => sum + (row.remainingAmount ?? 0), 0));
    if (totalRemainingBefore <= 0) {
        throw errors_1.AppError.validation({
            amount: ["This invoice is already fully settled"],
        });
    }
    const customerPaymentAmount = roundCurrency(dto.amount);
    const isLeasingSettlement = dto.settlementMethod === "LEASING";
    const isBikeInvoice = targets.every((row) => row.itemType === "BIKE");
    if (!isLeasingSettlement && customerPaymentAmount <= 0) {
        throw errors_1.AppError.validation({
            amount: ["Settlement amount must be greater than 0"],
        });
    }
    if (customerPaymentAmount > totalRemainingBefore) {
        throw errors_1.AppError.validation({
            amount: [
                `Settlement amount cannot exceed remaining amount (Rs. ${totalRemainingBefore.toLocaleString()})`,
            ],
        });
    }
    if (!isLeasingSettlement &&
        isBikeInvoice &&
        customerPaymentAmount !== totalRemainingBefore) {
        throw errors_1.AppError.validation({
            amount: ["The full remaining amount is required for a bike settlement"],
        });
    }
    if (isLeasingSettlement) {
        if (!isBikeInvoice) {
            throw errors_1.AppError.validation({
                settlementMethod: ["Leasing settlement is available only for bike purchases"],
            });
        }
        if (!dto.leasingCompanyId) {
            throw errors_1.AppError.validation({
                leasingCompanyId: ["Leasing company is required"],
            });
        }
        if (dto.leasingSettlementType === "DOWNPAYMENT_AND_LEASE" &&
            (customerPaymentAmount <= 0 || customerPaymentAmount >= totalRemainingBefore)) {
            throw errors_1.AppError.validation({
                amount: ["Additional downpayment must be greater than 0 and less than the remaining amount"],
            });
        }
        const leasingCompany = await getLeasingCompanyModelClient(prisma_client_1.prisma).findUnique({
            where: { id: dto.leasingCompanyId },
            select: { id: true },
        });
        if (!leasingCompany) {
            throw errors_1.AppError.validation({
                leasingCompanyId: ["Selected leasing company does not exist"],
            });
        }
    }
    const settleAmount = isLeasingSettlement
        ? totalRemainingBefore
        : customerPaymentAmount;
    const leasingFinancedAmount = isLeasingSettlement
        ? roundCurrency(totalRemainingBefore - customerPaymentAmount)
        : 0;
    let remainingToApply = settleAmount;
    let customerPaymentToApply = customerPaymentAmount;
    const updates = targets.map((row) => {
        const rowRemaining = roundCurrency(row.remainingAmount ?? 0);
        if (rowRemaining <= 0 || remainingToApply <= 0) {
            return {
                id: row.id,
                appliedAmount: 0,
                newDownPaymentAmount: roundCurrency(row.downPaymentAmount ?? row.finalSellingPrice),
                newRemainingAmount: rowRemaining,
            };
        }
        const appliedAmount = roundCurrency(Math.min(rowRemaining, remainingToApply));
        remainingToApply = roundCurrency(remainingToApply - appliedAmount);
        const newRemainingAmount = roundCurrency(rowRemaining - appliedAmount);
        const customerPaymentApplied = roundCurrency(Math.min(appliedAmount, customerPaymentToApply));
        customerPaymentToApply = roundCurrency(customerPaymentToApply - customerPaymentApplied);
        const leasingApplied = roundCurrency(appliedAmount - customerPaymentApplied);
        const newDownPaymentAmount = roundCurrency((row.downPaymentAmount ?? 0) + customerPaymentApplied);
        return {
            id: row.id,
            appliedAmount,
            customerPaymentApplied,
            leasingApplied,
            newDownPaymentAmount,
            newRemainingAmount,
            newLeasingDownPaymentAmount: roundCurrency((row.leasingDownPaymentAmount ?? 0) + customerPaymentApplied),
        };
    });
    await prisma_client_1.prisma.$transaction(async (tx) => {
        for (const update of updates) {
            if (update.appliedAmount <= 0)
                continue;
            await getPurchaseModelClient(tx).update({
                where: { id: update.id },
                data: {
                    paymentType: "DOWNPAYMENT",
                    downPaymentAmount: update.newDownPaymentAmount,
                    remainingAmount: update.newRemainingAmount,
                    settlementStatus: update.newRemainingAmount > 0 ? "TO_SETTLE" : "SETTLED",
                    ...(isLeasingSettlement
                        ? {
                            purchaseChannel: "LEASING",
                            leasingCompanyId: dto.leasingCompanyId,
                            leasingDownPaymentAmount: update.newLeasingDownPaymentAmount,
                            leasingFinancedAmount: update.leasingApplied,
                        }
                        : isBikeInvoice
                            ? {
                                purchaseChannel: "PERSONAL",
                                leasingCompanyId: null,
                                leasingDownPaymentAmount: 0,
                                leasingFinancedAmount: 0,
                            }
                            : {}),
                },
            });
        }
        if (isLeasingSettlement) {
            await tx.posInstallment.updateMany({
                where: {
                    purchaseId: { in: targets.map((row) => row.id) },
                    status: { in: ["PENDING", "PARTIAL"] },
                },
                data: {
                    status: "PAID",
                    isPartial: false,
                    settledAt: new Date(),
                },
            });
        }
        else if (dto.installmentId) {
            const installment = await tx.posInstallment.findFirst({
                where: { id: dto.installmentId, purchaseId: basePurchase.id },
            });
            if (!installment)
                throw errors_1.AppError.notFound("Installment not found for this purchase");
            if (installment.status === "PAID") {
                throw errors_1.AppError.validation({
                    installmentId: ["This installment has already been fully paid"],
                });
            }
            const prevPenaltyAmount = roundCurrency(installment.penaltyAmount ?? 0);
            const prevPaidAmount = roundCurrency(installment.paidAmount ?? 0);
            const totalPaid = roundCurrency(prevPaidAmount + settleAmount);
            const totalOwedBefore = roundCurrency(installment.dueAmount + prevPenaltyAmount);
            const isFullyPaid = totalPaid >= totalOwedBefore;
            const isPartial = !isFullyPaid;
            const unpaidBalance = roundCurrency(Math.max(0, totalOwedBefore - totalPaid));
            const newPenaltyRate = isPartial
                ? roundCurrency(dto.penaltyRate ?? 0)
                : 0;
            const additionalPenalty = isPartial
                ? roundCurrency((unpaidBalance * newPenaltyRate) / 100)
                : 0;
            const newPenaltyAmount = roundCurrency(prevPenaltyAmount + additionalPenalty);
            const newStatus = isFullyPaid
                ? "PAID"
                : totalPaid > 0
                    ? "PARTIAL"
                    : "PENDING";
            await tx.posInstallment.update({
                where: { id: dto.installmentId },
                data: {
                    paidAmount: totalPaid,
                    isPartial,
                    penaltyRate: newPenaltyRate,
                    penaltyAmount: newPenaltyAmount,
                    status: newStatus,
                    settledAt: new Date(),
                },
            });
            await tx.posInstallmentPayment.create({
                data: {
                    installmentId: dto.installmentId,
                    amount: settleAmount,
                    penaltyAmount: additionalPenalty,
                },
            });
            if (additionalPenalty > 0) {
                await getPurchaseModelClient(tx).update({
                    where: { id: basePurchase.id },
                    data: {
                        remainingAmount: { increment: additionalPenalty },
                        settlementStatus: "TO_SETTLE",
                    },
                });
            }
            const overpayment = roundCurrency(Math.max(0, totalPaid - totalOwedBefore));
            if (overpayment > 0) {
                const pendingNext = await tx.posInstallment.findMany({
                    where: {
                        purchaseId: basePurchase.id,
                        status: { in: ["PENDING", "PARTIAL"] },
                        installmentNo: { gt: installment.installmentNo },
                    },
                    orderBy: { installmentNo: "asc" },
                });
                let excess = overpayment;
                for (const pending of pendingNext) {
                    if (excess <= 0)
                        break;
                    const reduction = roundCurrency(Math.min(pending.dueAmount, excess));
                    excess = roundCurrency(excess - reduction);
                    const newDue = roundCurrency(pending.dueAmount - reduction);
                    await tx.posInstallment.update({
                        where: { id: pending.id },
                        data: newDue <= 0
                            ? {
                                dueAmount: 0,
                                paidAmount: pending.dueAmount,
                                status: "PAID",
                                settledAt: new Date(),
                            }
                            : { dueAmount: newDue },
                    });
                }
            }
        }
        else {
            const pendingInstallments = await tx.posInstallment.findMany({
                where: {
                    purchaseId: basePurchase.id,
                    status: { in: ["PENDING", "PARTIAL"] },
                },
                orderBy: { installmentNo: "asc" },
            });
            let remaining = settleAmount;
            for (const inst of pendingInstallments) {
                if (remaining <= 0)
                    break;
                const alreadyPaid = roundCurrency(inst.paidAmount ?? 0);
                const instPenalty = roundCurrency(inst.penaltyAmount ?? 0);
                const totalOwed = roundCurrency(inst.dueAmount + instPenalty);
                const stillDue = roundCurrency(totalOwed - alreadyPaid);
                if (stillDue <= 0)
                    continue;
                const pay = roundCurrency(Math.min(remaining, stillDue));
                remaining = roundCurrency(remaining - pay);
                const newTotalPaid = roundCurrency(alreadyPaid + pay);
                if (newTotalPaid >= totalOwed) {
                    await tx.posInstallment.update({
                        where: { id: inst.id },
                        data: {
                            paidAmount: newTotalPaid,
                            status: "PAID",
                            isPartial: false,
                            settledAt: new Date(),
                        },
                    });
                }
                else {
                    await tx.posInstallment.update({
                        where: { id: inst.id },
                        data: {
                            paidAmount: newTotalPaid,
                            status: "PARTIAL",
                            isPartial: true,
                            settledAt: new Date(),
                        },
                    });
                }
                await tx.posInstallmentPayment.create({
                    data: { installmentId: inst.id, amount: pay, penaltyAmount: 0 },
                });
            }
        }
    });
    if (customerPaymentAmount > 0) {
        const invoiceRef = basePurchase.invoiceGroupCode
            ? basePurchase.invoiceGroupCode
            : `INV-${String(basePurchase.id).padStart(5, "0")}`;
        await prisma_client_1.prisma.invoicePayment.create({
            data: {
                purchaseId: basePurchase.id,
                amount: customerPaymentAmount,
                paymentMethod: (dto.paymentMethod ?? "CASH"),
                chequeNo: dto.chequeNo,
                chequeBank: dto.chequeBank,
                chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : undefined,
                description: isLeasingSettlement
                    ? `Additional downpayment before leasing — ${invoiceRef}`
                    : `Settlement payment — ${invoiceRef}`,
            },
        });
    }
    const refreshed = await getPurchaseModelClient(prisma_client_1.prisma).findMany({
        where: {
            customerId,
            ...(basePurchase.invoiceGroupCode
                ? { invoiceGroupCode: basePurchase.invoiceGroupCode }
                : { id: basePurchase.id }),
        },
        select: {
            id: true,
            remainingAmount: true,
            downPaymentAmount: true,
            settlementStatus: true,
            paymentType: true,
        },
    });
    const totalRemainingAfter = roundCurrency(refreshed.reduce((sum, row) => sum + (row.remainingAmount ?? 0), 0));
    return {
        customerId,
        invoiceGroupCode: basePurchase.invoiceGroupCode,
        purchaseId: basePurchase.id,
        appliedAmount: settleAmount,
        customerPaymentAmount,
        leasingFinancedAmount,
        totalRemainingBefore,
        totalRemainingAfter,
        settlementStatus: totalRemainingAfter > 0 ? "TO_SETTLE" : "SETTLED",
        updatedEntries: refreshed,
    };
}
async function updatePurchase(purchaseId, dto) {
    const purchase = await getPurchaseModelClient(prisma_client_1.prisma).findUnique({
        where: { id: purchaseId },
    });
    if (!purchase)
        throw errors_1.AppError.notFound("Purchase not found");
    const hasFinancialEdits = dto.finalSellingPrice !== undefined ||
        dto.downPaymentAmount !== undefined ||
        dto.registrationFeeAmount !== undefined;
    if (dto.mobileNumber !== undefined && !hasFinancialEdits) {
        try {
            await prisma_client_1.prisma.posCustomer.update({
                where: { id: purchase.customerId },
                data: { mobileNumber: dto.mobileNumber },
            });
        }
        catch (error) {
            if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                throw mapUniqueConstraint(error);
            }
            throw error;
        }
        return getPurchaseModelClient(prisma_client_1.prisma).findUniqueOrThrow({
            where: { id: purchaseId },
            select: {
                id: true,
                customer: { select: { id: true, mobileNumber: true } },
            },
        });
    }
    const installments = await getInstallmentModelClient(prisma_client_1.prisma).findMany({
        where: { purchaseId },
        select: {
            id: true,
            installmentNo: true,
            dueDate: true,
            dueAmount: true,
            paidAmount: true,
            status: true,
        },
        orderBy: { installmentNo: "asc" },
    });
    const invoicePaymentModel = getInvoicePaymentModelClient(prisma_client_1.prisma);
    const invoicePayments = invoicePaymentModel
        ? await invoicePaymentModel.findMany({
            where: { purchaseId },
            select: { id: true, amount: true, receiptId: true },
            orderBy: { id: "asc" },
        })
        : [];
    if (purchase.purchaseChannel === "LEASING") {
        throw new errors_1.AppError("Leasing purchases cannot be edited via this endpoint", 400);
    }
    if (purchase.purchaseMode === "BULK") {
        throw new errors_1.AppError("Bulk purchases cannot be edited via this endpoint", 400);
    }
    if (dto.downPaymentAmount !== undefined &&
        purchase.paymentType !== "DOWNPAYMENT") {
        throw errors_1.AppError.validation({
            downPaymentAmount: ["Only applicable to DOWNPAYMENT purchases"],
        });
    }
    if (dto.registrationFeeAmount !== undefined &&
        !purchase.hasRegistrationFee) {
        throw errors_1.AppError.validation({
            registrationFeeAmount: ["This purchase has no registration fee"],
        });
    }
    const oldFSP = purchase.finalSellingPrice;
    const newFSP = roundCurrency(dto.finalSellingPrice ?? oldFSP);
    const oldDown = purchase.downPaymentAmount ?? 0;
    const newDown = purchase.paymentType === "DIRECT"
        ? newFSP
        : roundCurrency(dto.downPaymentAmount ?? oldDown);
    const newRegFee = purchase.hasRegistrationFee
        ? roundCurrency(dto.registrationFeeAmount ?? purchase.registrationFeeAmount ?? 0)
        : (purchase.registrationFeeAmount ?? 0);
    const newRemaining = purchase.paymentType === "DIRECT"
        ? 0
        : roundCurrency((purchase.remainingAmount ?? 0) + (newFSP - oldFSP));
    if (newRemaining < 0) {
        const minFSP = roundCurrency(oldFSP - (purchase.remainingAmount ?? 0));
        throw new errors_1.AppError(`This edit would create a negative balance. Minimum finalSellingPrice: Rs. ${minFSP.toLocaleString("en-LK")}`, 400);
    }
    if (purchase.paymentType === "DOWNPAYMENT" &&
        newDown > newFSP) {
        throw errors_1.AppError.validation({
            downPaymentAmount: ["Cannot exceed final selling price"],
        });
    }
    const newStatus = newRemaining <= 0 ? "SETTLED" : "TO_SETTLE";
    const hasInstallmentPlan = (purchase.installmentMonths ?? 0) > 0 &&
        purchase.interestRate != null;
    let newTotalWithInterest = purchase.totalWithInterest ?? null;
    let newMonthly = purchase.monthlyInstallmentAmount ?? null;
    if (hasInstallmentPlan && dto.finalSellingPrice !== undefined) {
        newTotalWithInterest = roundCurrency(newFSP * (1 + purchase.interestRate / 100));
        newMonthly = roundCurrency(newTotalWithInterest / purchase.installmentMonths);
    }
    const allInstallmentsPending = installments.length > 0 &&
        installments.every((installment) => installment.status === "PENDING" && installment.paidAmount === 0);
    const initialPayment = invoicePayments[0] ?? null;
    const newPaymentAmount = purchase.paymentType === "DIRECT"
        ? roundCurrency(newFSP +
            (purchase.hasRegistrationFee ? newRegFee : 0) +
            getStoredExtraCostsTotal(purchase.extraCosts))
        : newDown;
    try {
        await prisma_client_1.prisma.$transaction(async (tx) => {
            await getPurchaseModelClient(tx).update({
                where: { id: purchaseId },
                data: {
                    finalSellingPrice: newFSP,
                    downPaymentAmount: newDown,
                    remainingAmount: newRemaining,
                    settlementStatus: newStatus,
                    registrationFeeAmount: newRegFee,
                    ...(newTotalWithInterest != null
                        ? { totalWithInterest: newTotalWithInterest }
                        : {}),
                    ...(newMonthly != null ? { monthlyInstallmentAmount: newMonthly } : {}),
                },
            });
            if (dto.mobileNumber !== undefined) {
                await tx.posCustomer.update({
                    where: { id: purchase.customerId },
                    data: { mobileNumber: dto.mobileNumber },
                });
            }
            if (initialPayment && initialPayment.receiptId === null) {
                await tx.invoicePayment.update({
                    where: { id: initialPayment.id },
                    data: { amount: newPaymentAmount },
                });
            }
            if (hasInstallmentPlan &&
                allInstallmentsPending &&
                dto.finalSellingPrice !== undefined) {
                await tx.posInstallment.deleteMany({ where: { purchaseId } });
                const baseDate = new Date(purchase.purchasedAt);
                const months = purchase.installmentMonths;
                const installmentData = Array.from({ length: months }, (_, i) => {
                    const dueDate = new Date(baseDate);
                    dueDate.setMonth(dueDate.getMonth() + i + 1);
                    const isLast = i === months - 1;
                    const dueAmount = isLast
                        ? roundCurrency(newTotalWithInterest - newMonthly * (months - 1))
                        : newMonthly;
                    return { purchaseId, installmentNo: i + 1, dueDate, dueAmount };
                });
                await tx.posInstallment.createMany({ data: installmentData });
                const newInstallments = await tx.posInstallment.findMany({
                    where: { purchaseId },
                    orderBy: { installmentNo: "asc" },
                });
                let dp = newDown;
                for (const inst of newInstallments) {
                    if (dp <= 0)
                        break;
                    const pay = roundCurrency(Math.min(dp, inst.dueAmount));
                    dp = roundCurrency(dp - pay);
                    const fullyPaid = pay >= inst.dueAmount;
                    await tx.posInstallment.update({
                        where: { id: inst.id },
                        data: fullyPaid
                            ? {
                                paidAmount: pay,
                                status: "PAID",
                                isPartial: false,
                                settledAt: new Date(),
                            }
                            : { paidAmount: pay, status: "PARTIAL", isPartial: true },
                    });
                    await tx.posInstallmentPayment.create({
                        data: {
                            installmentId: inst.id,
                            amount: pay,
                            penaltyAmount: 0,
                            note: "Initial advance payment (re-applied after invoice edit)",
                            paidAt: new Date(),
                        },
                    });
                }
            }
        });
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002") {
            throw mapUniqueConstraint(error);
        }
        throw error;
    }
    return getPurchaseModelClient(prisma_client_1.prisma).findUniqueOrThrow({
        where: { id: purchaseId },
        select: {
            id: true,
            finalSellingPrice: true,
            downPaymentAmount: true,
            remainingAmount: true,
            settlementStatus: true,
            registrationFeeAmount: true,
            totalWithInterest: true,
            monthlyInstallmentAmount: true,
            customer: { select: { id: true, mobileNumber: true } },
        },
    });
}
async function getPurchaseInstallments(purchaseId) {
    const installments = await getInstallmentModelClient(prisma_client_1.prisma).findMany({
        where: { purchaseId },
        orderBy: { installmentNo: "asc" },
        include: { payments: { orderBy: { paidAt: "asc" } } },
    });
    return { installments };
}
async function listInvoiceAccounts() {
    try {
        const accounts = await listInvoiceAccountsWithRawSql();
        return { accounts };
    }
    catch (error) {
        handleInvoiceAccountPersistenceError(error);
    }
}
async function createInvoiceAccount(dto) {
    try {
        const account = await createInvoiceAccountWithRawSql(dto);
        return account;
    }
    catch (error) {
        handleInvoiceAccountPersistenceError(error);
    }
}
async function updateInvoiceAccount(accountId, dto) {
    try {
        const account = await updateInvoiceAccountWithRawSql(accountId, dto);
        return account;
    }
    catch (error) {
        handleInvoiceAccountPersistenceError(error);
    }
}
async function deleteInvoiceAccount(accountId) {
    try {
        await deleteInvoiceAccountWithRawSql(accountId);
    }
    catch (error) {
        handleInvoiceAccountPersistenceError(error);
    }
}
async function listInvoiceTerms() {
    const model = getInvoiceTermModelClient(prisma_client_1.prisma);
    const terms = await model.findMany({
        orderBy: [{ termType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    return {
        terms,
    };
}
async function createInvoiceTerm(dto) {
    const model = getInvoiceTermModelClient(prisma_client_1.prisma);
    const maxSortOrderRow = await model.findFirst({
        where: { termType: dto.termType },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
    });
    return model.create({
        data: {
            text: dto.text,
            termType: dto.termType,
            sortOrder: dto.sortOrder ?? (maxSortOrderRow?.sortOrder ?? 0) + 1,
            isActive: dto.isActive ?? true,
        },
    });
}
async function updateInvoiceTerm(termId, dto) {
    const model = getInvoiceTermModelClient(prisma_client_1.prisma);
    try {
        return await model.update({
            where: { id: termId },
            data: {
                ...(dto.text != null ? { text: dto.text } : {}),
                ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
                ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
                ...(dto.termType != null ? { termType: dto.termType } : {}),
            },
        });
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025") {
            throw errors_1.AppError.notFound("Invoice term not found");
        }
        throw error;
    }
}
async function deleteInvoiceTerm(termId) {
    const model = getInvoiceTermModelClient(prisma_client_1.prisma);
    try {
        await model.delete({ where: { id: termId } });
    }
    catch (error) {
        if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025") {
            throw errors_1.AppError.notFound("Invoice term not found");
        }
        throw error;
    }
}
