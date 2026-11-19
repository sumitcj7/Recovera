const VerificationJob = require("../models/VerificationJob");
const VerificationReport = require("../models/VerificationReport");
const backupService = require("./backupService");
const { verificationQueue } = require("../config/queue");
const AppError = require("../utils/AppError");
const { assertTransition } = require("../utils/stateMachine");
async function enqueue(applicationId, backupId, options) {
  await backupService.get(applicationId, backupId);
  const job = await VerificationJob.create({
    applicationId,
    backupId,
    integrityChecks: options.integrityChecks,
    recoveryObjectives: options.recoveryObjectives,
    incidentAt: options.incidentAt,
    queuedAt: new Date(),
  });
  try {
    const queued = await verificationQueue.add(
      "verify-backup",
      { verificationJobId: String(job._id) },
      { jobId: String(job._id) },
    );
    job.queueJobId = String(queued.id);
    await job.save();
    return job;
  } catch (err) {
    await VerificationJob.deleteOne({ _id: job._id });
    throw new AppError(
      "Verification could not be queued",
      503,
      "QUEUE_UNAVAILABLE",
    );
  }
}
async function get(applicationId, id) {
  const job = await VerificationJob.findOne({ _id: id, applicationId });
  if (!job) throw new AppError("Verification job not found", 404, "NOT_FOUND");
  return job;
}
async function list(applicationId) {
  return VerificationJob.find({ applicationId }).sort({ createdAt: -1 });
}
async function getReport(applicationId, id) {
  const job = await get(applicationId, id);
  if (!job.reportId)
    throw new AppError(
      "Verification report is not available",
      404,
      "REPORT_NOT_AVAILABLE",
    );
  const report = await VerificationReport.findOne({
    _id: job.reportId,
    applicationId,
  });
  if (!report)
    throw new AppError("Verification report not found", 404, "NOT_FOUND");
  return report;
}
async function transition(job, next, updates = {}) {
  assertTransition(job.status, next);
  Object.assign(job, updates, { status: next });
  await job.save();
  return job;
}
module.exports = { enqueue, get, list, getReport, transition };
