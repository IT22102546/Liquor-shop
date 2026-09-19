import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../database/prisma.client";
import { env } from "../../config/env";
import { AppError } from "../../common/utils/errors";
import type { PosLoginDto } from "./dto/pos-login.dto";
import type { CreatePosStaffDto, UpdatePosStaffDto } from "./dto/pos-staff.dto";

type PosJwtPayload = {
  sub: number;
  email: string;
  role: "ADMIN" | "CASHIER" | "INVENTORY_MANAGER" | "ACCOUNTANT";
  type: "pos_admin";
};

function generatePosAccessToken(payload: PosJwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.POS_JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function verifyPosAccessToken(token: string): PosJwtPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw AppError.unauthorized("Invalid or expired POS token");
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("sub" in decoded) ||
    !("email" in decoded) ||
    !("role" in decoded) ||
    !("type" in decoded) ||
    typeof (decoded as { sub: unknown }).sub !== "number" ||
    typeof (decoded as { email: unknown }).email !== "string" ||
    !["ADMIN", "CASHIER", "INVENTORY_MANAGER", "ACCOUNTANT"].includes(
      String((decoded as { role: unknown }).role),
    ) ||
    (decoded as { type: unknown }).type !== "pos_admin"
  ) {
    throw AppError.unauthorized("Invalid token type");
  }

  return decoded as PosJwtPayload;
}

export async function loginPosAdmin(dto: PosLoginDto) {
  const admin = await prisma.posAdmin.findUnique({ where: { email: dto.email } });
  if (!admin || !admin.isActive) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
  if (!isValid) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const accessToken = generatePosAccessToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    type: "pos_admin",
  });

  await prisma.posAdmin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    },
  };
}

export async function getPosAdminFromToken(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw AppError.unauthorized("Authorization header is required");
  }

  const token = authHeader.slice("Bearer ".length);
  const payload = verifyPosAccessToken(token);

  const admin = await prisma.posAdmin.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.isActive) {
    throw AppError.unauthorized("POS admin not found or inactive");
  }

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt,
  };
}

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export function listPosStaff() {
  return prisma.posAdmin.findMany({
    select: staffSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function createPosStaff(dto: CreatePosStaffDto) {
  const existing = await prisma.posAdmin.findUnique({ where: { email: dto.email } });
  if (existing) throw AppError.conflict("A staff account with this email already exists");
  return prisma.posAdmin.create({
    data: {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash: await bcrypt.hash(dto.password, 12),
    },
    select: staffSelect,
  });
}

export async function updatePosStaff(id: number, currentAdminId: number, dto: UpdatePosStaffDto) {
  const existing = await prisma.posAdmin.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Staff account not found");
  if (id === currentAdminId && (dto.isActive === false || (dto.role && dto.role !== "ADMIN"))) {
    throw new AppError("You cannot remove your own administrator access", 400);
  }
  if (dto.email && dto.email !== existing.email) {
    const duplicate = await prisma.posAdmin.findUnique({ where: { email: dto.email } });
    if (duplicate) throw AppError.conflict("A staff account with this email already exists");
  }
  return prisma.posAdmin.update({
    where: { id },
    data: {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      isActive: dto.isActive,
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
    },
    select: staffSelect,
  });
}
