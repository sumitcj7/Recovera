// Optional Mongoose integration. Explicit recordDeletion remains the reliable API.
function createDeletionTrackingPlugin(
  recovera,
  { collection, identifierType = "string" } = {},
) {
  if (!recovera?.recordDeletion)
    throw new TypeError("A Recovera SDK instance is required");
  if (!collection) throw new TypeError("collection is required");
  const record = async (document) => {
    if (!document?._id) return;
    await recovera.recordDeletion({
      collection,
      recordId: String(document._id),
      identifierType: identifierType === "objectId" ? "objectId" : "string",
    });
  };
  return (schema) => {
    schema.post("findOneAndDelete", async function (document) {
      await record(document);
    });
    schema.post(
      "deleteOne",
      { document: true, query: false },
      async function () {
        await record(this);
      },
    );
    // Query deleteOne only records safely when its exact _id predicate is available and deletion succeeded.
    schema.post(
      "deleteOne",
      { document: false, query: true },
      async function (result) {
        const id = this.getFilter()?._id;
        if (
          result?.deletedCount === 1 &&
          (typeof id === "string" || id?.toString)
        )
          await recovera.recordDeletion({
            collection,
            recordId: String(id),
            identifierType:
              identifierType === "objectId" ? "objectId" : "string",
          });
      },
    );
    // deleteMany is intentionally unsupported: a predicate does not safely identify every deleted record.
  };
}
module.exports = { createDeletionTrackingPlugin };
