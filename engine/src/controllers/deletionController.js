const service = require("../services/deletionService");
const asyncHandler = require("../utils/asyncHandler");
exports.record = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({ data: await service.record(req.application.id, req.body) }),
);
exports.list = asyncHandler(async (req, res) =>
  res.json({ data: await service.list(req.application.id, req.query) }),
);
