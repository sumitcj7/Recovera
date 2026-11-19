const { Worker } = require("bullmq");
const env = require("../config/env");
const logger = require("../config/logger");
const { queueConnection } = require("../config/queue");
const VerificationJob = require("../models/VerificationJob");
const VerificationReport = require("../models/VerificationReport");
const Backup = require("../models/Backup");
const { transition } = require("../services/verificationJobService");
const restoreService = require("../services/dockerRestoreService");
const integrityService = require("../services/integrityService");
const resurrectionService = require("../services/resurrectionDetectionService");
const AppError = require("../utils/AppError");
function errorShape(err) {
  return {
    code: err.code || "WORKER_FAILURE",
    message: err.message,
    details: err.stderr?.slice(-2000),
  };
}
async function processVerification(queueJob) {
  const job = await VerificationJob.findById(queueJob.data.verificationJobId);
  if (!job || job.status === "cancelled" || job.status === "completed") return;
  const backup = await Backup.findOne({
    _id: job.backupId,
    applicationId: job.applicationId,
    status: { $ne: "deleted" },
  });
  if (!backup)
    throw new AppError(
      "Registered backup no longer exists",
      404,
      "BACKUP_NOT_FOUND",
    );
  let restoration;
  const totalStarted = Date.now();
  try {
    await transition(job, "processing", {
      startedAt: new Date(),
      retryCount: queueJob.attemptsMade,
    });
    await transition(job, "restoring", { restorationStatus: "running" });
    restoration = await restoreService.restore(backup);
    await transition(job, "verifying", {
      restorationStatus: "completed",
      restorationDurationMs: restoration.durationMs,
      verificationStatus: "running",
    });
    const verification = await integrityService.verify(
      restoration.container,
      job.integrityChecks,
      backup.metadata?.databaseName,
    );
    const resurrection = await resurrectionService.detect({
      container: restoration.container,
      applicationId: job.applicationId,
      backupCreatedAt: backup.backupCreatedAt,
      databaseName: backup.metadata?.databaseName,
    });
    const totalDurationMs = Date.now() - totalStarted;
    const rtoMs = job.recoveryObjectives?.rtoMs;
    const rpoMs = job.incidentAt
      ? Math.max(
          0,
          new Date(job.incidentAt).getTime() -
            new Date(backup.backupCreatedAt).getTime(),
        )
      : undefined;
    const warnings = resurrection.warnings || [];
    const finalStatus =
      verification.status === "failed" || resurrection.detected
        ? "failed"
        : warnings.length
          ? "passed_with_warnings"
          : "passed";
    const report = await VerificationReport.create({
      applicationId: job.applicationId,
      backupId: backup._id,
      verificationJobId: job._id,
      finalStatus,
      restoration: {
        status: "completed",
        durationMs: restoration.durationMs,
        logs: restoration.logs,
      },
      verification: {
        status: verification.status,
        totalChecks: verification.checks.length,
        passedChecks: verification.checks.filter(
          (check) => check.status === "passed",
        ).length,
        failedChecks: verification.checks.filter(
          (check) => check.status === "failed",
        ).length,
        checks: verification.checks,
        durationMs: verification.durationMs,
      },
      resurrection,
      warnings,
      metrics: {
        restorationDurationMs: restoration.durationMs,
        verificationDurationMs: verification.durationMs,
        totalDurationMs,
        backupSize: backup.size,
        backupAgeMs: Date.now() - new Date(backup.backupCreatedAt).getTime(),
        rto: rtoMs
          ? {
              targetMs: rtoMs,
              actualMs: restoration.durationMs,
              status: restoration.durationMs <= rtoMs ? "met" : "exceeded",
            }
          : { status: "not_configured" },
        rpo: job.incidentAt
          ? {
              estimatedGapMs: rpoMs,
              referenceTime: job.incidentAt,
              backupCreatedAt: backup.backupCreatedAt,
              status: "estimated",
            }
          : { status: "not_calculated" },
      },
      toolVersions: { mongoImage: restoration.mongoVersion },
    });
    await transition(job, "completed", {
      completedAt: new Date(),
      verificationStatus: verification.status,
      verificationDurationMs: verification.durationMs,
      totalDurationMs,
      reportId: report._id,
    });
  } catch (err) {
    const finalAttempt = queueJob.attemptsMade >= (queueJob.opts.attempts || 1);
    if (finalAttempt) {
      if (!["completed", "cancelled", "failed"].includes(job.status)) {
        const totalDurationMs = Date.now() - totalStarted;
        const report = await VerificationReport.create({
          applicationId: job.applicationId,
          backupId: job.backupId,
          verificationJobId: job._id,
          finalStatus: "restoration_failed",
          restoration: {
            status: "failed",
            durationMs: restoration?.durationMs,
            error: errorShape(err),
          },
          verification: { status: "skipped", checks: [] },
          resurrection: { status: "unavailable", findings: [] },
          metrics: {
            totalDurationMs,
            backupSize: backup.size,
            rto: { status: "not_assessed" },
            rpo: { status: "not_calculated" },
          },
        });
        await transition(job, "failed", {
          completedAt: new Date(),
          restorationStatus:
            job.restorationStatus === "running"
              ? "failed"
              : job.restorationStatus,
          verificationStatus:
            job.verificationStatus === "running"
              ? "skipped"
              : job.verificationStatus,
          totalDurationMs,
          error: errorShape(err),
          retryCount: queueJob.attemptsMade,
          reportId: report._id,
        });
      }
    } else {
      await transition(job, "queued", {
        retryCount: queueJob.attemptsMade,
        error: errorShape(err),
      });
    }
    throw err;
  } finally {
    if (restoration) await restoration.cleanup();
  }
}
function createWorker() {
  const runWithTimeout = async (job) => {
    let timer;
    try {
      return await Promise.race([
        processVerification(job),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new AppError(
                  "Verification job timed out",
                  504,
                  "VERIFICATION_TIMEOUT",
                ),
              ),
            env.VERIFICATION_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const worker = new Worker("verification", runWithTimeout, {
    connection: queueConnection,
    concurrency: env.VERIFICATION_CONCURRENCY,
    lockDuration: env.VERIFICATION_TIMEOUT_MS,
  });
  worker.on("failed", (job, err) =>
    logger.error(
      { verificationJobId: job?.data?.verificationJobId, err },
      "Verification job attempt failed",
    ),
  );
  worker.on("completed", (job) =>
    logger.info(
      { verificationJobId: job.data.verificationJobId },
      "Verification job completed",
    ),
  );
  return worker;
}
module.exports = { createWorker, processVerification };
