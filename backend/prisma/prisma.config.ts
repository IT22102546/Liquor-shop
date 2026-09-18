/**
 * Prisma Configuration for Prisma 7+
 * This file configures the database connection URL for migrations and other Prisma CLI operations
 * @see https://pris.ly/d/config-datasource
 */

export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};
