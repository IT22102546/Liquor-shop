import { Module, Global } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { DatabaseUtilsService } from "./database-utils.service";
// import { IncrementalSeedService } from "./incremental-seed.service"; // Comment out or remove this line

@Global()
@Module({
  providers: [
    PrismaService, 
    DatabaseUtilsService, 
    // IncrementalSeedService // Comment out or remove this line
  ],
  exports: [
    PrismaService, 
    DatabaseUtilsService, 
    // IncrementalSeedService // Comment out or remove this line
  ],
})
export class DatabaseModule {}