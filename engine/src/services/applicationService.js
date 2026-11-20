const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Application = require("../models/Application");
const env = require("../config/env");
const AppError = require("../utils/AppError");
function createApiKey() {
  const keyId = crypto.randomBytes(12).toString("hex");
  const secret = crypto.randomBytes(32).toString("base64url");
  return `rcv_live_${keyId}.${secret}`;
}
function getApiKeyId(apiKey) {
  const match = /^rcv_live_([a-f0-9]{24})\.[A-Za-z0-9_-]{40,}$/.exec(
    apiKey || "",
  );
  return match?.[1];
}
async function register(data) {
  const apiKey = createApiKey();
  const apiKeyId = getApiKeyId(apiKey);
  const apiKeyHash = await bcrypt.hash(`${apiKey}${env.APP_KEY_PEPPER}`, 12);
  const application = await Application.create({
    ...data,
    apiKeyId,
    apiKeyHash,
  });
  return { application, apiKey };
}
async function authenticate(apiKey) {
  if (!apiKey || !apiKey.startsWith("rcv_live_"))
    throw new AppError("Invalid API credentials", 401, "INVALID_CREDENTIALS");
  const apiKeyId = getApiKeyId(apiKey);
  if (apiKeyId) {
    const app = await Application.findOne({
      apiKeyId,
      status: "active",
    }).select("+apiKeyHash");
    if (
      app &&
      (await bcrypt.compare(`${apiKey}${env.APP_KEY_PEPPER}`, app.apiKeyHash))
    )
      return app;
  } else {
    // Existing keys created before apiKeyId was introduced remain usable until rotated.
    const candidates = await Application.find({
      status: "active",
      apiKeyId: { $exists: false },
    }).select("+apiKeyHash");
    for (const app of candidates)
      if (
        await bcrypt.compare(`${apiKey}${env.APP_KEY_PEPPER}`, app.apiKeyHash)
      )
        return app;
  }
  throw new AppError("Invalid API credentials", 401, "INVALID_CREDENTIALS");
}
async function update(id, data) {
  const application = await Application.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!application)
    throw new AppError("Application not found", 404, "NOT_FOUND");
  return application;
}
module.exports = { createApiKey, getApiKeyId, register, authenticate, update };
