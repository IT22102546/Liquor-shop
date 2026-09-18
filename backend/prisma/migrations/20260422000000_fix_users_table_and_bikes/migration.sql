-- Drop the old `users` table (from the original physiotherapy project schema).
-- CASCADE automatically removes all foreign key constraints pointing to it
-- from the legacy tables (parent_profiles, hospitals, children, etc.)
-- that are no longer part of this project's Prisma schema.
DROP TABLE IF EXISTS "users" CASCADE;

-- Create the Role enum used by the new User model
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

-- Create new users table matching the current Prisma schema
CREATE TABLE "users" (
    "id"           SERIAL NOT NULL,
    "name"         TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         "Role" NOT NULL DEFAULT 'CUSTOMER',
    "refreshToken" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Create the simple bikes table used by the seed and basic bike catalogue
CREATE TABLE "bikes" (
    "id"        SERIAL NOT NULL,
    "name"      TEXT NOT NULL,
    "brand"     TEXT NOT NULL,
    "model"     TEXT,
    "year"      INTEGER,
    "price"     DOUBLE PRECISION NOT NULL,
    "inStock"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);
