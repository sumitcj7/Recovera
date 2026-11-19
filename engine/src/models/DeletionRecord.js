const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    collectionName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    recordIdentifier: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    identifierType: {
      type: String,
      enum: ["string", "objectId"],
      default: "string",
      required: true,
    },
    deletedAt: { type: Date, required: true, default: Date.now, index: true },
    source: {
      type: String,
      enum: ["sdk", "mongoose-plugin", "api"],
      default: "sdk",
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false },
);
schema.index(
  {
    applicationId: 1,
    collectionName: 1,
    recordIdentifier: 1,
    identifierType: 1,
  },
  { unique: true },
);
schema.index({ applicationId: 1, deletedAt: -1 });
module.exports = mongoose.model("DeletionRecord", schema);
