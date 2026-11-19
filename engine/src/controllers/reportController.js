const service = require("../services/reportService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
exports.list = asyncHandler(async (req, res) =>
  res.json({ data: await service.list(req.application.id, req.query) }),
);
exports.get = asyncHandler(async (req, res) => {
  const report = await service.get(req.application.id, req.params.id);
  if (!report)
    throw new AppError("Verification report not found", 404, "NOT_FOUND");
  res.json({ data: report });
});
exports.statistics = asyncHandler(async (req, res) =>
  res.json({ data: await service.statistics(req.application.id) }),
);
