import { defineConfig, env } from 'prisma/config';

// DATABASE_URL comes from the environment (.env is loaded by the npm scripts / docker-compose).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx src/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
