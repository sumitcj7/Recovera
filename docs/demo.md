# Live demo

1. Set a unique `APP_KEY_PEPPER` and `BACKUP_STORAGE_ROOT=./backups` in `.env`.
2. Run `docker compose up -d mongo redis`, then `npm start`.
3. Run `node scripts/create-demo.js`.
4. Register `demo-backup-v1` with `backupFormat: "dump"` and `metadata.databaseName: "demo"`.
5. Record deletion evidence for `USER_001`, delete it from the source database, and request verification.
6. Poll the job and retrieve its report. A real demo is successful only if Docker creates/restores the isolated container and the report contains the expected result.

For a deliberately failed restore, register a separately created invalid dump directory containing a malformed `.bson` file. Do not alter the original registered backup.
