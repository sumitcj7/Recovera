# Limitations

- Restoration integration tests have not run in this environment because the Docker daemon is inaccessible.
- The host-run worker requires Docker-daemon access; run it under a dedicated account in production.
- Deletion tracking is reliable only for explicit SDK records and the documented Mongoose operations. Raw-driver, bulk, external, and direct writes can bypass it.
- A matching identifier is evidence of possible resurrection, not proof that a record was not legitimately recreated.
- Existing API keys use a compatibility lookup until a key-rotation migration is implemented.
- Archive checksum validation is implemented; directory-dump checksums are not.
