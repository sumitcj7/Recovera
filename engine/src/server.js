const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { connectRedis, disconnectRedis } = require("./config/redis");
const { startWorker } = require("./worker");
let server;
let worker;
async function start() {
  await connectDatabase();
  await connectRedis();
  if (env.RUN_VERIFICATION_WORKER)
    worker = await startWorker({ connectDatabase: false });
  server = app.listen(env.PORT, () =>
    logger.info({ port: env.PORT }, "Recovera Engine listening"),
  );
}
async function shutdown(signal) {
  logger.info({ signal }, "Graceful shutdown started");
  if (worker) await worker.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.all([disconnectRedis(), disconnectDatabase()]);
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
start().catch((err) => {
  logger.fatal({ err }, "Engine failed to start");
  process.exit(1);
});
