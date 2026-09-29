import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";
import { branchOfUser } from "./branch-context";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Every branch with its stock, staff and whether a till is open (for the Branches page and pickers). */
export async function listBranches(includeInactive = false) {
  const branches = await prisma.branch.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }] });
  const [stock, products, staff, open, incoming] = await Promise.all([
    prisma.branchStock.findMany({ select: { branchId: true, productId: true, quantity: true, damagedQuantity: true } }),
    prisma.inventoryProduct.findMany({ select: { id: true, purchasePrice: true, taxPaid: true, additionalExpenses: true } }),
    prisma.posAdmin.groupBy({ by: ["branchId"], where: { isActive: true }, _count: true }),
    prisma.posShift.findMany({ where: { status: "OPEN" }, select: { branchId: true, shiftNo: true } }),
    prisma.gtn.groupBy({ by: ["toBranchId"], where: { status: "SENT" }, _count: true }),
  ]);
  const cost = new Map(products.map((product) => [product.id, (product.purchasePrice ?? 0) + (product.taxPaid ?? 0) + (product.additionalExpenses ?? 0)]));
  return branches.map((branch) => {
    const rows = stock.filter((row) => row.branchId === branch.id);
    return {
      ...branch,
      units: rows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0),
      damaged: rows.reduce((sum, row) => sum + row.damagedQuantity, 0),
      stockValue: round2(rows.reduce((sum, row) => sum + Math.max(0, row.quantity) * (cost.get(row.productId) ?? 0), 0)),
      staff: staff.find((row) => row.branchId === branch.id)?._count ?? 0,
      openShift: open.find((row) => row.branchId === branch.id)?.shiftNo ?? null,
      transfersToReceive: incoming.find((row) => row.toBranchId === branch.id)?._count ?? 0,
    };
  });
}

export type BranchInput = { code: string; name: string; address?: string | null; phone?: string | null; email?: string | null };

export async function createBranch(dto: BranchInput) {
  try {
    return await prisma.branch.create({ data: { code: dto.code.trim().toUpperCase(), name: dto.name.trim(), address: dto.address?.trim() || null, phone: dto.phone?.trim() || null, email: dto.email?.trim().toLowerCase() || null } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw AppError.conflict(`Branch code ${dto.code.toUpperCase()} is already used`);
    throw error;
  }
}

export async function updateBranch(id: number, dto: Partial<BranchInput> & { isActive?: boolean }) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) throw AppError.notFound("Branch not found");
  if (dto.isActive === false) {
    if (branch.isMain) throw new AppError("The main branch can't be closed", 400);
    const [open, stock, transit, staff] = await Promise.all([
      prisma.posShift.count({ where: { branchId: id, status: "OPEN" } }),
      prisma.branchStock.aggregate({ where: { branchId: id }, _sum: { quantity: true, damagedQuantity: true } }),
      prisma.gtn.count({ where: { status: "SENT", OR: [{ toBranchId: id }, { fromBranchId: id }] } }),
      prisma.posAdmin.count({ where: { branchId: id, isActive: true } }),
    ]);
    if (open) throw new AppError(`${branch.name} has a shift open — close it first`, 400);
    if ((stock._sum.quantity ?? 0) > 0 || (stock._sum.damagedQuantity ?? 0) > 0) throw new AppError(`${branch.name} still has stock — transfer it to another branch first (GTN)`, 400);
    if (transit) throw new AppError(`${branch.name} has transfers in transit — receive or cancel them first`, 400);
    if (staff) throw new AppError(`${staff} staff member(s) work at ${branch.name} — move them to another branch first`, 400);
  }
  try {
    return await prisma.branch.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw AppError.conflict(`Branch code ${String(dto.code).toUpperCase()} is already used`);
    throw error;
  }
}

/** Where the signed-in person is working, and the branches they may switch to. */
export async function currentBranch(userId: number) {
  const branch = await branchOfUser(userId);
  const branches = branch.fixed ? [] : await prisma.branch.findMany({ where: { isActive: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }], select: { id: true, code: true, name: true } });
  return { branch, canSwitch: !branch.fixed, branches };
}

export async function switchBranch(userId: number, branchId: number) {
  const user = await prisma.posAdmin.findUnique({ where: { id: userId }, select: { branchId: true } });
  if (!user) throw AppError.unauthorized("Staff account not found");
  if (user.branchId != null) throw AppError.forbidden("You work at one branch and can't switch");
  const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
  if (!branch) throw AppError.validation({ branchId: ["Choose an open branch"] });
  await prisma.posAdmin.update({ where: { id: userId }, data: { activeBranchId: branch.id } });
  return currentBranch(userId);
}

/** Stock of each product in every branch (Product Setup's "all branches" view and the GTN form). */
export async function stockByBranch(productIds?: number[]) {
  const [branches, rows] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }], select: { id: true, code: true, name: true } }),
    prisma.branchStock.findMany({ where: productIds ? { productId: { in: productIds } } : {}, select: { branchId: true, productId: true, quantity: true, damagedQuantity: true, emptyBottlesOnHand: true } }),
  ]);
  return {
    branches,
    stock: rows.map((row) => ({ branchId: row.branchId, productId: row.productId, quantity: row.quantity, damaged: row.damagedQuantity, empties: row.emptyBottlesOnHand })),
  };
}
