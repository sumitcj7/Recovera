# Recovera

Recovera is an independent assurance service for verifying that existing MongoDB backups are recoverable. Phase 2 adds asynchronous isolated restoration: a host-run worker creates a temporary, network-disabled MongoDB container, restores a logical BSON backup, runs configured integrity checks, persists a report, and always removes the temporary container.

## Quick start

1. Copy `.env.example` to `.env`, set a unique `APP_KEY_PEPPER` of at least 32 characters, and create a controlled `backups/` directory with a backup subdirectory (for example `backups/daily-backup`).
2. Install dependencies: `npm install`.
3. Start MongoDB and Redis with Docker: `docker compose up -d mongo redis`.
4. Start the Engine and verification worker together: `npm start` (or `npm run dev`).
5. Run tests: `npm test`.

Start metadata dependencies with `docker compose up -d mongo redis`. For host-run development, `.env` uses `BACKUP_STORAGE_ROOT=./backups`, resolved relative to the repository root (for example `D:\Nodejs\Recovera\backups`), and the Engine starts its verification worker in the same host process. For the Compose Engine, the same host directory is mounted read-only at `/var/lib/recovera/backups`; its container-only `BACKUP_STORAGE_ROOT` is set accordingly and its embedded worker is disabled. Do not start the worker in a container with Docker's host socket unless you have separately reviewed that security boundary.

## API

All responses use `{ "data": ... }`; failures use `{ "error": { "code", "message" } }`.

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | No | Engine health |
| POST | `/api/v1/applications/register` | No | Register an app and receive its one-time key |
| GET/PATCH | `/api/v1/applications/me` | `x-api-key` | Read/update current app |
| POST/GET | `/api/v1/backups` | `x-api-key` | Register/list that app's backups |
| GET/DELETE | `/api/v1/backups/:id` | `x-api-key` | Read/soft-delete that app's backup |
| POST | `/api/v1/backups/:backupId/verify` | `x-api-key` | Queue isolated verification |
| GET | `/api/v1/verification-jobs` | `x-api-key` | List the app's jobs |
| GET | `/api/v1/verification-jobs/:id` | `x-api-key` | Read job status |
| GET | `/api/v1/verification-jobs/:id/report` | `x-api-key` | Read completed report |

Registration accepts `name`, `databaseType: "mongodb"`, `environment` (`development`, `staging`, or `production`), and optional `settings`. Preserve the returned `apiKey`: only its bcrypt hash is stored and it is never returned again.

Backup registration accepts `name`, `backupLocation`, `backupFormat` (`bson`, `archive`, `dump`), `backupCreatedAt`, and optional storage metadata. `backupLocation` must be an existing relative path under `BACKUP_STORAGE_ROOT`; absolute paths and traversal are rejected.

## SDK

```js
const { Recovera } = require('@recovera/sdk-mongodb');

const recovera = new Recovera({
  apiKey: process.env.RECOVERA_API_KEY,
  baseURL: 'http://localhost:8000/api/v1',
  timeout: 10_000
});

const backup = await recovera.registerBackup({
  name: 'Daily MongoDB Backup',
  backupLocation: 'daily-backup',
  backupFormat: 'bson',
  backupCreatedAt: new Date()
});
const backups = await recovera.listBackups();

const job = await recovera.verifyBackup(backup._id, {
  integrityChecks: [
    { type: 'documentCount', collection: 'users', minimumDocuments: 100 },
    { type: 'requiredFields', collection: 'users', fields: ['email', 'name'] }
  ],
  recoveryObjectives: { rtoMs: 300000 }
});

const report = await recovera.getVerificationReport(job._id);
```

The SDK exposes `RecoveraError` with `status` and `code` for consistent API, timeout, and network failures.

## Environment

`PORT`, `MONGODB_URI`, `REDIS_URL`, `APP_KEY_PEPPER`, `BACKUP_STORAGE_ROOT`, `MONGODB_RESTORE_IMAGE`, `VERIFICATION_CONCURRENCY`, `VERIFICATION_ATTEMPTS`, `VERIFICATION_TIMEOUT_MS`, `STUCK_JOB_THRESHOLD_MS`, `RESTORE_MEMORY_BYTES`, `RESTORE_CPU_NANO`, `RESTORE_PIDS_LIMIT`, `RUN_VERIFICATION_WORKER`, and `LOG_LEVEL` are documented in `.env.example`. Production startup rejects a missing, placeholder, or shorter-than-32-character `APP_KEY_PEPPER`. Keep the pepper in a secret manager and use a non-public backup mount.

New application keys include an indexed public key ID and a secret component. Recovera uses that ID to fetch one active application, then bcrypt-verifies the full key with the pepper. Existing keys without the ID retain a compatibility fallback until rotated.

## Demonstrate restoration

Create a BSON dump under `backups/` (for example, `mongodump --uri "$SOURCE_URI" --out backups/daily-backup`), register it with `backupLocation: "daily-backup"` and `metadata: { "databaseName": "mydb" }`, then queue a job with `verifyBackup`. Poll `getVerificationJob` until it is `completed` and fetch `getVerificationReport`. To demonstrate a failed restore, register a directory containing a deliberately truncated BSON/archive file; the report/job records `RESTORE_FAILED` after retries and the temporary container is removed. A missing collection or inadequate count produces a completed job with `verificationStatus: "failed"`, preserving the distinction from restoration failure.

See [architecture notes](docs/architecture.md) for the Phase 1 boundaries.

## Deletion tracking and resurrection alerts

Record deletion evidence explicitly after a successful production deletion:

```js
await recovera.recordDeletion({ collection: 'users', recordId: 'USER_123' });
```

For Mongoose, `createDeletionTrackingPlugin` supports successful `findOneAndDelete`, document `deleteOne`, and exact-`_id` query `deleteOne` operations. Raw-driver deletes, direct database writes, `deleteMany`, bulk deletes, and external systems can bypass it, so they are not claimed as automatically tracked. A verification only considers deletion records created after the registered backup timestamp; this avoids falsely labelling records deleted before a backup was taken. Set `metadata.databaseName` while registering the backup to enable detection.

Reports are available through `/api/v1/reports`, `/api/v1/reports/:id`, and `/api/v1/applications/me/statistics`. Final report states are `passed`, `passed_with_warnings`, `failed`, and `restoration_failed`; a confirmed resurrection is a `failed` report even when restoration itself succeeded.

