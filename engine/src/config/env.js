const path = require("path");
const { z } = require("zod");
// This module lives at engine/src/config. Resolve the workspace root explicitly
// so npm workspace scripts load Recovera's shared .env rather than engine/.env.
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const parsed = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(8000),
    MONGODB_URI: z
      .string()
      .min(1)
      .default("mongodb://localhost:27017/recovera"),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    APP_KEY_PEPPER: z.string().min(16).default("development-only-change-me"),
    BACKUP_STORAGE_ROOT: z
      .string()
      .min(1)
      .default(path.resolve(process.cwd(), "backups")),
    LOG_LEVEL: z.string().default("info"),
    MONGODB_RESTORE_IMAGE: z.string().default("mongo:8"),
    VERIFICATION_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(1),
    VERIFICATION_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
    VERIFICATION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(900_000),
    RESTORE_MEMORY_BYTES: z.coerce
      .number()
      .int()
      .min(268435456)
      .default(1073741824),
    RESTORE_CPU_NANO: z.coerce
      .number()
      .int()
      .min(100000000)
      .default(1000000000),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(`Invalid environment: ${parsed.error.message}`);
module.exports = {
  ...parsed.data,
  BACKUP_STORAGE_ROOT: path.resolve(parsed.data.BACKUP_STORAGE_ROOT),
};
