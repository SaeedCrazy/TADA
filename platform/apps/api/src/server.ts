import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { startWorkers } from './workers.js';

const config = loadConfig();
const app = await buildApp({ config });
const stopWorkers = config.WORKERS ? startWorkers(app.ctx) : () => undefined;

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopWorkers();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
