# Easy Mandi delivery integration · implementation contract

The current `web/` page is a browser-only workflow prototype. It does not authenticate users, send messages, or share data between devices. Production must use the PHP service in `cserver/delivery` and the existing Easy Mandi order database. The Easy Mandi admin is currently at https://programmer-s-picnic.github.io/easymandi/admin/ and requires its own admin password for orders; a cross-site session has not been implemented.

## Actors and applications

| Actor | Surface | Access |
| --- | --- | --- |
| Dispatcher/admin | Delivery web admin, linked from Easy Mandi admin | Authenticated session; can import orders, assign partners, resend code, inspect timeline |
| Delivery person | Flutter Android app | Authenticated account; sees only assigned jobs and submits customer code |
| Customer | Delivery section of the existing Easy Mandi customer Flutter app, plus a limited tracking web view | Own orders and code; can see tracking and notifications |

Avoid a separate second customer APK for Easy Mandi. Build the reusable delivery customer module in the existing app, and reuse its API contract for future client apps.

## Order creation

1. Easy Mandi admin signs in through the existing admin flow, then opens Delivery. Until shared SSO is built, Delivery requires its own server-side login; a link alone is not authentication.
2. Admin selects an Easy Mandi order, uploads a JSON cart, or pastes JSON. Server validates item names, quantities, recipient and address. A client-supplied total is never trusted for payment or collection.
3. Server stores an immutable source order ID, normalized items, recipient snapshot, and address. It creates a six-digit handoff code using a cryptographic random generator, stores only a keyed hash, sets a short expiry and attempt limit, and records creation in the audit log.
4. Server delivers the code to the customer through an authenticated in-app inbox immediately. SMS can be added later. Do not put the code into dispatcher/partner API responses, push notification bodies, tracking links, or logs.
5. Admin assigns a partner. The partner app receives the job and updates pickup/out-for-delivery states.
6. At the customer's door, partner enters the customer's code. Server checks assignment, state, expiry, attempt limit, and hash in one transaction, marks delivered once, and writes an event. Retries return the existing result.
7. Notify customer, dispatcher, and partner from the saved event. In-app inbox is the baseline. Push can be added with device tokens and a delivery queue; offline devices see the event on next sync.

## API additions

- `POST /admin/login`, `POST /admin/logout`, `GET /admin/me`: secure HTTP-only session cookie and CSRF protection.
- `POST /orders/import`: accepts `source_app`, `external_order_id`, `cart`, customer, address; idempotent.
- `POST /orders/{id}/assign`: admin assignment.
- `POST /orders/{id}/issue-code`: initial issue or controlled resend; invalidates prior code, audit logged.
- `POST /partner/login`, `GET /partner/jobs`, `POST /partner/jobs/{id}/confirm`: partner-scoped access and code verification.
- `GET /customer/orders`, `GET /customer/orders/{id}/handoff`: owner-scoped tracking and handoff code.
- `GET /notifications`, `POST /notifications/{id}/read`: in-app notifications with audience-specific payloads.

All writes use HTTPS, account authorization, validation, rate limiting and audit events. No public GitHub Pages JavaScript can hold an admin password, integration secret or signing key.

## Server deployment

Create `cserver/delivery/api` and private configuration outside the public web root, then add `delivery_` tables via reviewed migrations. Keep Easy Mandi's existing `easymandi_` tables as the source of truth. Once the service is available, replace the browser demo state with authenticated API calls and build the partner/customer Flutter views.
