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

  const starterProducts = [
    { name: "Lager 500ml", brand: "Island Brew", model: "LAGER-500", year: 2026, price: 450.0, inStock: true },
    { name: "Classic Red 750ml", brand: "Vine House", model: "RED-750", year: 2026, price: 2800.0, inStock: true },
    { name: "London Dry Gin 750ml", brand: "Juniper Co.", model: "GIN-750", year: 2026, price: 6200.0, inStock: true },
  ];

  await prisma.bike.deleteMany();
  await prisma.bike.createMany({ data: starterProducts });

  const productCount = await prisma.bike.count();
  console.log(
    `Seed complete. Admin: ${admin.email}, POS Admin: ${posAdmin.email}, Starter products: ${productCount}`
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
