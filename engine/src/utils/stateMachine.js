const AppError = require('./AppError');
const allowed = { queued: ['processing', 'cancelled', 'failed'], processing: ['restoring', 'queued', 'failed', 'cancelled'], restoring: ['verifying', 'queued', 'failed', 'cancelled'], verifying: ['completed', 'queued', 'failed', 'cancelled'], completed: [], failed: [], cancelled: [] };
function assertTransition(from, to) { if (!allowed[from]?.includes(to)) throw new AppError(`Invalid verification job transition: ${from} to ${to}`, 409, 'INVALID_JOB_STATE'); }
module.exports = { assertTransition };
