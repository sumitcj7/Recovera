const applicationService = require('../services/applicationService');
const asyncHandler = require('../utils/asyncHandler');
module.exports = asyncHandler(async (req, res, next) => { req.application = await applicationService.authenticate(req.get('x-api-key')); next(); });
