const logger = require("../config/logger");
module.exports = (err, req, res, next) => {
  const status = err.isOperational ? err.statusCode : 500;
  if (status >= 500)
    logger.error({ err, requestId: req.id }, "Unhandled request error");
  res
    .status(status)
    .json({
      error: {
        code: err.code || "INTERNAL_ERROR",
        message: err.isOperational ? err.message : "Internal server error",
      },
    });
};
