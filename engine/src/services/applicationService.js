const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Application = require("../models/Application");
const env = require("../config/env");
const AppError = require("../utils/AppError");
function createApiKey() {
  return `rcv_live_${crypto.randomBytes(32).toString("base64url")}`;
}
async function register(data) {
  const apiKey = createApiKey();
  const apiKeyHash = await bcrypt.hash(`${apiKey}${env.APP_KEY_PEPPER}`, 12);
  const application = await Application.create({ ...data, apiKeyHash });
  return { application, apiKey };
}
async function authenticate(apiKey) {
  if (!apiKey || !apiKey.startsWith("rcv_live_"))
    throw new AppError("Invalid API credentials", 401, "INVALID_CREDENTIALS");
  const candidates = await Application.find({ status: "active" }).select(
    "+apiKeyHash",
  );
  for (const app of candidates)
    if (await bcrypt.compare(`${apiKey}${env.APP_KEY_PEPPER}`, app.apiKeyHash))
      return app;
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
module.exports = { createApiKey, register, authenticate, update };
