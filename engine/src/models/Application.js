const mongoose = require("mongoose");
const applicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    databaseType: { type: String, enum: ["mongodb"], required: true },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      required: true,
    },
    apiKeyId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      select: false,
    },
    apiKeyHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.apiKeyHash;
        delete ret.apiKeyId;
        return ret;
      },
    },
  },
);
module.exports = mongoose.model("Application", applicationSchema);
