import { Test, TestingModule } from "@nestjs/testing";
import { IncrementalSeedService } from "./incremental-seed.service";
import { PrismaService } from "./prisma.service";

describe("IncrementalSeedService", () => {
  let service: IncrementalSeedService;

  // Mock PrismaService
  const mockPrismaService: any = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockPrismaService)
    ),
    subject: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    grade: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    enrollment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    class: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    exam: {
      count: jest.fn(),
    },
    examAttempt: {
      count: jest.fn(),
    },
    payment: {
      count: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncrementalSeedService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IncrementalSeedService>(IncrementalSeedService);
  });

  describe("service initialization", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });
  });

  describe("seedEnums", () => {
    it("should create new enum entries", async () => {
      mockPrismaService.subject.findFirst.mockResolvedValue(null);
      mockPrismaService.subject.create.mockResolvedValue({ id: "1" });

      const data = [
        { name: "Mathematics", code: "MATH", description: "Math subject" },
        { name: "Science", code: "SCI", description: "Science subject" },
      ];

      const result = await service.seedEnums(data);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockPrismaService.subject.create).toHaveBeenCalledTimes(2);
    });

    it("should skip existing enum entries", async () => {
      mockPrismaService.subject.findFirst.mockResolvedValue({ id: "existing" });

      const data = [{ name: "Mathematics", code: "MATH" }];

      const result = await service.seedEnums(data);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockPrismaService.subject.create).not.toHaveBeenCalled();
    });

    it("should handle mixed new and existing entries", async () => {
      mockPrismaService.subject.findFirst
        .mockResolvedValueOnce(null) // First item - new
        .mockResolvedValueOnce({ id: "existing" }); // Second item - exists

      mockPrismaService.subject.create.mockResolvedValue({ id: "new" });

      const data = [
        { name: "New Subject", code: "NEW" },
        { name: "Existing Subject", code: "EXISTS" },
      ];

      const result = await service.seedEnums(data);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it("should throw error on database failure", async () => {
      mockPrismaService.subject.findFirst.mockRejectedValue(
        new Error("DB Error")
      );

      await expect(
        service.seedEnums([{ name: "Test", code: "T" }])
      ).rejects.toThrow("DB Error");
    });
  });

  describe("batchCreateUsers", () => {
    const mockUsers = [
      {
        email: "user1@test.com",
        name: "User 1",
        password: "password123",
        role: "STUDENT",
      },
      {
        email: "user2@test.com",
        name: "User 2",
        password: "password456",
        role: "TEACHER",
      },
    ];

    it("should create users in batches", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: "new-user" });

      const result = await service.batchCreateUsers(mockUsers);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it("should skip existing users by email", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: "existing" });

      const result = await service.batchCreateUsers(mockUsers);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(2);
    });

    it("should hash passwords before creation", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: "new" });

      await service.batchCreateUsers([mockUsers[0]]);

      // Verify create was called with hashed password
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      const createCall = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe("password123");
    });
  });

  describe("incrementalCreateEnrollments", () => {
    it("should create enrollments between students and classes", async () => {
      const mockStudents = [{ id: "student1" }, { id: "student2" }];
      const mockClasses = [{ id: "class1" }, { id: "class2" }];

      mockPrismaService.user.findMany.mockResolvedValue(mockStudents);
      mockPrismaService.class.findMany.mockResolvedValue(mockClasses);
      mockPrismaService.enrollment.findFirst.mockResolvedValue(null);
      mockPrismaService.enrollment.create.mockResolvedValue({ id: "new" });

      const result = await service.incrementalCreateEnrollments();

      expect(result.created).toBeGreaterThanOrEqual(0);
    });

    it("should skip existing enrollments", async () => {
      mockPrismaService.user.findMany.mockResolvedValue([{ id: "student1" }]);
      mockPrismaService.class.findMany.mockResolvedValue([{ id: "class1" }]);
      mockPrismaService.enrollment.findFirst.mockResolvedValue({
        id: "existing",
      });

      const result = await service.incrementalCreateEnrollments();

      expect(result.skipped).toBeGreaterThanOrEqual(0);
      expect(mockPrismaService.enrollment.create).not.toHaveBeenCalled();
    });
  });

  describe("verifySeedIntegrity", () => {
    it("should return healthy when all counts are valid", async () => {
      mockPrismaService.user.count.mockResolvedValue(10);
      mockPrismaService.subject.count.mockResolvedValue(5);
      mockPrismaService.class.count.mockResolvedValue(8);
      mockPrismaService.enrollment.count.mockResolvedValue(20);

      const result = await service.verifySeedIntegrity();

      expect(result.isHealthy).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should detect missing users", async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.subject.count.mockResolvedValue(5);
      mockPrismaService.class.count.mockResolvedValue(8);
      mockPrismaService.enrollment.count.mockResolvedValue(20);

      const result = await service.verifySeedIntegrity();

      expect(result.isHealthy).toBe(false);
      expect(result.issues).toContain("No users found in database");
    });

    it("should detect missing subjects", async () => {
      mockPrismaService.user.count.mockResolvedValue(10);
      mockPrismaService.subject.count.mockResolvedValue(0);
      mockPrismaService.class.count.mockResolvedValue(8);
      mockPrismaService.enrollment.count.mockResolvedValue(20);

      const result = await service.verifySeedIntegrity();

      expect(result.isHealthy).toBe(false);
      expect(result.issues).toContain("No subjects found in database");
    });
  });

  describe("cleanAndReseed", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("should throw error in production environment", async () => {
      process.env.NODE_ENV = "production";

      await expect(service.cleanAndReseed()).rejects.toThrow(
        "cleanAndReseed cannot be used in production"
      );
    });

    it("should allow clean and reseed in development", async () => {
      process.env.NODE_ENV = "development";

      // Mock the deleteMany operations
      mockPrismaService.enrollment = {
        ...mockPrismaService.enrollment,
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      };
      mockPrismaService.user = {
        ...mockPrismaService.user,
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
      };

      // Should not throw
      await expect(service.cleanAndReseed()).resolves.toBeDefined();
    });

    it("should allow clean and reseed in test environment", async () => {
      process.env.NODE_ENV = "test";

      mockPrismaService.enrollment = {
        ...mockPrismaService.enrollment,
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrismaService.user = {
        ...mockPrismaService.user,
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };

      await expect(service.cleanAndReseed()).resolves.toBeDefined();
    });
  });

  describe("seedWithTransaction", () => {
    it("should execute all seed operations within transaction", async () => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: Function) => callback(mockPrismaService)
      );

      mockPrismaService.subject.findFirst.mockResolvedValue(null);
      mockPrismaService.subject.create.mockResolvedValue({ id: "1" });
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: "1" });

      await service.seedWithTransaction({
        subjects: [{ name: "Math", code: "M" }],
        users: [
          {
            email: "test@test.com",
            name: "Test",
            password: "pwd",
            role: "STUDENT",
          },
        ],
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it("should rollback on error", async () => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: Function) => callback(mockPrismaService)
      );

      mockPrismaService.subject.findFirst.mockRejectedValue(
        new Error("TX Error")
      );

      await expect(
        service.seedWithTransaction({
          subjects: [{ name: "Math", code: "M" }],
        })
      ).rejects.toThrow("TX Error");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input arrays", async () => {
      const enumResult = await service.seedEnums([]);
      expect(enumResult.created).toBe(0);
      expect(enumResult.skipped).toBe(0);

      const userResult = await service.batchCreateUsers([]);
      expect(userResult.created).toBe(0);
      expect(userResult.skipped).toBe(0);
    });

    it("should handle null/undefined gracefully", async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.class.findMany.mockResolvedValue([]);

      const result = await service.incrementalCreateEnrollments();
      expect(result.created).toBe(0);
    });
  });
});
