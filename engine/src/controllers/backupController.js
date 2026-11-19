const service = require('../services/backupService');
const asyncHandler = require('../utils/asyncHandler');
exports.create = asyncHandler(async (req, res) => res.status(201).json({ data: await service.create(req.application.id, req.body) }));
exports.list = asyncHandler(async (req, res) => res.json({ data: await service.list(req.application.id) }));
exports.get = asyncHandler(async (req, res) => res.json({ data: await service.get(req.application.id, req.params.id) }));
exports.remove = asyncHandler(async (req, res) => { await service.remove(req.application.id, req.params.id); res.status(204).send(); });
