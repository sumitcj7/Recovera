const { exec } = require("./dockerRestoreService");
const AppError = require("../utils/AppError");
async function mongoJson(container, expression) {
  const { stdout } = await exec(container, [
    "mongosh",
    "--quiet",
    "--eval",
    `console.log(JSON.stringify(${expression}))`,
  ]);
  try {
    return JSON.parse(stdout.trim().split(/\r?\n/).pop());
  } catch (_) {
    throw new AppError(
      "Could not parse isolated MongoDB verification response",
      500,
      "VERIFICATION_FAILED",
    );
  }
}
async function verify(container, checks, expectedDatabase) {
  const began = Date.now();
  const results = [];
  const databases = await mongoJson(
    container,
    "db.adminCommand({listDatabases:1}).databases.map(d=>d.name)",
  );
  for (const check of checks) {
    const database = check.database || expectedDatabase;
    if (check.type === "databaseExists") {
      const actual = databases.includes(database);
      results.push({
        checkName: "databaseExists",
        expected: database,
        actual,
        status: actual ? "passed" : "failed",
        finding: actual ? undefined : "Database is missing",
      });
      continue;
    }
    if (!databases.includes(database)) {
      results.push({
        checkName: check.type,
        collection: check.collection,
        status: "failed",
        finding: "Database is missing",
      });
      continue;
    }
    const collectionNames = await mongoJson(
      container,
      `db.getSiblingDB(${JSON.stringify(database)}).getCollectionNames()`,
    );
    if (check.type === "collectionExists") {
      const actual = collectionNames.includes(check.collection);
      results.push({
        checkName: "collectionExists",
        collection: check.collection,
        expected: true,
        actual,
        status: actual ? "passed" : "failed",
        finding: actual ? undefined : "Collection is missing",
      });
      continue;
    }
    if (!collectionNames.includes(check.collection)) {
      results.push({
        checkName: check.type,
        collection: check.collection,
        status: "failed",
        finding: "Collection is missing",
      });
      continue;
    }
    if (check.type === "documentCount") {
      const actual = await mongoJson(
        container,
        `db.getSiblingDB(${JSON.stringify(database)}).getCollection(${JSON.stringify(check.collection)}).countDocuments({})`,
      );
      results.push({
        checkName: "documentCount",
        collection: check.collection,
        expected: { minimumDocuments: check.minimumDocuments },
        actual,
        status: actual >= check.minimumDocuments ? "passed" : "failed",
        finding:
          actual >= check.minimumDocuments
            ? undefined
            : "Document count is below minimum",
      });
      continue;
    }
    if (check.type === "requiredFields") {
      const missing = [];
      for (const field of check.fields) {
        const exists = await mongoJson(
          container,
          `db.getSiblingDB(${JSON.stringify(database)}).getCollection(${JSON.stringify(check.collection)}).findOne({${JSON.stringify(field)}:{$exists:true}}) !== null`,
        );
        if (!exists) missing.push(field);
      }
      results.push({
        checkName: "requiredFields",
        collection: check.collection,
        expected: check.fields,
        actual: { missing },
        status: missing.length ? "failed" : "passed",
        finding: missing.length
          ? "Required fields are absent from all documents"
          : undefined,
      });
    }
  }
  return {
    status: results.some((r) => r.status === "failed") ? "failed" : "passed",
    checks: results,
    durationMs: Date.now() - began,
  };
}
module.exports = { verify };
