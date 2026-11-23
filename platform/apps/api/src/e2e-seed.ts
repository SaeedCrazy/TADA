// Prepares the end-to-end database: empty tables, the normal seed, branches open all day,
// Mollasadra pinned with delivery on, and a barista account. Refuses any database not named *_e2e.
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { seed } from './seed.js';
import { hashPassword } from './modules/auth/auth.routes.js';

const config = loadConfig();
if (!new URL(config.DATABASE_URL).pathname.slice(1).endsWith('_e2e')) {
  throw new Error('e2e-seed only runs against a database whose name ends in _e2e');
}
const db = createDb(config.DATABASE_URL);
const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
await seed(db, { ownerPassword: 'owner-e2e-password', quiet: true });
await db.branch.updateMany({ data: { hours: [['00:00', '24:00']] } });
await db.branch.update({
  where: { slug: 'mollasadra' },
  data: { lat: 35.76, lng: 51.41, deliveryEnabled: true, deliveryBaseFee: 300000, deliveryPerKm: 100000, deliveryMaxKm: 6 },
});
const mollasadra = await db.branch.findUniqueOrThrow({ where: { slug: 'mollasadra' } });
await db.staff.create({ data: { username: 'bar-e2e', name: 'باریستای تست', role: 'BARISTA', branchId: mollasadra.id, passwordHash: await hashPassword('barista-e2e-password') } });
await db.$disconnect();
console.log('e2e database ready');
