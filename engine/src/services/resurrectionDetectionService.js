const DeletionRecord = require("../models/DeletionRecord");
const { exec } = require("./dockerRestoreService");
const MAX_RECORDS = 10000;
function mongoLiteral(record) {
  return record.identifierType === "objectId"
    ? `new ObjectId(${JSON.stringify(record.recordIdentifier)})`
    : JSON.stringify(record.recordIdentifier);
}
async function exists(container, database, record) {
  const command = `db.getSiblingDB(${JSON.stringify(database)}).getCollection(${JSON.stringify(record.collectionName)}).findOne({_id:${mongoLiteral(record)}}) !== null`;
  const { stdout } = await exec(container, [
    "mongosh",
    "--quiet",
    "--eval",
    `console.log(JSON.stringify(${command}))`,
  ]);
  return JSON.parse(stdout.trim().split(/\r?\n/).pop()) === true;
}
async function detect({
  container,
  applicationId,
  backupCreatedAt,
  databaseName,
}) {
  if (!databaseName)
    return {
      status: "unavailable",
      examined: 0,
      detected: 0,
      findings: [],
      warnings: [
        "Resurrection detection requires backup metadata.databaseName.",
      ],
    };
  const records = await DeletionRecord.find({
    applicationId,
    deletedAt: { $gt: backupCreatedAt },
  })
    .sort({ deletedAt: 1 })
    .limit(MAX_RECORDS + 1);
  const warnings = [];
  if (records.length > MAX_RECORDS) {
    warnings.push(
      `Deletion tracking evaluation capped at ${MAX_RECORDS} records.`,
    );
    records.length = MAX_RECORDS;
  }
  const findings = [];
  for (const record of records) {
    if (await exists(container, databaseName, record))
      findings.push({
        type: "deleted_data_resurrection",
        collection: record.collectionName,
        recordIdentifier: record.recordIdentifier,
        identifierType: record.identifierType,
        deletedAt: record.deletedAt,
        detected: true,
      });
  }
  return {
    status: warnings.length ? "partial" : "complete",
    examined: records.length,
    detected: findings.length,
    affectedCollections: [...new Set(findings.map((f) => f.collection))],
    findings,
    warnings,
  };
}
module.exports = { detect };
