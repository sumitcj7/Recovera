const AppError = require("../utils/AppError");
module.exports = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success)
    return next(
      new AppError("Query validation failed", 400, "VALIDATION_ERROR"),
    );
  req.query = result.data;
  next();
};
