const service = require('../services/applicationService');
const asyncHandler = require('../utils/asyncHandler');
exports.register = asyncHandler(async (req, res) => { const { application, apiKey } = await service.register(req.body); res.status(201).json({ data: { application, apiKey } }); });
exports.me = asyncHandler(async (req, res) => res.json({ data: req.application }));
exports.updateMe = asyncHandler(async (req, res) => res.json({ data: await service.update(req.application.id, req.body) }));
