const express = require("express");
const pinoHttp = require("pino-http");
const cors = require("cors");
const logger = require("./config/logger");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const rateLimit = require("./middlewares/rateLimit");
const app = express();
app.disable("x-powered-by");
app.use(
  pinoHttp({
    logger,
    redact: ["req.headers.x-api-key", "req.headers.authorization"],
  }),
);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit());
app.get("/api/v1/health", (req, res) =>
  res.json({ data: { status: "ok", service: "recovera-engine" } }),
);
app.use("/api/v1/applications", require("./routes/applicationRoutes"));
app.use("/api/v1/backups", require("./routes/backupRoutes"));
app.use("/api/v1/deletions", require("./routes/deletionRoutes"));
app.use("/api/v1/reports", require("./routes/reportRoutes"));
app.use("/api/v1", require("./routes/verificationRoutes"));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
