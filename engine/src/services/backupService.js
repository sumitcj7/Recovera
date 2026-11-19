const fs = require("fs");
const path = require("path");
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
async function create(applicationId, data) {
  return Backup.create({
    ...data,
    backupLocation: validateLocation(data.backupLocation),
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
  create,
  list,
  get,
  remove,
};
