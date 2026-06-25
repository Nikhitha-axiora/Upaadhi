# Upaadhi Security, Privacy, And Response Handling Guidelines

## 1. Purpose

This document defines security, privacy, API response handling, error handling, logging, and incident response guidelines for Upaadhi's day-one microservices architecture.

Upaadhi handles phone numbers, location data, employment interactions, listings, chat, reports, ratings, and later verification/payment data. Security must be built into every service and every service boundary.

## 2. Security Baselines

Use these references as baseline:

- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- OWASP Mobile Application Security Verification Standard: https://mas.owasp.org/MASVS/
- OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/
- Digital Personal Data Protection Act, 2023: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf
- CERT-In cybersecurity directions and log retention expectations.

## 3. Microservices Security Principles

- Gateway-first public access.
- No public access to internal services.
- Service-to-service authentication.
- Least privilege for service accounts and database users.
- No direct cross-service database reads.
- Encrypt traffic in transit.
- Encrypt sensitive data at rest.
- Use centralized secrets management.
- Log every administrative and enforcement action.
- Propagate requestId and correlationId across services and events.
- Rate-limit abuse-prone APIs at gateway and service level.
- Validate inputs at BFF and service level.
- Never log OTPs, tokens, private documents, or raw payment credentials.

## 4. Authentication Security

### 4.1 User Authentication

MVP:

- Phone number plus OTP.

Requirements:

- OTP expires quickly.
- OTP attempts are limited.
- OTP request frequency is rate limited by phone, IP, device, and risk score.
- OTPs must be hashed or encrypted.
- Successful verification invalidates OTP.
- Identity Service owns auth state.

### 4.2 Admin Authentication

Requirements:

- Admin MFA is mandatory.
- Admin sessions expire.
- Admin BFF enforces admin role.
- Trust/Moderation Service enforces action-level permissions.
- Super admin privileges are tightly limited.

### 4.3 Service Authentication

Required:

- Internal services authenticate to each other.
- Use signed service tokens, workload identity, or mTLS.
- Service credentials are stored in secrets manager.
- Internal APIs reject unauthenticated service calls.

Later:

- Adopt service mesh mTLS and policy-as-code as service count grows.

## 5. Authorization Guidelines

Every protected action must check:

- User authentication.
- User account status.
- Resource ownership.
- Role permission.
- Resource state.
- City/admin scope where relevant.

Critical checks:

- Listing owner can edit only their listing.
- Chat participant can view only their chat.
- Admin can act only within assigned permission/city scope.
- Rating is allowed only after valid completed interaction.
- Suspended user cannot post, contact, chat, boost, or pay.
- Internal service call must have service identity and allowed scope.

## 6. API Gateway Security

Gateway responsibilities:

- TLS enforcement.
- Route-level rate limits.
- JWT validation for public APIs where possible.
- Request size limits.
- WAF/bot protection.
- Request ID creation.
- IP/device abuse controls.
- Block unknown public routes.

Gateway must not:

- Contain business authorization logic that belongs to services.
- Bypass service-level authorization.

## 7. BFF Security

BFF responsibilities:

- Validate client request shape.
- Call only approved internal services.
- Convert internal errors to public response format.
- Avoid leaking internal service names or stack traces.
- Enforce client version compatibility.

BFF must not:

- Own domain data.
- Write directly to service databases.
- Bypass domain service rules.

## 8. Service-Level Security

Each service must implement:

- Auth guard for internal/external calls.
- Input validation.
- Output allowlisting.
- Rate limits for sensitive operations.
- Ownership checks.
- Audit logs for sensitive actions.
- Secure config loading.
- Health/readiness endpoints.

Service database rules:

- Each service has its own DB user.
- DB user has only required permissions.
- No other service can access the DB directly.

## 9. API Response Handling

All external APIs should return consistent JSON through BFF/API Gateway.

