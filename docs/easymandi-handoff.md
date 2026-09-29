# Delivery implementation notes

The live PHP service is in [cserver/delivery](https://github.com/Programmer-s-Picnic/cserver/tree/main/delivery). The public delivery admin is at https://programmer-s-picnic.github.io/delivery-app/web/.

## Roles

- Admin uses the existing Easy Mandi administrator password for the delivery admin. The password is kept in memory for the current page and sent to the PHP API over HTTPS; it is cleared by Lock or page reload.
- Partner signs in with a provisioned mobile number and password. The Android app stores its scoped token in secure storage.
- Customer uses the existing Easy Mandi app account for limited tracking. Easy Mandi does not verify mobile ownership, so the app does not disclose the handoff code, address, or cart through that account.

## Handoff

Admin imports a server-stored Easy Mandi order or validates and imports a manual JSON cart with items and quantities. Admin assigns a partner and issues a six-digit code. The server stores only its password hash, expires it after 24 hours, limits issue frequency and failed attempts, and invalidates old codes on reissue. Admin opens a prefilled WhatsApp message and sends it to the intended customer. The partner enters the code after handing over the order. A transaction verifies partner assignment and order state, marks delivered once, and writes event and notification rows.

The WhatsApp send is a manual action. In-app notification inboxes update on refresh. Automated push/SMS requires a provider and device registration.

## API

Base: `https://cserver.learnwithchampak.live/delivery/api/?action=...`

| Action | Method | Credential | Operations |
| --- | --- | --- | --- |
| health | GET | None | Server check |
| admin | POST | X-Admin-Password | list, import, manual-import, partner-create, assign, issue-code |
| partner-login | POST | None | Issue partner bearer token |
| partner | GET/POST | Partner bearer token | list, status, confirm |
| customer | GET | Easy Mandi bearer token | Limited status and notification inbox |

Manual cart payload: `{"operation":"manual-import","external_order_id":"ORDER-1","customer_name":"Name","customer_mobile":"9876543210","address":"Full address","cart":{"items":[{"name":"Potatoes","quantity":2,"unit":"kg"}]}}`. Uploaded prices are ignored.

The server authenticates every data request. Other source applications will require their own authorization and order ownership checks before enabling their `source_app`; this first live integration supports Easy Mandi and manually entered carts.
