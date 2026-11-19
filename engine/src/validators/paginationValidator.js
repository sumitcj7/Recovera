const { z } = require("zod");
module.exports = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  collection: z.string().trim().max(120).optional(),
});
