const { z } = require("zod");
const register = z.object({
  name: z.string().trim().min(1).max(120),
  databaseType: z.literal("mongodb"),
  environment: z.enum(["development", "staging", "production"]),
  settings: z.record(z.unknown()).optional(),
});
const update = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    environment: z.enum(["development", "staging", "production"]).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");
module.exports = { register, update };
