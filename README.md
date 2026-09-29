# Delivery Platform

Reusable delivery system for Easy Mandi and future projects.

## Implemented

- [Delivery admin website](web/) on GitHub Pages: Easy Mandi order import, manual cart upload/paste, partner creation and assignment, code issuance with a WhatsApp handoff link, order list and notification inbox.
- [PHP/MySQL service](https://github.com/Programmer-s-Picnic/cserver/tree/main/delivery): password-protected admin actions, partner accounts and tokens, customer account integration, status changes, code verification with expiry and attempt limits, event log and in-app notification records.
- [Partner Flutter app](partner_app/) with sign-in, assigned jobs, status updates and code confirmation. Fixed APK: [DeliveryPartner.apk](https://raw.githubusercontent.com/Programmer-s-Picnic/json-images/main/delivery/DeliveryPartner.apk).
- Customer tracking screen in the [Easy Mandi Flutter app](https://github.com/Programmer-s-Picnic/easymandi/blob/main/lib/delivery_page.dart), using its existing account token.

## Operating flow

1. Sign in on the delivery admin web page with the Easy Mandi admin password.
2. Import an existing Easy Mandi order ID, or upload/paste a JSON cart with an external reference, customer mobile, name and address.
3. Create a partner account and assign the delivery. Share credentials privately with the partner.
4. Choose **Issue customer code**. Open the WhatsApp link and **send** the code to the customer's number; opening a link does not send a message automatically. The code expires after 24 hours; a new code invalidates the previous one.
5. The partner marks pickup and out for delivery. At handoff, the customer gives the code to the partner, who enters it in the app.
6. Successful server verification marks delivered and records inbox notifications for admin, partner and customer. Refresh the apps to see changes.

Manual carts accept items and quantities. No payment collection amount is taken from an uploaded cart.

## Verification and limits

The server health check and unauthorized request responses have been verified. A complete end-to-end delivery needs an actual Easy Mandi order, admin password, and provisioned partner; these credentials are not stored in this repository. Android workflows build APK artifacts; check the workflow result before installing.

Easy Mandi accounts do not currently verify ownership of a mobile number. For this reason the handoff code is issued only by the admin and must be sent to the intended customer through a trusted channel. Customer account tracking returns limited order status. Notification records are in-app inbox data refreshed by the clients; push alerts and automatic SMS are not implemented.

See [API contract](docs/easymandi-handoff.md) and [server schema](https://github.com/Programmer-s-Picnic/cserver/blob/main/delivery/database/schema.sql).
