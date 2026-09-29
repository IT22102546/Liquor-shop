import type { Request } from "express";
import { Prisma } from "../../generated/prisma";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";

type Db = Prisma.TransactionClient | typeof prisma;
export type BranchInfo = { id: number; code: string; name: string; address: string | null; phone: string | null; email: string | null; isMain: boolean };
const BRANCH_SELECT = { id: true, code: true, name: true, address: true, phone: true, email: true, isMain: true } as const;

/** The main branch (created on first use, so a fresh install always has one). */
export async function mainBranch(db: Db = prisma): Promise<BranchInfo> {
  const found = await db.branch.findFirst({ where: { isActive: true }, orderBy: [{ isMain: "desc" }, { id: "asc" }], select: BRANCH_SELECT });
  if (found) return found;
  return db.branch.create({ data: { code: "MAIN", name: "Main branch", isMain: true }, select: BRANCH_SELECT });
}

/**
 * The branch a signed-in person is working in. Staff with a fixed branch (cashiers) always work there;
 * people without one (administrators, inventory managers, accountants) work in the branch they switched to.
 */
export async function branchOfUser(userId: number): Promise<BranchInfo & { fixed: boolean }> {
  const user = await prisma.posAdmin.findUnique({ where: { id: userId }, select: { branchId: true, activeBranchId: true } });
  if (!user) throw AppError.unauthorized("Staff account not found");
  const wanted = user.branchId ?? user.activeBranchId;
  const branch = wanted ? await prisma.branch.findFirst({ where: { id: wanted, isActive: true }, select: BRANCH_SELECT }) : null;
  if (branch) return { ...branch, fixed: user.branchId != null };
  if (user.branchId != null) throw AppError.forbidden("Your branch is closed — ask an administrator to move you to another branch");
  return { ...(await mainBranch()), fixed: false };
}

/** The request's branch, looked up once per request. */
export async function requestBranch(req: Request): Promise<BranchInfo & { fixed: boolean }> {
  const holder = req as unknown as { user?: { id: number }; __branch?: Promise<BranchInfo & { fixed: boolean }> };
  if (!holder.user) throw AppError.unauthorized("Sign in first");
  holder.__branch ??= branchOfUser(holder.user.id);
  return holder.__branch;
}

/** Branch id for a request, or null when an admin / accountant asked for "all branches" (?branch=all). */
export async function requestBranchScope(req: Request): Promise<number | null> {
  const branch = await requestBranch(req);
  if (req.query.branch === "all" && !branch.fixed) return null;
  const asked = Number(req.query.branchId);
  if (Number.isInteger(asked) && asked > 0 && !branch.fixed) return asked;
  return branch.id;
}
