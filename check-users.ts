import { db } from './src/lib/db';

async function main() {
  const users = await db.user.findMany({
    select: { id: true, phone: true, name: true, role: true }
  });
  console.log('Users:', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
