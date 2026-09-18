import * as jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/utils/errors";

interface RegisterDto {
  email: string;
  name: string;
  password: string;
  role?: "ADMIN" | "STAFF" | "CUSTOMER";
}

interface LoginDto {
  email: string;
  password: string;
}

export async function registerUser(dto: RegisterDto) {
  const existingUser = await prisma.user.findUnique({
    where: { email: dto.email },
  });

  if (existingUser) {
    throw new AppError("User already exists", 400);
  }

  const hashedPassword = await bcrypt.hash(dto.password, 10);

  const user = await prisma.user.create({
    data: {
      email: dto.email,
      name: dto.name,
      passwordHash: hashedPassword, // FIX: Use passwordHash, not password
      role: dto.role || "CUSTOMER",
    },
  });

  // Remove passwordHash from response
  const { passwordHash, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    tokens: generateTokens(user),
  };
}

export async function loginUser(dto: LoginDto) {
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash); // FIX: Use passwordHash
  if (!isValidPassword) {
    throw new AppError("Invalid credentials", 401);
  }

  const { passwordHash, ...userWithoutPassword } = user; // FIX: Remove passwordHash

  return {
    user: userWithoutPassword,
    tokens: generateTokens(user),
  };
}

export function generateTokens(user: any) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  // FIX: Use 'as any' for jwt options
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN || "1h",
  } as any);

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN || "7d",
  } as any);

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    // FIX: Use any for decoded
    const decoded: any = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user) {
      throw new AppError("User not found", 401);
    }

    return generateTokens(user);
  } catch (error) {
    throw new AppError("Invalid refresh token", 401);
  }
}

export async function logoutUser(userId: number) {
  // Optional: Implement token blacklisting
  return { message: "Logged out successfully" };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
}
