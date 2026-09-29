# Delivery API v1 draft

Base URL: `https://cserver.learnwithchampak.live/delivery/api`. All requests and responses use JSON over HTTPS. Time values use ISO 8601 UTC. Amounts are integer paise; coordinates are optional.

## Authentication and access

Client projects authenticate server-to-server with a separate integration secret per source application. Dispatcher and delivery partner accounts use server-side sessions or short-lived access tokens. Secrets never appear in a Flutter APK, public website, or tracking URL. Public tracking uses a random, unguessable token and returns limited data. Apply rate limits and audit changes.

## Endpoints

| Method | Route | Actor | Purpose |
| --- | --- | --- | --- |
| POST | /orders | Integration | Create or idempotently retrieve an order |
| GET | /orders | Dispatcher | Filter by status and source app |
| GET | /orders/{id} | Dispatcher, assigned partner | Order details |
| POST | /orders/{id}/assign | Dispatcher | Assign/reassign a partner |
| POST | /orders/{id}/status | Assigned partner, dispatcher | Validated transition |
| GET | /partners | Dispatcher | Partner availability |
| PATCH | /partners/me/availability | Partner | Mark available/unavailable |
| GET | /track/{token} | Customer | Limited tracking details |

### Create order

```json
{
  "source_app": "easymandi",
  "external_order_id": "EM-1234",
  "recipient": {"name": "Customer", "phone": "+919335874326"},
  "address": {"line1": "House 10", "area": "Lanka", "city": "Varanasi", "state": "UP", "postal_code": "221005"},
  "items": [{"name": "Potatoes", "quantity": 2, "unit": "kg"}],
  "collection_amount_paise": 0,
  "instructions": "Call at the gate"
}
```

Return `201` with `id`, `status`, `tracking_token`, and `created_at`. Repeat the same `source_app` + `external_order_id` with the same payload to return the existing order. A conflicting payload returns `409`.

### Status transition

```json
{"status":"picked_up","note":"Collected from store"}
```

The server checks the actor and current status, writes an event atomically, and returns the new order state. Use `409` for an invalid transition.

## Privacy and operations

Only the assigned partner and dispatcher can see full recipient contact details. Public tracking returns status, approximate progress, and timestamps without phone or full address. Avoid storing payment card information. Confirm proof-of-delivery and cancellation rules before production launch.
