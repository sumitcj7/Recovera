const path = require("path");
const { z } = require("zod");
const projectRoot = path.resolve(__dirname, "../../..");
// This module lives at engine/src/config. Resolve the workspace root explicitly
// so npm workspace scripts load Recovera's shared .env rather than engine/.env.
require("dotenv").config({ path: path.join(projectRoot, ".env") });

const insecurePeppers = new Set([
  "development-only-change-me",
  "replace-with-a-long-random-secret",
  "generate-a-unique-secret-before-starting-the-engine",
]);
function isSecurePepper(value) {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    !insecurePeppers.has(value.toLowerCase())
  );
}

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
    APP_KEY_PEPPER: z.string().min(1),
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
    STUCK_JOB_THRESHOLD_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(7_200_000)
      .default(1_800_000),
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
    RESTORE_PIDS_LIMIT: z.coerce.number().int().min(32).max(4096).default(256),
    WORKER_ID: z.string().trim().min(1).max(100).optional(),
    RUN_VERIFICATION_WORKER: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(`Invalid environment: ${parsed.error.message}`);
if (parsed.data.NODE_ENV === "production" && !isSecurePepper(parsed.data.APP_KEY_PEPPER))
  throw new Error(
    "APP_KEY_PEPPER must be a unique, non-placeholder secret of at least 32 characters in production",
  );
module.exports = {
  ...parsed.data,
  BACKUP_STORAGE_ROOT: path.resolve(projectRoot, parsed.data.BACKUP_STORAGE_ROOT),
  isSecurePepper,
};
