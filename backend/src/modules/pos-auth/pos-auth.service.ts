import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../database/prisma.client";
import { env } from "../../config/env";
import { AppError } from "../../common/utils/errors";
import type { PosLoginDto } from "./dto/pos-login.dto";

type PosJwtPayload = {
  sub: number;
  email: string;
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
    !("type" in decoded) ||
    typeof (decoded as { sub: unknown }).sub !== "number" ||
    typeof (decoded as { email: unknown }).email !== "string" ||
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
    lastLoginAt: admin.lastLoginAt,
  };
}
