const logger = require("./config/logger");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { disconnectRedis } = require("./config/redis");
const { cleanupAbandoned } = require("./services/dockerRestoreService");
const { createWorker } = require("./workers/verificationWorker");
let worker;
async function startWorker({ connectDatabase: shouldConnectDatabase = true } = {}) {
  if (shouldConnectDatabase) await connectDatabase();
  await cleanupAbandoned();
  worker = createWorker();
  logger.info("Verification worker started");
  return worker;
}
async function shutdown(signal) {
  logger.info({ signal }, "Verification worker stopping");
  if (worker) await worker.close();
  await Promise.all([disconnectRedis(), disconnectDatabase()]);
  process.exit(0);
}
if (require.main === module) {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  startWorker().catch((err) => {
    logger.fatal({ err }, "Verification worker failed to start");
    process.exit(1);
  });
}
module.exports = { startWorker };
