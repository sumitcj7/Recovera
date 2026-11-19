const { z } = require("zod");
module.exports = z.object({
  name: z.string().trim().min(1).max(200),
  storageType: z.literal("local").default("local"),
  backupLocation: z.string().trim().min(1).max(1024),
  backupFormat: z.enum(["bson", "archive", "dump"]),
  databaseVersion: z.string().trim().max(80).optional(),
  backupCreatedAt: z.coerce.date(),
  size: z.coerce.number().nonnegative().optional(),
  checksum: z.string().trim().max(256).optional(),
  metadata: z.record(z.unknown()).optional(),
});
