import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

export type Db = PrismaClient;
export { Prisma } from './generated/prisma/client.ts';
export type * from './generated/prisma/client.ts';

/** One client (and pool) per process. */
export function createDb(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl, max: 10 });
  return new PrismaClient({ adapter });
}
