const { z } = require("zod");
module.exports = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum(["passed", "passed_with_warnings", "failed", "restoration_failed"])
    .optional(),
  sort: z.enum(["createdAt"]).default("createdAt"),
});
