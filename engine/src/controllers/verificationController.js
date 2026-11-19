const service = require("../services/verificationJobService");
const asyncHandler = require("../utils/asyncHandler");
exports.create = asyncHandler(async (req, res) =>
  res
    .status(202)
    .json({
      data: await service.enqueue(
        req.application.id,
        req.params.backupId,
        req.body,
      ),
    }),
);
exports.list = asyncHandler(async (req, res) =>
  res.json({ data: await service.list(req.application.id) }),
);
exports.get = asyncHandler(async (req, res) =>
  res.json({ data: await service.get(req.application.id, req.params.id) }),
);
exports.report = asyncHandler(async (req, res) =>
  res.json({
    data: await service.getReport(req.application.id, req.params.id),
  }),
);
