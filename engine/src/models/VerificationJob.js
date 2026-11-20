const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    backupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Backup",
      required: true,
      index: true,
    },
    queueJobId: { type: String, unique: true, sparse: true },
    activeJobKey: { type: String, unique: true, sparse: true, select: false },
    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "restoring",
        "verifying",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },
    queuedAt: { type: Date, default: Date.now },
    startedAt: Date,
    completedAt: Date,
    restorationStatus: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "running", "passed", "failed", "skipped"],
      default: "pending",
    },
    restorationDurationMs: Number,
    verificationDurationMs: Number,
    totalDurationMs: Number,
    error: { code: String, message: String, details: String },
    retryCount: { type: Number, default: 0, min: 0 },
    integrityChecks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    recoveryObjectives: { type: mongoose.Schema.Types.Mixed, default: {} },
    incidentAt: Date,
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VerificationReport",
    },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ applicationId: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model("VerificationJob", schema);
