const VerificationReport = require("../models/VerificationReport");
const VerificationJob = require("../models/VerificationJob");
async function list(
  applicationId,
  { page = 1, limit = 25, status, sort = "createdAt" } = {},
) {
  const filter = { applicationId };
  if (status) filter.finalStatus = status;
  const direction = sort === "createdAt" ? -1 : 1;
  const [data, total] = await Promise.all([
    VerificationReport.find(filter)
      .sort({ [sort]: direction })
      .skip((page - 1) * limit)
      .limit(limit),
    VerificationReport.countDocuments(filter),
  ]);
  return {
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
async function get(applicationId, id) {
  return VerificationReport.findOne({ _id: id, applicationId });
}
async function statistics(applicationId) {
  const [reports, jobs] = await Promise.all([
    VerificationReport.aggregate([
      { $match: { applicationId } },
      { $group: { _id: "$finalStatus", count: { $sum: 1 } } },
    ]),
    VerificationJob.countDocuments({ applicationId }),
  ]);
  return {
    jobs,
    reports: Object.fromEntries(reports.map((item) => [item._id, item.count])),
  };
}
module.exports = { list, get, statistics };