### 9.1 Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_123",
    "correlationId": "cor_123",
    "timestamp": "2026-06-23T10:00:00Z"
  }
}
```

### 9.2 List Response

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "cursor": "next_cursor",
    "hasMore": true,
    "limit": 20
  },
  "meta": {
    "requestId": "req_123",
    "correlationId": "cor_123",
    "timestamp": "2026-06-23T10:00:00Z"
  }
}
```

### 9.3 Error Response

```json
{
  "success": false,
  "error": {
    "code": "LISTING_NOT_FOUND",
    "message": "Listing not found.",
    "details": {}
  },
  "meta": {
    "requestId": "req_123",
    "correlationId": "cor_123",
    "timestamp": "2026-06-23T10:00:00Z"
  }
}
```

Internal services may include additional diagnostic fields, but BFF must strip them from public responses.

## 10. HTTP Status Code Guidelines

Use:

- 200: Successful read/update.
- 201: Resource created.
- 202: Accepted for async processing.
- 204: Success with no body.
- 400: Validation error.
- 401: Not authenticated.
- 403: Authenticated but not allowed.
- 404: Resource not found.
- 409: Conflict or invalid state transition.
- 422: Business validation failed.
- 429: Rate limit exceeded.
- 500: Unexpected server error.
- 502: Upstream provider failure.
- 503: Service unavailable.
- 504: Downstream timeout.

## 11. Standard Error Codes

Auth:

- AUTH_OTP_INVALID
- AUTH_OTP_EXPIRED
- AUTH_RATE_LIMITED
- AUTH_TOKEN_EXPIRED
- AUTH_SERVICE_UNAUTHORIZED

User:

- USER_SUSPENDED
- USER_NOT_FOUND
- PROFILE_INCOMPLETE

Listing:

- LISTING_NOT_FOUND
- LISTING_NOT_ACTIVE
- LISTING_PERMISSION_DENIED
- LISTING_VALIDATION_FAILED
- LISTING_UNDER_REVIEW

Interaction:

- CONTACT_LIMIT_EXCEEDED
- INTERACTION_NOT_FOUND
- RATING_NOT_ALLOWED

Chat:

- CHAT_NOT_FOUND
- CHAT_BLOCKED
- CHAT_PERMISSION_DENIED

Moderation:

- REPORT_ALREADY_EXISTS
- MODERATION_CASE_NOT_FOUND
- ADMIN_PERMISSION_DENIED

Platform:

- DOWNSTREAM_TIMEOUT
- SERVICE_UNAVAILABLE
- EVENT_PUBLISH_FAILED
- PROVIDER_UNAVAILABLE

Payment:

- PAYMENT_FAILED
- PAYMENT_PENDING
- PAYMENT_WEBHOOK_INVALID

## 12. Inter-Service Failure Handling

Rules:

- Every internal call must define timeout.
- BFF must use fallback for non-critical data.
- Retries only for idempotent calls.
- Use circuit breakers for unstable services.
- Use bulkheads for critical dependencies.
- Do not cascade failure from analytics/notification to core listing flow.

Examples:

- If Rating Service is unavailable, feed can show listing without rating summary.
- If Notification Service is unavailable, listing creation still succeeds and notification event retries.
- If Trust Service is unavailable, high-risk listing creation should fail closed or enter pending state based on policy.

## 13. Event Handling Guidelines

Event envelope:

```json
{
  "eventId": "evt_123",
  "eventType": "ListingApproved",
  "eventVersion": 1,
  "occurredAt": "2026-06-23T10:00:00Z",
  "producer": "listing-service",
  "correlationId": "cor_123",
  "payload": {}
}
```

Rules:

- Events are immutable.
- Events are versioned.
- Consumers are idempotent.
- Consumers store processed event IDs.
- Dead-letter queues are mandatory.
- Event schema changes must be backward compatible where possible.
- Use outbox pattern for transactional publishing.

## 14. Idempotency Guidelines

Use idempotency keys for:

- Listing creation.
- Report submission.
- Verification submission.
- Payment initiation.
- Boost purchase.
- Refund request.

Reason:

- Mobile networks are unreliable.
- Users may retry actions.
- Microservice retries can create duplicates without idempotency.

