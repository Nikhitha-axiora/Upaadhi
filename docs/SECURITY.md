# Upaadhi — Security posture

The hidden security layer that protects accounts, listings, chats, location, and
personal data. This document maps each control to where it lives in code and is
honest about what is enforced today versus what needs production infrastructure.

Run `npm run test:security` (with services up) to validate the enforced controls
end-to-end. It currently checks 9 controls and must stay green.

## Enforced in code

| # | Control | Where |
|---|---------|-------|
| 1 | **Object-level authorization** — only a listing's owner or a privileged role may change its status; ownership is bound from the authenticated user, never a client-supplied id | `apps/listing-service/src/server.ts` (`/listings/:id/status`), gateway forwards `x-user-id` / `x-user-roles` |
| 2 | **Session security** — short-lived access tokens (`sid`-bound), rotating opaque refresh tokens, **reuse detection with session-family revocation**, logout, logout-all, active-session list | `packages/shared/src/auth.ts`, `apps/identity-service/src/sessions.ts`, gateway `/auth/refresh`,`/auth/logout`,`/auth/logout-all`,`/auth/sessions` |
| 3 | **Device tracking + new-device login alerts** — device fingerprint per session; alert event + UI toast on a new device | `sessions.ts` (`recordLogin`), web `verifyOtp` |
| 4 | **OTP brute-force protection** — per-phone sliding-window throttle + lockout, plus per-route gateway rate limits | `sessions.ts` (`canRequestOtp`/`recordOtpFailure`), gateway `limit()` |
| 5 | **RBAC** — privileged roles gate admin actions; non-privileged users are denied (audit-trail, moderation). Dev keeps a self-serve demo path; production requires the role | gateway `requireRole`/`canModerate`, `packages/shared/src/security.ts` |
| 6 | **Location privacy** — exact coordinates and device IP are stripped from every public surface; discovery uses approximate locality (`locationPrecision: "approximate"`) | `security.ts` (`redactSensitiveMetadata`), listing + feed services |
| 7 | **Rate limiting / abuse prevention** — global limit + tighter per-route limits on OTP, login, refresh, verification, listing-create, reports, search | gateway `@fastify/rate-limit` + `limit()` |
| 8 | **Input validation & output encoding** — control-char/bidi stripping, angle-bracket HTML-encoding, length caps on stored text | `security.ts` (`sanitizeText`), listing service |
| 9 | **Secure file upload (images)** — MIME allow-list (SVG rejected), size cap, base64 sanity; client downscales (drops EXIF) before upload | `security.ts` (`validateImageDataUrl`), identity verification |
| 10 | **Fraud / risk scoring** — advance-fee, pay-to-apply, off-platform-contact, phone/email/URL-in-text signals scored per listing; stored in metadata for moderation | `security.ts` (`scoreListingRisk`), listing service |
| 11 | **Admin audit log + monitoring** — append-only who/what/when/from-where trail and counters (requests, authz-denied, rate-limited, admin actions); admin-only endpoints | gateway `audit()`, `/admin/audit`, `/admin/metrics`; per-user trail at `/auth/security-events` |
| 12 | **Security headers** — `nosniff`, `X-Frame-Options: DENY`, strict `Referrer-Policy`, `CSP`, `HSTS`, CORP, `Permissions-Policy` on every response | gateway `onSend` hook |
| 13 | **Secret-management guard** — gateway fails closed in production if `JWT_SECRET`/`OTP_PEPPER` are unset or left at defaults | gateway startup, `.env.example` |
| 14 | **CORS allow-list** — `CORS_ORIGINS` restricts origins in production | gateway CORS registration |

## Needs production infrastructure (not in this local build)

These are intentionally **not** faked in-memory because they require real
external systems; the in-code layer above is designed to slot into them:

- **Payments** — verification, idempotency keys, webhook signature checks (no payment provider wired yet).
- **Encryption at rest + field-level encryption** of ID proofs/phones/addresses, and password hashing (Argon2id/bcrypt) — this build uses OTP auth, not passwords; PII fields would be encrypted via KMS in the DB layer.
- **Malware scanning** of uploads (e.g. ClamAV / cloud AV) and object storage with **signed, expiring URLs** outside the web root.
- **Backups & DR** — encrypted, immutable, point-in-time recovery with restore tests.
- **DPDP Act 2023 consent management** — consent logs, purpose limitation, export/delete workflows, retention rules.
- **Mobile hardening** — certificate pinning, root/jailbreak detection, app-integrity / version enforcement.
- **Centralised monitoring & 180-day log retention (CERT-In)** — ship the audit/security events to a SIEM with alerting.
- **MFA + IP/device restrictions for admins** on a separate admin domain with break-glass access.

Access tokens are short-lived (default 10 min); session revocation (`logout-all`,
reuse detection) takes effect within that window — the standard stateless-JWT
trade-off. A gateway-side revocation denylist can tighten this if needed.
