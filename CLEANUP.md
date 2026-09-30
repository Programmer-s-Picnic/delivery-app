# Cleanup validation — 30 September 2026

Existing controls, site URLs, APK paths and stored records are preserved.

Changes: shared web HTTP/session/notification modules; inline script/style extraction; bounded requests; catalog conflict protection; fractional prices; corrected WhatsApp formatting and notification IDs; independent notification feeds; app model/overlay extraction; regression tests retained in CI.

Validation: `node tests/web-regression.cjs`, JavaScript parsing, Flutter analysis/tests and APK build workflows. Backend additionally tests the actual HTTP catalog session-save contract, signature/expiry, notification recipient scope, money, request fingerprints and terminal-order eligibility.

Device installation/upgrade, actual WhatsApp sending and background notifications are not inferred from a successful CI build. No SMS verification or push-service feature was added. Existing guest/customer flows remain available.
