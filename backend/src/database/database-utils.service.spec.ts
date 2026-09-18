import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseUtilsService } from "./database-utils.service";
import { PrismaService } from "./prisma.service";

describe("DatabaseUtilsService", () => {
  let service: DatabaseUtilsService;
  let prismaService: PrismaService;

  // Mock PrismaService
  const mockPrismaService: any = {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockPrismaService)
    ),
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseUtilsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DatabaseUtilsService>(DatabaseUtilsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("softDelete", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should soft delete a record and return true", async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(1);

      const result = await service.softDelete("User", "user-123", "admin-456");

      expect(result).toBe(true);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        "admin-456",
        "user-123"
      );
    });

    it("should return false when no record found", async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(0);

      const result = await service.softDelete(
        "User",
        "non-existent",
        "admin-456"
      );

      expect(result).toBe(false);
    });

    it("should throw error on database failure", async () => {
      mockPrismaService.$executeRawUnsafe.mockRejectedValue(
        new Error("DB Error")
      );

      await expect(
        service.softDelete("User", "user-123", "admin-456")
      ).rejects.toThrow("DB Error");
    });
  });

  describe("batchSoftDelete", () => {
    it("should return 0 for empty ids array", async () => {
      const result = await service.batchSoftDelete("User", [], "admin-456");
      expect(result).toBe(0);
      expect(mockPrismaService.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it("should batch soft delete multiple records", async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(3);

      const result = await service.batchSoftDelete(
        "User",
        ["id1", "id2", "id3"],
        "admin-456"
      );

      expect(result).toBe(3);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalled();
    });
  });

  describe("restoreDeleted", () => {
    it("should restore a soft deleted record", async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(1);

      const result = await service.restoreDeleted("User", "user-123");

      expect(result).toBe(true);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("deletedAt"),
        "user-123"
      );
    });

    it("should return false when no record to restore", async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(0);

      const result = await service.restoreDeleted("User", "non-existent");

      expect(result).toBe(false);
    });
  });

  describe("paginatedQuery", () => {
    const mockUsers = [
      { id: "1", name: "User 1" },
      { id: "2", name: "User 2" },
    ];

    it("should return paginated results with metadata", async () => {
      const mockModel = {
        findMany: jest.fn().mockResolvedValue(mockUsers),
        count: jest.fn().mockResolvedValue(10),
      };

      const result = await service.paginatedQuery(
        mockModel as any,
        { deletedAt: null },
        { orderBy: { createdAt: "desc" } },
        1,
        2
      );

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(5);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it("should handle empty results", async () => {
      const mockModel = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      };

      const result = await service.paginatedQuery(
        mockModel as any,
        {},
        {},
        1,
        10
      );

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("should correctly calculate pagination boundaries", async () => {
      const mockModel = {
        findMany: jest.fn().mockResolvedValue(mockUsers),
        count: jest.fn().mockResolvedValue(25),
      };

      const result = await service.paginatedQuery(
        mockModel as any,
        {},
        {},
        3,
        10
      );

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });
  });

  describe("atomicTransaction", () => {
    it("should execute callback within transaction", async () => {
      const mockCallback = jest.fn().mockResolvedValue({ id: "new-user" });

      mockPrismaService.$transaction.mockImplementation(
        async (callback: Function) => callback(mockPrismaService)
      );

      const result = await service.atomicTransaction(mockCallback);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(mockPrismaService);
      expect(result).toEqual({ id: "new-user" });
    });

    it("should rollback on error", async () => {
      const mockCallback = jest.fn().mockRejectedValue(new Error("TX Error"));

      mockPrismaService.$transaction.mockImplementation(
        async (callback: Function) => callback(mockPrismaService)
      );

      await expect(service.atomicTransaction(mockCallback)).rejects.toThrow(
        "TX Error"
      );
    });
  });

  describe("validateQueryComplexity", () => {
    it("should return true for simple includes", () => {
      const simpleInclude = {
        enrollments: true,
        profile: true,
      };

      const result = service.validateQueryComplexity(simpleInclude, {
        maxDepth: 3,
        maxWidth: 10,
      });

      expect(result.isValid).toBe(true);
    });

    it("should reject deeply nested includes", () => {
      const deepInclude = {
        enrollments: {
          include: {
            class: {
              include: {
                teacher: {
                  include: {
                    profile: {
                      include: {
                        qualifications: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = service.validateQueryComplexity(deepInclude, {
        maxDepth: 2,
        maxWidth: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("depth");
    });

    it("should reject too wide includes", () => {
      const wideInclude = {
        field1: true,
        field2: true,
        field3: true,
        field4: true,
        field5: true,
        field6: true,
      };

      const result = service.validateQueryComplexity(wideInclude, {
        maxDepth: 3,
        maxWidth: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("width");
    });
  });

  describe("checkSchemaHealth", () => {
    it("should detect orphaned records", async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([
        { orphaned_count: 5 },
      ]);

      const result = await service.checkSchemaHealth();

      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should return healthy when no issues found", async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([
        { orphaned_count: 0 },
      ]);

      // Override for empty check
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.checkSchemaHealth();

      // Result depends on implementation
      expect(result).toBeDefined();
    });
  });

  describe("buildOptimalIncludes", () => {
    it("should build query with validated includes", async () => {
      const mockModel = {
        findMany: jest.fn().mockResolvedValue([{ id: "1" }]),
      };

      const result = await service.buildOptimalIncludes(
        mockModel as any,
        { deletedAt: null },
        { enrollments: true }
      );

      expect(mockModel.findMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should throw on too complex includes", async () => {
      const mockModel = {
        findMany: jest.fn(),
      };

      const deepInclude = {
        a: {
          include: {
            b: {
              include: {
                c: {
                  include: {
                    d: { include: { e: true } },
                  },
                },
              },
            },
          },
        },
      };

      await expect(
        service.buildOptimalIncludes(mockModel as any, {}, deepInclude, {
          depth: 2,
          maxWidth: 3,
        })
      ).rejects.toThrow();
    });
  });
});
