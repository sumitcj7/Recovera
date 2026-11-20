# API reference

All protected endpoints require `x-api-key`. Responses use `{ "data": ... }`; operational failures use `{ "error": { "code", "message" } }`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/applications/register` | Creates an application and returns its API key once. |
| GET/PATCH | `/api/v1/applications/me` | Reads or updates the authenticated application. |
| GET | `/api/v1/applications/me/statistics` | Returns tenant job/report counts. |
| POST/GET | `/api/v1/backups` | Registers/lists controlled local backup references. |
| GET/DELETE | `/api/v1/backups/:id` | Reads or soft-deletes the tenant backup. |
| POST | `/api/v1/backups/:backupId/verify` | Creates an asynchronous verification job. |
| GET | `/api/v1/verification-jobs` | Lists the tenant jobs. |
| GET | `/api/v1/verification-jobs/:id/report` | Reads its report when available. |
| POST/GET | `/api/v1/deletions` | Records/lists deletion evidence. |
| GET | `/api/v1/reports` | Lists tenant reports with pagination. |
| GET | `/api/v1/reports/:id` | Reads one tenant report. |

`checksum`, when supplied, must be `sha256:<64 hex characters>` and is currently validated only for archive files. Logical dump directories must contain a `.bson` file.
