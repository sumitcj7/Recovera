const { z } = require("zod");
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_.-]+$/);
const check = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("databaseExists"),
    database: identifier.optional(),
  }),
  z.object({ type: z.literal("collectionExists"), collection: identifier }),
  z.object({
    type: z.literal("documentCount"),
    collection: identifier,
    minimumDocuments: z.coerce.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("requiredFields"),
    collection: identifier,
    fields: z.array(identifier).min(1).max(50),
  }),
]);
module.exports = z.object({
  integrityChecks: z.array(check).max(100).default([]),
  recoveryObjectives: z
    .object({
      rtoMs: z.coerce.number().int().positive().max(3_600_000).optional(),
    })
    .default({}),
  incidentAt: z.coerce.date().optional(),
});
