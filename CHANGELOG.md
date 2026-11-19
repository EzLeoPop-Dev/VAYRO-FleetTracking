# Changelog

Feature versions are cumulative Git tags on the vayro-frontend branch. Dates use Asia/Bangkok. Older versions v0.1.0-v0.3.0 retain their original tags.

## v0.6.0 - 2026-11-19 - Transport lifecycle API

- Create, edit, assign, accept, start, complete, report problems, resume and cancel jobs, with own-job reads for Drivers.
- Additive migration stores accepted time, cargo text and bounded road-route snapshots.
- Enforce tenant/Driver ownership, active assignments, single active Driver/vehicle job, idempotent retries and atomic audit records.
- Includes Next.js Transport proxy/context; the Driver and management screens are connected in v0.7.0.

## v0.5.0 - 2026-11-19 - Vehicle management API

- Persist company vehicles and vehicle types, usage status and permanent Driver assignment.
- Company/role validation, audit transactions, soft deactivation, pagination, Next.js proxy and integration tests.
- Vehicle directory metadata supports later Transport assignments. Dashboard forms arrive in v0.7.0.

## v0.4.0 - 2026-11-19 - Navigation API

- Authenticated address search using Photon / OpenStreetMap and road routing using Valhalla (auto profile).
- Gateway and Next.js proxy endpoints, company-scoped caches, provider error handling, tests and Docker configuration.
- Includes the previously merged per-service database scaffold. Routes are previews; live GPS and truck restrictions are not provided.
