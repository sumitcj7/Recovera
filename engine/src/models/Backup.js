const mongoose = require('mongoose');
const backupSchema = new mongoose.Schema({
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 }, storageType: { type: String, enum: ['local'], default: 'local' },
  backupLocation: { type: String, required: true }, backupFormat: { type: String, enum: ['bson', 'archive', 'dump'], required: true },
  databaseVersion: { type: String, trim: true }, backupCreatedAt: { type: Date, required: true }, size: { type: Number, min: 0 }, checksum: { type: String, trim: true },
  status: { type: String, enum: ['registered', 'deleted'], default: 'registered', index: true }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });
backupSchema.index({ applicationId: 1, createdAt: -1 });
module.exports = mongoose.model('Backup', backupSchema);
