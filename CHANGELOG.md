# Changelog

Feature versions are cumulative Git tags on the vayro-frontend branch. Dates use Asia/Bangkok. Older versions v0.1.0-v0.3.0 retain their original tags.

## v0.7.0 - 2026-11-19 - Connected Dashboard and Driver web

- Connect employee login and workspace registration to Gateway/Auth using HttpOnly cookies, session/role guards and logout.
- Organize Dashboard components/data/maps; add floating Manage sections, movable/resizable panels, vehicle alerts and the animated circular layout menu.
- Company Admin vehicle forms and Transport job management now use persisted APIs, with address search and saved road previews.
- Connect Driver home, assigned/completed jobs and history to Transport: accept, start, report problems, resume and slide/keyboard-confirm completion.
- Preserve the DESIGN.md visual system, full-screen road map and draggable details sheet. The tracking map/overview and employee invitation form remain demos; live GPS and APK delivery remain pending.

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
