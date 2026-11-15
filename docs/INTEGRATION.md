# Backend integration status

The backend is **12 service modules** (project PDF pages 18-26), each in `services/<name>-service`. Each service that owns data has its own PostgreSQL database and is managed with Prisma (see [DATABASE.md](DATABASE.md)); services reach each other only through `/internal/*` HTTP calls guarded by `INTERNAL_API_TOKEN`. Public traffic goes through the gateway, which has one route table for all 12. Frontend files are untouched by this work.

Built (every function the PDF lists for them): 1 Authentication, 3 User, 5 GPS Device (including encrypted provider credentials), 6 GPS Data (ingest, latest, history, abnormal/missing-data detection, optional push of new points to subscribers). Also the registration part of 2 Company. Data layer only (database, Prisma schema, migration, internal lookup where needed, README with the endpoint checklist): 4 Vehicle, 9 Transport Job, 10 Alert & Geofence, 12 Integration & Logging. Empty skeletons: 7 Vehicle Tracking, 8 Route History, 11 Reporting & Dashboard. See `services/<name>/README.md` for what each one still needs.

- Gateway 3001, Auth 3002, User 3003, GPS Data 3004 (compose variable `TRACKING_PORT`, kept for existing clients). The other services have no host port.
- GPS uses canonical field names and BIGINT strings, checks vehicle ownership with vehicle-service, persists duplicate checks/history and survives a gps-data-service restart.

## Adding or finishing a service

- Read the service's `README.md`: endpoint checklist from the PDF, tables it owns, internal API it offers, data it must ask others for.
- Use `packages/service-kit` for the shared plumbing and `src/plugins/guard.ts` (`authed(...roles)`) to protect routes; it asks auth-service who the caller is. `company_id` always comes from that identity, never from the request body.
- Read other services' data only through their `/internal/*` API or public API, never their database. A new internal endpoint is added to the owning service and listed in its README and in `docs/DATABASE.md`.
- Change the data layer in `prisma/schema.prisma` and add a migration (see DATABASE.md).
- Use BIGINT string IDs and canonical GPS fields. The old prototype payloads and static user tokens are rejected.
- Device credentials use TRACKING_API_TOKENS with company_id and device_code (read by gps-data-service); they are separate from user Login JWTs and future external Integration API keys.
- Driver mobile ingestion requires an assigned active vehicle (vehicle-service) and an in_progress assigned transport job (transport-service). Vehicle/Job public APIs are not included; local tests prepare fixtures through SQL in `vehicle_db` / `transport_db`.
- GPS DELETE disables the connection while retaining data. The disabled flag in connection_config and timing/query policies are implementation choices documented in the shared contract.
- Auth/User refresh rotates tokens: serialize refresh and never retry a consumed token automatically.

See [DATABASE.md](DATABASE.md) for ownership, migrations and verification results, [API_DATA_CONTRACT.md](API_DATA_CONTRACT.md) for representation/policy choices, and [Postman instructions](postman/README.md) for API testing (collections not re-run after the database split). Frontend and real-provider/hardware integration still need their own end-to-end verification.
