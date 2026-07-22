import { db } from '../src/lib/db';

async function main() {
  const promos = await db.promotion.findMany();
  console.log(`Found ${promos.length} promotions`);

  const now = new Date();
  const newEndDate = new Date();
  newEndDate.setFullYear(newEndDate.getFullYear() + 1); // +1 year

  for (const p of promos) {
    const needsUpdate =
      !p.isActive ||
      !p.endDate ||
      new Date(p.endDate) < now ||
      !p.startDate ||
      new Date(p.startDate) > now;

    if (needsUpdate) {
      const startDate = p.startDate && new Date(p.startDate) < now ? p.startDate : now;
      await db.promotion.update({
        where: { id: p.id },
        data: {
          isActive: true,
          startDate,
          endDate: newEndDate,
        },
      });
      console.log(`Updated: ${p.name} -> endDate ${newEndDate.toISOString()}`);
    } else {
      console.log(`OK (no change): ${p.name}`);
    }
  }

  console.log('Done.');
}

main().catch(console.error).finally(() => process.exit(0));
