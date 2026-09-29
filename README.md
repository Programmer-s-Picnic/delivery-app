# Delivery Platform

Reusable delivery management for Easy Mandi and future projects.

## Current state

The [web handoff prototype](web/) demonstrates three views in one browser: admin cart import, customer handoff code, and delivery-person code entry. It accepts pasted or uploaded cart JSON and keeps one demo order in browser storage. It links to the existing [Easy Mandi admin](https://programmer-s-picnic.github.io/easymandi/admin/).

**This is a local prototype.** It has no secure login, shared database, actual customer delivery, or real notifications. Do not use its displayed code as a real proof of delivery.

## Production design

- [Easy Mandi handoff and integration contract](docs/easymandi-handoff.md)
- [Delivery API draft](docs/api.md)
- [Proposed database schema](docs/schema.sql)

Production surfaces: a delivery admin website, an authenticated Flutter app for delivery partners, and a reusable customer delivery module integrated into the existing Easy Mandi Flutter customer app. The PHP service will live under `cserver/delivery`; SMS OTP is deferred.

The handoff code is issued and checked on the server. On successful verification, the server records one delivered event and creates in-app notifications for the customer, dispatcher, and delivery partner.
