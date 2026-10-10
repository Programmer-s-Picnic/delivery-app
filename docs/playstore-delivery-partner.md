# Easy Mandi Delivery Partner — Google Play release checklist

Prepared 10 October 2026. Do not put signing keystores, passwords, service account JSON, partner passwords or test login credentials in this public repository.

## Confirmed repository setup

- App: **Easy Mandi Delivery Partner**
- Android `applicationId`: `live.learnwithchampak.delivery_partner` (must match the app created in Play Console; permanent after first Play upload)
- Flutter version at preparation: `1.3.2+12`
- GitHub Actions: [Build Play Store delivery partner AAB](../.github/workflows/playstore-delivery-aab.yml)
- Output artifact: `EasyMandi-DeliveryPartner-PlayStore-AAB` (contains `app-release.aab`)
- Release upload key: separate from the Easy Mandi customer application's key
- Android 16 target: workflow sets `targetSdk = 36` and `compileSdk = 36`
- Recovery branch: `recovery/playstore-delivery-prep-20261010`

## Release key setup — one-time

Open **Settings → Secrets and variables → Actions** in THIS repository:
https://github.com/Programmer-s-Picnic/delivery-app/settings/secrets/actions

Install the four values from the PRIVATE signing kit. Never commit the kit.
1. `EASYMANDI_DELIVERY_UPLOAD_KEYSTORE_BASE64`: base64 encoding of the upload JKS file, with no extra characters
2. `EASYMANDI_DELIVERY_UPLOAD_STORE_PASSWORD`: JKS store password
3. `EASYMANDI_DELIVERY_UPLOAD_KEY_ALIAS`: upload-key alias
4. `EASYMANDI_DELIVERY_UPLOAD_KEY_PASSWORD`: upload private-key password

Note: Secrets configured in `Programmer-s-Picnic/easymandi` do not automatically become available to `delivery-app`.

## Build and verify

1. Open https://github.com/Programmer-s-Picnic/delivery-app/actions/workflows/playstore-delivery-aab.yml
2. Select **Run workflow**, choose **main**, then **Run workflow**.
3. Require green success for Flutter analyze, Flutter tests, bundle build, `jarsigner` validation and uploaded artifact.
4. Download artifact `EasyMandi-DeliveryPartner-PlayStore-AAB` and unzip its `app-release.aab`.
5. Compare the printed upload signing certificate fingerprint to your private signing-kit certificate. Check that the package is `live.learnwithchampak.delivery_partner` and targets API 36. Confirm ABI/device support and Play pre-launch results.
6. Do an actual device test of login, assigned deliveries, statuses, COD/UPI restrictions, notifications, QR scan/code handoff, and post-delivery disabled actions against the intended server environment.

Do not present a successful Android build as proof of end-to-end server functionality.

## Suggested Google Play listing — draft

**App name:** Easy Mandi Delivery Partner

**Short description:** Manage assigned deliveries, status updates and secure handoffs for Easy Mandi.

**Full description:**

Easy Mandi Delivery Partner is the companion app for authorised delivery partners working with Easy Mandi.

Sign in with your assigned delivery partner account to see your orders and the details needed to complete each job. Update delivery progress from assignment to pickup and out-for-delivery. Confirm a customer handoff with their delivery code or by scanning their QR code.

The app also displays relevant order and payment information and provides an in-app notification inbox. Notifications are refreshed periodically while the app is active.

Features:
- Partner account sign-in
- Assigned deliveries, search and status filtering
- Order and customer delivery details
- Pickup and out-for-delivery updates
- Customer QR-code scan or code-based delivery confirmation
- In-app delivery notifications
- Delivery payment-status visibility

For authorised Easy Mandi delivery partners only. A delivery partner account must be created by an administrator.

**Initial release notes:**
Initial Play Store release for authorised Easy Mandi delivery partners, with assigned order management, delivery status updates, customer handoff verification and in-app notifications.

## Play Console steps

1. At https://play.google.com/console create a **new app**, not an update of the Easy Mandi customer app. Select app (not game), language and appropriate pricing and declarations.
2. Enable Play App Signing and upload the signed `.aab` to **Internal testing** first.
3. Complete Store listing (icon, feature graphic, Android screenshots, support contact), Data safety, Privacy policy, App access, Ads, Content rating, Target audience and other Console policy declarations as applicable.
4. Because sign-in requires an admin-created partner account, provide Google review staff valid **working demo credentials through the App access section** in Play Console. Do not expose them in GitHub.
5. Test on Android 16 and supported older devices; review pre-launch report and crashes, then release to an appropriately restricted testing audience.
6. If the Play developer account is a personal account created after 13 November 2023, complete the **12 testers / 14 continuous days** closed-test requirement before applying for production access, according to Play Console instructions.
7. For production release, keep versionCode increasing on future releases and preserve the same upload signing identity.

## Outstanding for human confirmation before submitting for review

- App title, package ID and whether this Play listing already exists (package ID is permanent after first upload).
- Publicly accessible privacy-policy URL describing actual data handling and deletion/contact mechanism, confirmed with backend owner.
- Store screenshot captures from the actual running build, feature graphic, developer contact and category.
- Correct Google Play Data safety answers, including customer addresses/mobile numbers, partner credentials and order history handled through the backend, and QR camera access. Do not guess declarations.
- Login credentials for a dedicated reviewer account with test jobs, provided only within Play Console.
- Real device smoke test, Google Play pre-launch results and closed-test/production eligibility.

## References

- https://support.google.com/googleplay/android-developer/answer/9859348
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/14151465
