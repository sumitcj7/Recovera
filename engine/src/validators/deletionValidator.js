const { z } = require("zod");
const collection = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_.-]+$/);
const recordId = z.string().trim().min(1).max(256);
module.exports = z
  .object({
    collection,
    recordId,
    identifierType: z.enum(["string", "objectId"]).optional(),
    deletedAt: z.coerce.date().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.identifierType === "objectId" &&
      !/^[a-fA-F0-9]{24}$/.test(value.recordId)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordId"],
        message: "ObjectId identifiers must be 24 hexadecimal characters",
      });
  });
