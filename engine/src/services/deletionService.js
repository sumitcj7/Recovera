const DeletionRecord = require("../models/DeletionRecord");
const AppError = require("../utils/AppError");
async function record(applicationId, data, source = "api") {
  const identifierType = data.identifierType || "string";
  try {
    return await DeletionRecord.findOneAndUpdate(
      {
        applicationId,
        collectionName: data.collection,
        recordIdentifier: data.recordId,
        identifierType,
      },
      {
        $setOnInsert: {
          applicationId,
          collectionName: data.collection,
          recordIdentifier: data.recordId,
          identifierType,
          deletedAt: data.deletedAt || new Date(),
          source,
          metadata: data.metadata || {},
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
  } catch (err) {
    if (err.code === 11000)
      throw new AppError(
        "Deletion record already exists",
        409,
        "DUPLICATE_DELETION_RECORD",
      );
    throw err;
  }
}
async function list(applicationId, { page = 1, limit = 25, collection } = {}) {
  const filter = { applicationId };
  if (collection) filter.collectionName = collection;
  const [data, total] = await Promise.all([
    DeletionRecord.find(filter)
      .sort({ deletedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    DeletionRecord.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
module.exports = { record, list };
