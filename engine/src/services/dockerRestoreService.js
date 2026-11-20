const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Docker = require("dockerode");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const backupService = require("./backupService");
const docker = new Docker();

function abortError() {
  return new AppError("Verification job was cancelled or timed out", 504, "VERIFICATION_TIMEOUT");
}
function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function withTimeout(promise, ms, message, signal) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new AppError(message, 504, "RESTORE_TIMEOUT")),
        ms,
      );
    }),
    new Promise((_, reject) => {
      if (!signal) return;
      if (signal.aborted) return reject(abortError());
      signal.addEventListener("abort", () => reject(abortError()), { once: true });
    }),
  ]).finally(() => clearTimeout(timer));
}
async function pullImage(image) {
  try {
    await docker.getImage(image).inspect();
  } catch (_) {
    const stream = await docker.pull(image);
    await new Promise((resolve, reject) =>
      docker.modem.followProgress(stream, (err) =>
        err ? reject(err) : resolve(),
      ),
    );
  }
}
async function exec(container, cmd, timeout = env.VERIFICATION_TIMEOUT_MS, signal) {
  throwIfAborted(signal);
  const instance = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await instance.start({ hijack: true, stdin: false });
  let stdout = "";
  let stderr = "";
  await withTimeout(
    new Promise((resolve, reject) => {
      container.modem.demuxStream(
        stream,
        {
          write: (b) => {
            stdout += b.toString();
          },
        },
        {
          write: (b) => {
            stderr += b.toString();
          },
        },
      );
      stream.on("end", resolve);
      stream.on("error", reject);
    }),
    timeout,
    "Container command timed out",
    signal,
  );
  const result = await instance.inspect();
  if (result.ExitCode !== 0)
    throw new AppError("Restore command failed", 422, "RESTORE_FAILED");
  return { stdout: stdout.slice(-10_000), stderr: stderr.slice(-10_000) };
}
async function waitForMongo(container, signal) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await exec(
        container,
        ["mongosh", "--quiet", "--eval", "db.adminCommand({ ping: 1 }).ok"],
        10_000,
        signal,
      );
      return;
    } catch (err) {
      lastError = err;
      await withTimeout(new Promise((resolve) => setTimeout(resolve, 1000)), 2000, "MongoDB startup timed out", signal);
    }
  }
  throw new AppError(
    `Temporary MongoDB did not become ready: ${lastError?.message || "unknown error"}`,
    504,
    "RESTORE_TIMEOUT",
  );
}
async function cleanup(container) {
  if (!container) return;
  try {
    await container.remove({ force: true, v: true });
  } catch (_) {
    /* recovery sweep handles interrupted cleanup */
  }
}
async function restore(backup, { signal, workerId } = {}) {
  throwIfAborted(signal);
  const source = backupService.validateBackupContent(backup.backupLocation, backup.backupFormat);
  backupService.verifyChecksum(source, backup.checksum);
  const stats = fs.statSync(source);
  const name = `recovera-verify-${crypto.randomBytes(12).toString("hex")}`;
  let container;
  const started = Date.now();
  try {
    await pullImage(env.MONGODB_RESTORE_IMAGE);
    container = await docker.createContainer({
      Image: env.MONGODB_RESTORE_IMAGE,
      name,
      Labels: {
        "recovera.managed": "true",
        "recovera.purpose": "verification",
        "recovera.worker-id": workerId || "unknown",
      },
      HostConfig: {
        NetworkMode: "none",
        Memory: env.RESTORE_MEMORY_BYTES,
        NanoCPUs: env.RESTORE_CPU_NANO,
        PidsLimit: env.RESTORE_PIDS_LIMIT,
        SecurityOpt: ["no-new-privileges:true"],
        ReadonlyRootfs: false,
        Binds: [`${env.BACKUP_STORAGE_ROOT}:/backups:ro`],
      },
      ExposedPorts: {},
    });
    await container.start();
    await waitForMongo(container, signal);
    throwIfAborted(signal);
    const mountedPath = path.posix.join(
      "/backups",
      backup.backupLocation.split(path.sep).join("/"),
    );
    const command = stats.isDirectory()
      ? ["mongorestore", "--host", "localhost", "--drop", mountedPath]
      : [
          "mongorestore",
          "--host",
          "localhost",
          "--drop",
          `--archive=${mountedPath}`,
        ];
    const output = await exec(container, command, env.VERIFICATION_TIMEOUT_MS, signal);
    return {
      container,
      cleanup: () => cleanup(container),
      durationMs: Date.now() - started,
      logs: output,
      mongoVersion: env.MONGODB_RESTORE_IMAGE,
    };
  } catch (err) {
    await cleanup(container);
    throw err;
  }
}
async function cleanupAbandoned(workerId) {
  if (!workerId) return;
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ["recovera.managed=true", `recovera.worker-id=${workerId}`] },
  });
  await Promise.all(
    containers.map((item) => cleanup(docker.getContainer(item.Id))),
  );
}
module.exports = { restore, cleanupAbandoned, exec, abortError };
