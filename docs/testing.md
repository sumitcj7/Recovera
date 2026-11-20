# Testing

Run unit tests with `npm test`. Current unit tests mock MongoDB, Redis, BullMQ, and Docker where applicable; a passing unit run is not evidence of a successful real restore.

Run real integration testing with `npm run test:integration`. Before running it, verify `docker version`, `docker compose up -d mongo redis`, `mongodump --version`, and `mongorestore --version`. Set `INTEGRATION_MONGODB_URI=mongodb://localhost:27018/recovera_integration`; the runner refuses other database names. The suite creates a source database, runs real `mongodump`, registers it through HTTP, waits for BullMQ and Docker verification, checks tenant isolation, and asserts temporary-container cleanup.

Use `node scripts/create-demo.js` to seed the Compose MongoDB and create `backups/demo-backup-v1`. It requires Docker daemon access and MongoDB Database Tools on PATH.
