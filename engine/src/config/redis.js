const Redis = require("ioredis");
const env = require("./env");
const logger = require("./logger");
let client;
function connectRedis() {
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  client.on("error", (err) => logger.error({ err }, "Redis error"));
  return client.connect().then(() => {
    logger.info("Redis connected");
    return client;
  });
}
async function disconnectRedis() {
  if (client) await client.quit();
}
module.exports = { connectRedis, disconnectRedis };
