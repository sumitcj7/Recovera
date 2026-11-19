# Phase 1 architecture

The repository is an npm workspace with two independent packages: `engine` (Express API) and `packages/sdk-mongodb` (HTTP client). The SDK never imports Engine models or accesses the metadata database.

The Engine follows controller → service → model layering. Routes contain composition only; Zod validates request bodies; a centralized error handler serializes operational failures. Pino redacts credential headers. Mongoose owns metadata and Redis/BullMQ delivers background verification jobs.

## Phase 2 verification path

`POST /backups/:id/verify` first validates tenant ownership of the registered backup, persists a `VerificationJob`, and atomically submits its identifier to BullMQ. The independent worker executes every long-running operation. It uses Dockerode—not a shell command—to create a randomly named MongoDB container with no published ports, `NetworkMode: none`, capped CPU/memory, and a read-only mount of the approved backup root. `mongorestore` runs inside that container with fixed argument arrays.

The worker records `queued → processing → restoring → verifying → completed`; retryable failures return to `queued`, and terminal operational failures become `failed`. A restoration can succeed while integrity verification fails; in that case the job is `completed`, `restorationStatus` is `completed`, and `verificationStatus` is `failed`. A `VerificationReport` stores checks, timings, RTO/RPO calculations, and redacted operational output. No document contents are stored in reports.

Temporary containers carry a Recovera ownership label and are force-removed in a `finally` block. Worker startup sweeps labeled containers left behind by an interrupted worker. The original backup mount remains read-only throughout.

Every authenticated request resolves an active `Application` from its API key. Backup queries always include `applicationId`, providing tenant isolation even when a caller submits another tenant's document id. Backup paths are resolved below one configured root and must already exist there; Docker mounts that root read-only.
