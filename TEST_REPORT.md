# Upaadhi Local Test Report

## Test Date

2026-06-23

## Environment

- Web: `http://localhost:5173`
- API Gateway: `http://localhost:4000`
- Identity Service: `http://localhost:4101`
- Listing Service: `http://localhost:4102`
- Feed Service: `http://localhost:4103`
- Trust Service: `http://localhost:4104`

## Test Scope Covered

### Static And Build Checks

- TypeScript typecheck across all workspaces.
- Production build across all workspaces.
- Dependency audit for production dependencies.

### UI Testing

Automated with Playwright on:

- Desktop Chromium.
- Mobile Chromium using Pixel 7 profile.

Covered flows:

- Login screen rendering.
- OTP request.
- OTP verification.
- Authenticated feed view.
- Category filtering.
- Call action status.
- Chat action status.
- Report listing.
- Quick job post.
- Pending review state.
- Admin approve action.
- Approved listing appears in feed.
- Mobile login layout sanity check.

### API Testing

Covered flows:

- OTP request.
- OTP verification.
- Invalid OTP rejection.
- Authenticated listing creation.
- Listing starts as `pending_review`.
- Admin listing approval.
- Approved listing appears in feed.
- Report creation.
- Invalid listing/auth validation.

### Performance Testing

Local lightweight feed API test:

- Requests: 50
- Concurrency: 5
- Threshold: p95 under 500 ms
- Latest result: p95 74.59 ms

## Commands Run

```bash
npm run test:all
```

This command includes:

```bash
npm run typecheck
npm run build
npm run test:smoke
npm run test:e2e
npm run test:performance
```

## Latest Result

Status: Passed

Summary:

- Typecheck passed.
- Build passed.
- Smoke test passed.
- 8 Playwright tests passed.
- Performance test passed.
- Production dependency audit passed with 0 vulnerabilities.

## Important Limitations

These tests validate the current local application behavior. They do not yet validate:

- Real PostgreSQL runtime, because PostgreSQL is not installed/running on this machine.
- Real SMS OTP provider.
- Real Redis-backed rate limiting.
- Real event broker.
- Real file/media uploads.
- Real payment provider.
- Real deployment infrastructure.
- Full security penetration testing.
- High-scale load testing.

## Next QA Priorities

- Add PostgreSQL integration test suite once PostgreSQL is available.
- Add contract tests between gateway and services.
- Add accessibility tests.
- Add visual regression screenshots.
- Add load tests for listing creation, OTP, reports, and feed.
- Add admin RBAC/security tests.
- Add CI pipeline to run tests automatically.

