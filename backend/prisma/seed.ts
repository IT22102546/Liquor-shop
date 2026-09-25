import { PosAdminRole, PrismaClient, Role } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Bar Shop data...");

  const passwordHash = await bcrypt.hash("liquorshop@2026", 12);
  const posAdminPasswordHash = await bcrypt.hash("liquorshop@2026", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@barshop.local" },
    update: {
      name: "Bar Shop System Admin",
      role: Role.ADMIN,
      passwordHash,
    },
    create: {
      name: "Bar Shop POS Admin",
      email: "admin@barshop.local",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const posAdmin = await prisma.posAdmin.upsert({
    where: { email: "manager@barshop.local" },
    update: {
      name: "Bar Shop Manager",
      passwordHash: posAdminPasswordHash,
      role: PosAdminRole.ADMIN,
      isActive: true,
    },
    create: {
      name: "Bar Shop Manager",
      email: "manager@barshop.local",
      passwordHash: posAdminPasswordHash,
      role: PosAdminRole.ADMIN,
      isActive: true,
    },
  });

  console.log(
    `Seed complete. Admin: ${admin.email}, POS Admin: ${posAdmin.email}`
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
