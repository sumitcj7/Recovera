# Recovera

Recovera is an independent assurance service for verifying that existing MongoDB backups are recoverable. Phase 2 adds asynchronous isolated restoration: a host-run worker creates a temporary, network-disabled MongoDB container, restores a logical BSON backup, runs configured integrity checks, persists a report, and always removes the temporary container.

## Quick start

1. Copy `.env.example` to `.env`, set a unique `APP_KEY_PEPPER`, and create a controlled `backups/` directory with a backup subdirectory (for example `backups/daily-backup`).
2. Install dependencies: `npm install`.
3. Start MongoDB and Redis with Docker: `docker compose up -d mongo redis`.
4. Start the Engine: `npm start` (or `npm run dev`).
5. In a second terminal, start the verification worker: `npm run worker -w @recovera/engine`.
6. Run tests: `npm test`.

Start metadata dependencies with `docker compose up -d mongo redis`. The worker intentionally runs on the host, where it can access the local Docker daemon through its normal API. It is not mounted into Compose with `/var/run/docker.sock`, because that would give a container broad Docker-host control. The Engine mounts `./backups` read-only; it never writes backup data.

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

`PORT`, `MONGODB_URI`, `REDIS_URL`, `APP_KEY_PEPPER`, `BACKUP_STORAGE_ROOT`, `MONGODB_RESTORE_IMAGE`, `VERIFICATION_CONCURRENCY`, `VERIFICATION_ATTEMPTS`, `VERIFICATION_TIMEOUT_MS`, `RESTORE_MEMORY_BYTES`, `RESTORE_CPU_NANO`, and `LOG_LEVEL` are documented in `.env.example`. In production, use a long random `APP_KEY_PEPPER` kept in a secret manager and a non-public backup mount.

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

## Deletion tracking and resurrection alerts

Record deletion evidence explicitly after a successful production deletion:

```js
await recovera.recordDeletion({ collection: 'users', recordId: 'USER_123' });
```

For Mongoose, `createDeletionTrackingPlugin` supports successful `findOneAndDelete`, document `deleteOne`, and exact-`_id` query `deleteOne` operations. Raw-driver deletes, direct database writes, `deleteMany`, bulk deletes, and external systems can bypass it, so they are not claimed as automatically tracked. A verification only considers deletion records created after the registered backup timestamp; this avoids falsely labelling records deleted before a backup was taken. Set `metadata.databaseName` while registering the backup to enable detection.

Reports are available through `/api/v1/reports`, `/api/v1/reports/:id`, and `/api/v1/applications/me/statistics`. Final report states are `passed`, `passed_with_warnings`, `failed`, and `restoration_failed`.
