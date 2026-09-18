import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling display IDs...');

  // Backfill users — get all users and filter those without proper displayId
  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, displayId: true },
  });

  const usersToFix = allUsers.filter(u => !u.displayId || !u.displayId.startsWith('AGU-'));

  let userCounter = allUsers.reduce((max, u) => {
    const m = u.displayId?.match(/AGU-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);

  for (const user of usersToFix) {
    userCounter++;
    const displayId = `AGU-${String(userCounter).padStart(4, '0')}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { displayId },
    });
    console.log(`  User ${user.id} → ${displayId}`);
  }
  console.log(`Updated ${usersToFix.length} users`);

  // Backfill children
  const allChildren = await prisma.child.findMany({
    orderBy: { enrolledAt: 'asc' },
    select: { id: true, displayId: true },
  });

  const childrenToFix = allChildren.filter(c => !c.displayId || !c.displayId.startsWith('AG-'));

  let childCounter = allChildren.reduce((max, c) => {
    const m = c.displayId?.match(/^AG-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);

  for (const child of childrenToFix) {
    childCounter++;
    const displayId = `AG-${String(childCounter).padStart(4, '0')}`;
    await prisma.child.update({
      where: { id: child.id },
      data: { displayId },
    });
    console.log(`  Child ${child.id} → ${displayId}`);
  }
  console.log(`Updated ${childrenToFix.length} children`);

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
