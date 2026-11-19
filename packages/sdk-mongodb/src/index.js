class RecoveraError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "RecoveraError";
    this.status = status;
    this.code = code;
  }
}
class Recovera {
  constructor({
    apiKey,
    baseURL = "http://localhost:8000/api/v1",
    timeout = 10000,
  }) {
    if (!apiKey) throw new TypeError("apiKey is required");
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
    this.timeout = timeout;
  }
  async request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "x-api-key": this.apiKey,
          "content-type": "application/json",
          ...(options.headers || {}),
        },
      });
      const body = response.status === 204 ? null : await response.json();
      if (!response.ok)
        throw new RecoveraError(
          body?.error?.message || "Engine request failed",
          response.status,
          body?.error?.code,
        );
      return body?.data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new RecoveraError("Engine request timed out", 408, "TIMEOUT");
      if (error instanceof RecoveraError) throw error;
      throw new RecoveraError(error.message, 0, "NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
    }
  }
  registerBackup(data) {
    return this.request("/backups", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  listBackups() {
    return this.request("/backups");
  }
  getBackup(id) {
    return this.request(`/backups/${encodeURIComponent(id)}`);
  }
  getApplication() {
    return this.request("/applications/me");
  }
  verifyBackup(backupId, options = {}) {
    return this.request(`/backups/${encodeURIComponent(backupId)}/verify`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }
  listVerificationJobs() {
    return this.request("/verification-jobs");
  }
  getVerificationJob(id) {
    return this.request(`/verification-jobs/${encodeURIComponent(id)}`);
  }
  getVerificationReport(id) {
    return this.request(`/verification-jobs/${encodeURIComponent(id)}/report`);
  }
  recordDeletion(data) {
    return this.request("/deletions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  listDeletionRecords(query = {}) {
    const params = new URLSearchParams(query);
    return this.request(`/deletions${params.size ? `?${params}` : ""}`);
  }
  listReports(query = {}) {
    const params = new URLSearchParams(query);
    return this.request(`/reports${params.size ? `?${params}` : ""}`);
  }
  getReport(id) {
    return this.request(`/reports/${encodeURIComponent(id)}`);
  }
  getStatistics() {
    return this.request("/applications/me/statistics");
  }
}
module.exports = { Recovera, RecoveraError, ...require("./mongoose") };