## 15. Logging Guidelines

Each service log entry should include:

- timestamp.
- serviceName.
- environment.
- requestId.
- correlationId.
- userId if authenticated.
- method/path for HTTP.
- eventId/eventType for event processing.
- statusCode.
- latencyMs.
- errorCode where applicable.

Never log:

- OTP.
- Access token.
- Refresh token.
- Full government ID.
- Verification document content.
- Raw payment credentials.
- Private chat content unless required for audited safety review.

## 16. Distributed Tracing Guidelines

Required:

- Trace starts at API Gateway/BFF.
- Trace context propagates across services.
- Event processing should link to originating trace/correlation ID.
- Slow downstream dependencies must be visible.

Trace high-value flows:

- OTP login.
- Listing creation.
- Listing approval to feed visibility.
- Interaction creation.
- Report to moderation queue.
- Payment flow later.

## 17. Data Privacy Guidelines

Personal data:

- Phone number.
- Name.
- Profile photo.
- Location.
- Chat messages.
- Interaction history.
- Reports.
- Ratings.
- Verification documents later.
- Payment proof later.

Rules:

- Collect only necessary data.
- Explain why data is collected.
- Track consent where required.
- Support account deletion/request workflow.
- Do not expose exact location by default.
- Do not expose internal risk scores.
- Do not expose reporter identity.
- Keep sensitive documents private.

DPDP readiness:

- Clear notices.
- Consent management.
- Data deletion process.
- Breach response process.
- Children's data caution.

CTO recommendation:

- MVP should restrict usage to 18+ unless legal review approves minor flows.

## 18. Location Security

Rules:

- Store exact listing coordinates only where needed.
- Feed shows approximate distance/locality.
- Hide exact home address until user chooses to share.
- Strip GPS EXIF from uploaded images.
- Keep location data access restricted to services that need it.

## 19. File Upload Security

Requirements:

- Signed upload URLs.
- File type allowlist.
- File size limits.
- Metadata stripping.
- Malware scanning where possible.
- Private bucket for verification documents.
- Public bucket/CDN only for approved listing media.
- No executable files.

## 20. Payment Security

MVP:

- No wallet.
- No escrow.
- No platform-controlled payout.

Phase 4:

- Payment Service owns gateway integration.
- Verify webhook signatures.
- Store references, not raw credentials.
- Use idempotency keys.
- Reconcile payment state.
- Audit payment state transitions.

## 21. Incident Response

Severity levels:

SEV1:

- Data breach.
- Production-wide outage.
- Payment compromise.
- Admin compromise.
- Large-scale fake job attack.

SEV2:

- Major service outage.
- OTP failure.
- Feed unavailable.
- Moderation unavailable.
- Event broker failure.

SEV3:

- Minor bug with workaround.
- Localized issue.
- Non-critical notification delay.

Steps:

1. Detect and classify.
2. Assign incident owner.
3. Contain.
4. Preserve logs and evidence.
5. Communicate internally.
6. Mitigate/fix.
7. Verify recovery.
8. Notify users/regulators where required.
9. Complete post-incident review.

## 22. Abuse Prevention

Controls:

- OTP rate limits.
- Posting limits for new users.
- Contact limits for new users.
- Device/IP throttling.
- Suspicious keyword detection.
- Manual review for high-risk posts.
- Repeated report restrictions.
- Scraping protection.
- Admin emergency category disable switch.

Abuse scenarios:

- Fake jobs asking registration fee.
- Spam listings.
- Phone scraping.
- Harassment.
- Stolen product sale.
- Rental scam.
- Fake employer.
- Fake worker ratings.

## 23. Compliance Notes

This is not legal advice. Legal counsel should review:

- Privacy policy.
- Terms of use.
- Worker/employer relationship disclaimers.
- Platform liability.
- DPDP compliance.
- KYC/vendor contracts.
- Payment gateway obligations.
- State-level gig worker requirements.
- CERT-In incident reporting obligations.

