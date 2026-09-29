# Delivery Platform

Reusable delivery management for Easy Mandi and future projects. This repository contains the delivery-facing web app and shared API contract. The PHP API and database belong in a separate `cserver/delivery` folder, so each client can use the same service.

## First milestone

- Accept an order from a client project with a unique `source_app` and `external_order_id`.
- Assign an available delivery partner and track the order from creation to completion.
- Keep a timestamped audit trail for every status change.
- Let the customer open a tracking link without exposing other customers' orders.
- Provide dispatcher and delivery partner views.
- Use password-based accounts initially; SMS OTP is deferred.

## Status flow

`created → accepted → assigned → picked_up → out_for_delivery → delivered`

An order may be `cancelled` before delivery. Failed delivery moves to `delivery_failed`, then may be reassigned or cancelled. The server validates all transitions; the client never sets arbitrary status.

## Repository layout

- `web/`: runnable front-end prototype, using sample data.
- `docs/api.md`: API and integration contract for the independent server.
- `docs/schema.sql`: proposed MySQL tables with the `delivery_` prefix.

Open `web/index.html` locally to explore the dispatcher prototype. It is a sample UI, not a live order system. Production integration requires the server endpoints, login, permissions, and real data.

## Integration with Easy Mandi

Easy Mandi sends an order to `POST /delivery/api/orders` after its own checkout succeeds. The delivery platform responds with its own ID and tracking token. The source order remains owned by Easy Mandi; the delivery platform stores a snapshot of the recipient, address, collection amount, and items needed to deliver it. Retry with the same source/order ID to avoid duplicates. Other applications use a different `source_app` value.
