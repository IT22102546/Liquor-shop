import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const keepEmail = "armigo@gmail.com";

  const keeper = await prisma.user.findFirst({
    where: {
      email: {
        equals: keepEmail,
        mode: "insensitive",
      },
    },
    select: { id: true, email: true },
  });

  if (!keeper) {
    throw new Error(`Keeper user not found: ${keepEmail}`);
  }

  const usersToDelete = await prisma.user.findMany({
    where: {
      OR: [
        { email: null },
        {
          NOT: {
            email: {
              equals: keepEmail,
              mode: "insensitive",
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  const userIdsToDelete = usersToDelete.map((user) => user.id);

  if (userIdsToDelete.length === 0) {
    console.log("No users to delete.");
    return;
  }

  const childrenToDelete = await prisma.child.findMany({
    where: { parentId: { in: userIdsToDelete } },
    select: { id: true },
  });

  const childIdsToDelete = childrenToDelete.map((child) => child.id);

  const sessionsToDelete = await prisma.therapySession.findMany({
    where: {
      OR: [
        { createdById: { in: userIdsToDelete } },
        ...(childIdsToDelete.length > 0 ? [{ childId: { in: childIdsToDelete } }] : []),
      ],
    },
    select: { id: true },
  });

  const sessionIdsToDelete = sessionsToDelete.map((session) => session.id);

  await prisma.$transaction(async (tx) => {
    await tx.hospital.updateMany({
      where: { createdById: { in: userIdsToDelete } },
      data: { createdById: keeper.id },
    });

    await tx.credentialLog.deleteMany({
      where: { generatedById: { in: userIdsToDelete } },
    });

    await tx.auditLog.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    });

    await tx.notification.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    });

    if (sessionIdsToDelete.length > 0) {
      await tx.movementLog.deleteMany({
        where: { sessionId: { in: sessionIdsToDelete } },
      });

      await tx.therapySession.deleteMany({
        where: { id: { in: sessionIdsToDelete } },
      });
    }

    await tx.progressRecord.deleteMany({
      where: {
        OR: [
          { recordedById: { in: userIdsToDelete } },
          ...(childIdsToDelete.length > 0 ? [{ childId: { in: childIdsToDelete } }] : []),
        ],
      },
    });

    await tx.appointment.deleteMany({
      where: {
        OR: [
          { parentId: { in: userIdsToDelete } },
          { createdById: { in: userIdsToDelete } },
          ...(childIdsToDelete.length > 0 ? [{ childId: { in: childIdsToDelete } }] : []),
        ],
      },
    });

    await tx.deviceAssignment.deleteMany({
      where: {
        OR: [
          { assignedBy: { in: userIdsToDelete } },
          ...(childIdsToDelete.length > 0 ? [{ childId: { in: childIdsToDelete } }] : []),
        ],
      },
    });

    if (childIdsToDelete.length > 0) {
      await tx.admissionTracking.deleteMany({
        where: { childId: { in: childIdsToDelete } },
      });

      await tx.therapyProgram.deleteMany({
        where: { childId: { in: childIdsToDelete } },
      });

      await tx.child.deleteMany({
        where: { id: { in: childIdsToDelete } },
      });
    }

    await tx.hospitalProfile.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    });

    await tx.parentProfile.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    });

    await tx.user.deleteMany({
      where: { id: { in: userIdsToDelete } },
    });
  });

  console.log(`Deleted users: ${userIdsToDelete.length}`);
  console.log(`Kept user: ${keeper.email} (${keeper.id})`);
}

main()
  .catch((error) => {
    console.error("Purge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
