# Upaadhi Production Readiness Checklist

## Current Status

Upaadhi is not fully production ready yet. It now has a stronger production-oriented foundation:

- Microservice workspace.
- API gateway.
- Light-theme frontend.
- PostgreSQL migrations.
- Repository layers.
- Generated OTP challenge flow.
- Signed access tokens.
- Gateway rate limiting.
- Listing moderation status.
- Admin approve/reject endpoints.
- Smoke test for critical marketplace flow.

## Verified Locally

- `npm run typecheck`
- `npm run build`
- `npm audit --omit=dev`
- `npm run test:smoke`

## Must Complete Before Public Launch

### Infrastructure

- Run real PostgreSQL and verify migrations against it.
- Add Redis for rate limits, OTP throttling, and session controls.
- Add managed event broker.
- Add deployment infrastructure using IaC.
- Add staging and production environments.
- Add CI/CD pipeline.

### Security

- Replace dev OTP return with SMS provider integration.
- Add refresh token persistence and revocation.
- Add admin MFA.
- Add RBAC for admin endpoints.
- Add service-to-service authentication.
- Add secrets manager.
- Add WAF/bot protection.
- Add structured security logging.

### Product

- Build real admin moderation UI.
- Build media upload service.
- Build chat or call-masking flow.
- Build verification workflow.
- Build notification provider integration.
- Build payment/monetization only after trust layer is stable.

### Quality

- Add unit tests per service.
- Add integration tests against PostgreSQL.
- Add contract tests between gateway and services.
- Add E2E tests for frontend flows.
- Add load tests for feed, OTP, listing creation, and reporting.
- Add accessibility testing for core UI.

### Compliance

- Privacy policy.
- Terms of use.
- DPDP review.
- Data retention policy.
- Incident response process.
- Vulnerability disclosure and patch process.

