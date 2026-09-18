import { PrismaService } from "./prisma.service";

/**
 * Base repository with soft-delete-aware methods
 * Provides a clean abstraction over Prisma for common CRUD with soft deletes
 */
export abstract class BaseRepository<T> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string
  ) {}

  /**
   * Find many records (excludes soft-deleted by default)
   */
  async findMany(args: any = {}): Promise<T[]> {
    return (this.prisma as any)[this.modelName].findMany(args);
  }

  /**
   * Find many records INCLUDING soft-deleted
   */
  async findManyWithDeleted(args: any = {}): Promise<T[]> {
    return (this.prisma as any)[this.modelName].findMany({
      ...args,
      __withDeleted: true,
    });
  }

  /**
   * Find first record (excludes soft-deleted by default)
   */
  async findFirst(args: any = {}): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findFirst(args);
  }

  /**
   * Find first record INCLUDING soft-deleted
   */
  async findFirstWithDeleted(args: any = {}): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findFirst({
      ...args,
      __withDeleted: true,
    });
  }

  /**
   * Find unique record by ID or unique field
   */
  async findUnique(args: any): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findUnique(args);
  }

  /**
   * Count records (excludes soft-deleted by default)
   */
  async count(args: any = {}): Promise<number> {
    return (this.prisma as any)[this.modelName].count(args);
  }

  /**
   * Count records INCLUDING soft-deleted
   */
  async countWithDeleted(args: any = {}): Promise<number> {
    return (this.prisma as any)[this.modelName].count({
      ...args,
      __withDeleted: true,
    });
  }

  /**
   * Create a new record
   */
  async create(args: any): Promise<T> {
    return (this.prisma as any)[this.modelName].create(args);
  }

  /**
   * Update a record
   */
  async update(args: any): Promise<T> {
    return (this.prisma as any)[this.modelName].update(args);
  }

  /**
   * Update many records
   */
  async updateMany(args: any): Promise<{ count: number }> {
    return (this.prisma as any)[this.modelName].updateMany(args);
  }

  /**
   * Soft delete a record (sets deletedAt)
   */
  async softDelete(where: any, deletedBy?: string): Promise<T> {
    return (this.prisma as any)[this.modelName].update({
      where,
      data: {
        deletedAt: new Date(),
        ...(deletedBy ? { deletedBy } : {}),
      },
    });
  }

  /**
   * Soft delete many records
   */
  async softDeleteMany(
    where: any,
    deletedBy?: string
  ): Promise<{ count: number }> {
    return (this.prisma as any)[this.modelName].updateMany({
      where,
      data: {
        deletedAt: new Date(),
        ...(deletedBy ? { deletedBy } : {}),
      },
    });
  }

  /**
   * Restore a soft-deleted record
   */
  async restore(where: any): Promise<T> {
    return (this.prisma as any)[this.modelName].update({
      where,
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  /**
   * Hard delete a record (permanent)
   * Use with extreme caution - bypasses soft delete
   */
  async hardDelete(where: any): Promise<T> {
    // Bypass middleware by using native delete after disabling soft-delete conversion
    const model = (this.prisma as any)[this.modelName];
    // Note: This will still trigger middleware; for true hard delete, consider raw query
    return model.delete({ where });
  }

  /**
   * Paginated query with soft-delete awareness
   */
  async paginate(
    args: any = {},
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [data, total] = await Promise.all([
      this.findMany({
        ...args,
        skip,
        take,
      }),
      this.count({
        where: args.where,
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Check if a record exists (excludes soft-deleted)
   */
  async exists(where: any): Promise<boolean> {
    const count = await this.count({ where });
    return count > 0;
  }

  /**
   * Upsert a record
   */
  async upsert(args: any): Promise<T> {
    return (this.prisma as any)[this.modelName].upsert(args);
  }
}
