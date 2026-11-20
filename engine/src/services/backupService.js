const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Backup = require("../models/Backup");
const env = require("../config/env");
const AppError = require("../utils/AppError");
function validateLocation(location) {
  const root = path.resolve(env.BACKUP_STORAGE_ROOT);
  if (path.isAbsolute(location) || location.includes("\0"))
    throw new AppError(
      "backupLocation must be a relative path",
      400,
      "INVALID_BACKUP_LOCATION",
    );
  const resolved = path.resolve(root, location);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))
    throw new AppError(
      "Backup location is outside approved storage",
      400,
      "INVALID_BACKUP_LOCATION",
    );
  if (!fs.existsSync(resolved))
    throw new AppError(
      "Backup location does not exist in approved storage",
      400,
      "INVALID_BACKUP_LOCATION",
    );
  return path.relative(root, resolved);
}
function resolveLocation(location) {
  validateLocation(location);
  return path.resolve(env.BACKUP_STORAGE_ROOT, location);
}
function hasBsonFile(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".bson")) return true;
    if (entry.isDirectory() && hasBsonFile(candidate)) return true;
  }
  return false;
}
function validateBackupContent(location, backupFormat) {
  const resolved = resolveLocation(location);
  const stats = fs.statSync(resolved);
  if (backupFormat === "archive" && !stats.isFile())
    throw new AppError(
      "Archive backups must reference a file",
      400,
      "INVALID_BACKUP_CONTENT",
    );
  if (
    ["dump", "bson"].includes(backupFormat) &&
    (!stats.isDirectory() || !hasBsonFile(resolved))
  )
    throw new AppError(
      "Logical dump must contain at least one BSON file",
      400,
      "INVALID_BACKUP_CONTENT",
    );
  return resolved;
}
function verifyChecksum(resolved, expectedChecksum) {
  if (!expectedChecksum) return;
  const match = /^sha256:([a-fA-F0-9]{64})$/.exec(expectedChecksum);
  if (!match)
    throw new AppError(
      "checksum must use sha256:<64 hexadecimal characters>",
      400,
      "INVALID_CHECKSUM",
    );
  if (!fs.statSync(resolved).isFile())
    throw new AppError(
      "Checksums are currently supported for archive files only",
      400,
      "UNSUPPORTED_CHECKSUM_TARGET",
    );
  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolved))
    .digest("hex");
  if (actual.toLowerCase() !== match[1].toLowerCase())
    throw new AppError(
      "Backup checksum does not match",
      422,
      "CHECKSUM_MISMATCH",
    );
}
async function create(applicationId, data) {
  const backupLocation = validateLocation(data.backupLocation);
  const resolved = validateBackupContent(backupLocation, data.backupFormat);
  verifyChecksum(resolved, data.checksum);
  return Backup.create({
    ...data,
    backupLocation,
    applicationId,
  });
}
async function list(applicationId) {
  return Backup.find({ applicationId, status: { $ne: "deleted" } }).sort({
    createdAt: -1,
  });
}
async function get(applicationId, id) {
  const backup = await Backup.findOne({
    _id: id,
    applicationId,
    status: { $ne: "deleted" },
  });
  if (!backup) throw new AppError("Backup not found", 404, "NOT_FOUND");
  return backup;
}
async function remove(applicationId, id) {
  const backup = await Backup.findOneAndUpdate(
    { _id: id, applicationId, status: { $ne: "deleted" } },
    { status: "deleted" },
    { new: true },
  );
  if (!backup) throw new AppError("Backup not found", 404, "NOT_FOUND");
  return backup;
}
module.exports = {
  validateLocation,
  resolveLocation,
  validateBackupContent,
  verifyChecksum,
  create,
  list,
  get,
  remove,
};
