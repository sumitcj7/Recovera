const AppError = require("../utils/AppError");
const buckets = new Map();
module.exports =
  ({ windowMs = 60_000, max = 120 } = {}) =>
  (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);
    const state =
      !bucket || bucket.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : bucket;
    state.count += 1;
    buckets.set(key, state);
    if (state.count > max) {
      res.set("Retry-After", String(Math.ceil((state.resetAt - now) / 1000)));
      return next(new AppError("Too many requests", 429, "RATE_LIMITED"));
    }
    next();
  };
