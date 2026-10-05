/**
 * One-shot migration: hash every legacy PLAINTEXT PIN still stored in the
 * users table (bcrypt, same cost factor as src/lib/auth.ts).
 * Safe to re-run: rows already hashed ($2a$/$2b$ prefix) are skipped.
 *
 * Usage: node scripts/migrate-plaintext-pins.cjs
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    where: { pin: { not: null } },
    select: { id: true, phone: true, pin: true },
  });

  const legacy = users.filter((u) => u.pin && !u.pin.startsWith('$2a$') && !u.pin.startsWith('$2b$'));

  console.log(`Users with a PIN: ${users.length}`);
  console.log(`Legacy plaintext PINs found: ${legacy.length}`);

  for (const u of legacy) {
    const hashed = await bcrypt.hash(u.pin, 10);
    await db.user.update({ where: { id: u.id }, data: { pin: hashed } });
    console.log(`  ✔ hashed PIN of user ${u.phone} (${u.id})`);
  }

  console.log(legacy.length === 0 ? 'Nothing to migrate — DB is clean.' : `Migration done: ${legacy.length} PIN(s) hashed.`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
