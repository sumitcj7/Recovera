const VerificationJob = require("../models/VerificationJob");
const VerificationReport = require("../models/VerificationReport");
const backupService = require("./backupService");
const { verificationQueue } = require("../config/queue");
const AppError = require("../utils/AppError");
const { assertTransition } = require("../utils/stateMachine");
const env = require("../config/env");
async function enqueue(applicationId, backupId, options) {
  await backupService.get(applicationId, backupId);
  const activeJobKey = `${applicationId}:${backupId}`;
  let job;
  try {
    job = await VerificationJob.create({
      applicationId,
      backupId,
      activeJobKey,
      integrityChecks: options.integrityChecks,
      recoveryObjectives: options.recoveryObjectives,
      incidentAt: options.incidentAt,
      queuedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000)
      throw new AppError(
        "A verification job is already in progress for this backup",
        409,
        "VERIFICATION_ALREADY_IN_PROGRESS",
      );
    throw err;
  }
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
  if (["completed", "failed", "cancelled"].includes(next))
    job.activeJobKey = undefined;
  await job.save();
  return job;
}
async function reconcileQueuedJobs() {
  const queuedJobs = await VerificationJob.find({ status: "queued" }).limit(
    500,
  );
  let recovered = 0;
  for (const job of queuedJobs) {
    const queued =
      job.queueJobId && (await verificationQueue.getJob(job.queueJobId));
    if (queued) continue;
    try {
      const replacement = await verificationQueue.add(
        "verify-backup",
        { verificationJobId: String(job._id) },
        { jobId: String(job._id) },
      );
      job.queueJobId = String(replacement.id);
      await job.save();
      recovered += 1;
    } catch (_) {
      // The existing queued state remains truthful and will be retried on the next reconciliation.
    }
  }
  return recovered;
}
async function markStuckJobs() {
  const cutoff = new Date(Date.now() - env.STUCK_JOB_THRESHOLD_MS);
  const jobs = await VerificationJob.find({
    status: { $in: ["processing", "restoring", "verifying"] },
    startedAt: { $lt: cutoff },
  }).limit(500);
  for (const job of jobs)
    await transition(job, "failed", {
      completedAt: new Date(),
      error: {
        code: "STUCK_JOB",
        message: "Job exceeded the configured stuck-job threshold",
      },
    });
  return jobs.length;
}
module.exports = {
  enqueue,
  get,
  list,
  getReport,
  transition,
  reconcileQueuedJobs,
  markStuckJobs,
};
