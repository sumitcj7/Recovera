const { Queue } = require("bullmq");
const env = require("./env");
const url = new URL(env.REDIS_URL);
const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  password: url.password || undefined,
  maxRetriesPerRequest: null,
};
const verificationQueue = new Queue("verification", {
  connection,
  defaultJobOptions: {
    attempts: env.VERIFICATION_ATTEMPTS,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
module.exports = { verificationQueue, queueConnection: connection };
