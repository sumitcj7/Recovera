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
    },
    verificationJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VerificationJob",
      required: true,
      unique: true,
    },
    finalStatus: {
      type: String,
      enum: ["passed", "passed_with_warnings", "failed", "restoration_failed"],
      required: true,
      index: true,
    },
    restoration: { type: mongoose.Schema.Types.Mixed, required: true },
    verification: { type: mongoose.Schema.Types.Mixed, required: true },
    resurrection: {
      type: mongoose.Schema.Types.Mixed,
      default: { status: "unavailable", findings: [] },
    },
    metrics: { type: mongoose.Schema.Types.Mixed, required: true },
    warnings: { type: [String], default: [] },
    toolVersions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ applicationId: 1, createdAt: -1 });
module.exports = mongoose.model("VerificationReport", schema);
