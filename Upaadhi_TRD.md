# Upaadhi Technical Requirements Document

## 1. Document Control

Product: Upaadhi

Document type: Technical Requirements Document

Architecture direction: Day-one microservices with layered service boundaries.

Related documents:

- Upaadhi_PRD.md
- Upaadhi_FRD.md
- Upaadhi_Project_Architecture.md
- Upaadhi_Security_Response_Guidelines.md
- Upaadhi_Phase_Wise_Technical_Plan.md

Prepared from CTO perspective.

## 2. Technical Objective

Build Upaadhi as a secure, scalable, mobile-first hyperlocal earning marketplace for India using a day-one microservices architecture.

The platform must support:

- Phone-based onboarding.
- User and profile management.
- Hyperlocal listing discovery.
- Listing creation across Job, Service, Sell, and Rent.
- Call/chat interactions.
- Trust, moderation, and safety workflows.
- Admin operations.
- Notifications.
- Analytics.
- Future payments, verification, AI scoring, subscriptions, escrow, and multi-city scale.

The architecture should be service-oriented from the beginning so each business capability can scale, deploy, and evolve independently.

## 3. CTO Principles

- Use bounded-context microservices from day one.
- Each service owns its database or schema boundary.
- No direct cross-service database access.
- Use synchronous APIs for user-facing reads/writes that need immediate response.
- Use asynchronous events for side effects, analytics, notifications, risk scoring, and projections.
- Use an API gateway and client-specific BFF layer for mobile/admin clients.
- Keep contracts explicit using OpenAPI for REST and AsyncAPI for events.
- Prefer managed infrastructure where possible to reduce operational burden.
- Build observability, tracing, and central logging from day one.
- Build admin, moderation, and auditability as first-class platform capabilities.
- Do not expose exact private location by default.
- Keep workers free during MVP; monetize employer and high-intent flows later.
- Design every public API assuming abuse, scraping, spam, fake jobs, and OTP attacks.

## 4. Recommended Technology Stack

### 4.1 Mobile App

Recommended: Flutter.

Reason:

- Android-first delivery.
- Future iOS support.
- Good performance on low-end Android devices when optimized.
- Fast UI iteration.

Alternative: React Native if the founding team has stronger JavaScript/TypeScript mobile experience.

### 4.2 Admin And Employer Web

Recommended: Next.js or React.

Admin panel is required from MVP. Employer dashboard can start in phase 2 or 3.

### 4.3 Backend Services

Recommended primary backend stack: NestJS with TypeScript.

Reason:

- Fast development.
- Strong module and DI structure.
- Good support for REST, queues, validation, testing, and OpenAPI.
- Works well across multiple microservices.

Alternative: Java Spring Boot for services needing heavy enterprise integrations, payments, or compliance-heavy workflows.

CTO guidance:

- Use one primary backend stack for most services.
- Avoid polyglot microservices until the team is mature enough to operate them.
- AI/ML services can use Python later where justified.

### 4.4 Databases

Use service-owned databases.

Recommended:

- PostgreSQL for transactional services.
- PostgreSQL + PostGIS for Listing/Search location data.
- Redis for cache, rate limiting, OTP cooldowns, and ephemeral state.
- OpenSearch/Elasticsearch for search after MVP scale requires better relevance.
- Object storage for media and private verification documents.
- Analytics warehouse later for event analysis.

Rule:

- A service may expose data only through APIs/events.
- Other services must not query its database directly.

### 4.5 Messaging And Events

Recommended event backbone:

- Kafka, Redpanda, AWS MSK, Google Pub/Sub, Azure Event Hubs, or RabbitMQ depending on team/cloud preference.

MVP-friendly recommendation:

- Use a managed message broker if possible.
- Use Kafka-compatible event streaming if future analytics and AI pipelines are important.

Use cases:

- ListingCreated.
- ListingApproved.
- InteractionCreated.
- UserReported.
- UserSuspended.
- RatingSubmitted.
- NotificationRequested.
- PaymentSucceeded later.
- VerificationCompleted later.

### 4.6 API Gateway And BFF

Use API Gateway for:

- TLS termination.
- Request routing.
- Rate limiting.
- JWT validation.
- WAF/bot protection integration.
- Request ID generation.
- Public API inventory.

Use BFF services:

- Mobile BFF for user app aggregation.
- Admin BFF for operations/admin workflows.
- Employer BFF later for employer dashboard.

Reason:

- Prevent mobile app from calling many backend services directly.
- Keep service boundaries clean.
- Allow client-specific response shaping.

### 4.7 Infrastructure

Recommended:

- Docker containers.
- Kubernetes or managed container platform from day one if microservices are mandatory.
- Managed PostgreSQL.
- Managed Redis.
- Managed event bus.
- Managed object storage.
- CDN for public media.
- Centralized logs and metrics.
- Secrets manager.

MVP infrastructure must include:

- API gateway.
- Mobile BFF.
- Admin BFF.
- Core microservices.
- Service databases.
- Event broker.
- Redis.
- Object storage.
- Observability stack.
- CI/CD.

## 5. Layer-Wise Architecture

### 5.1 Client Layer

Components:

- Flutter user mobile app.
- Admin web panel.
- Employer web dashboard later.

Responsibilities:

- User interaction.
- Local form validation.
- Offline-friendly UX where possible.
- Secure token storage.
- Clear error display.

### 5.2 Edge Layer

Components:

- CDN.
- WAF.
- API gateway.
- Rate limiter.

Responsibilities:

- TLS.
- Bot protection.
- Request throttling.
- Routing.
- Public API protection.

### 5.3 Experience Layer

Components:

- Mobile BFF.
- Admin BFF.
- Employer BFF later.

Responsibilities:

- Aggregate service responses.
- Convert backend errors into client-friendly responses.
- Hide internal service topology.
- Handle client version compatibility.

### 5.4 Domain Services Layer

Core services:

- Identity Service.
- User Profile Service.
- Listing Service.
- Feed/Search Service.
- Interaction Service.
- Chat Service.
- Trust and Moderation Service.
- Verification Service.
- Notification Service.
- Media Service.
- Rating Service.
- Monetization Service.
- Payment Service later.
- Analytics/Event Service.
- AI/Risk Service later.

### 5.5 Data Layer

Components:

- Service-owned PostgreSQL databases.
- Redis.
- Search index.
- Object storage.
- Analytics warehouse.

Rules:

- No shared database ownership.
- Data duplication through events is allowed.
- Read models are allowed for feed/search/admin dashboards.

### 5.6 Observability And Platform Layer

Components:

- Central logs.
- Metrics.
- Distributed tracing.
- Error tracking.
- Alerting.
- Secrets manager.
- CI/CD.
- Service mesh optional after service count grows.

## 6. Core Microservices

### 6.1 Identity Service

Responsibilities:

- Phone OTP login.
- User account identity.
- Session and token issuance.
- Refresh token management.
- Admin identity integration.
- User status: active, suspended, deleted.

Owns data:

- users_identity.
- auth_sessions.
- otp_attempts.
- user_devices.
- token_revocations.

Exposes:

- POST /auth/otp/request
- POST /auth/otp/verify
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

Publishes:

- UserRegistered.
- OtpVerified.
- UserSuspended.
- UserDeleted.

### 6.2 User Profile Service

Responsibilities:

- Public user profile.
- Skills.
- Availability.
- Role preferences.
- Profile completeness.
- Profile trust summary cache.

Owns data:

- profiles.
- profile_skills.
- user_roles.
- user_preferences.

Consumes:

- UserRegistered.
- RatingSummaryUpdated.
- VerificationStatusChanged.

Publishes:

- ProfileCreated.
- ProfileUpdated.
- AvailabilityUpdated.

### 6.3 Listing Service

Responsibilities:

- Listing lifecycle.
- Category-specific listing data.
- Listing status transitions.
- Listing owner authorization.
- Listing expiry and renewal.

Owns data:

- listings.
- listing_job_details.
- listing_service_details.
- listing_sell_details.
- listing_rent_details.
- listing_status_history.

Exposes:

- POST /listings
- GET /listings/{id}
- PATCH /listings/{id}
- POST /listings/{id}/pause
- POST /listings/{id}/close

Publishes:

- ListingCreated.
- ListingUpdated.
- ListingSubmittedForReview.
- ListingApproved.
- ListingRejected.
- ListingClosed.
- ListingExpired.

### 6.4 Media Service

Responsibilities:

- Signed upload URLs.
- Media validation.
- Image metadata stripping.
- Thumbnail generation.
- Public/private bucket separation.

Owns data:

- media_assets.
- media_processing_jobs.

Publishes:

- MediaUploaded.
- MediaProcessed.
- MediaRejected.

### 6.5 Feed And Search Service

Responsibilities:

- Unified feed.
- Search.
- Filtered discovery.
- Location radius queries.
- Ranking.
- Feed read model.

Owns data:

- listing_feed_projection.
- search_index_status.
- user_feed_preferences cache/projection.

Consumes:

- ListingApproved.
- ListingUpdated.
- ListingClosed.
- RatingSummaryUpdated.
- TrustScoreUpdated.
- BoostActivated later.

Exposes:

- GET /feed
- GET /search

Technical note:

- This service may maintain a denormalized projection optimized for reads.
- It must not own listing writes.

### 6.6 Interaction Service

Responsibilities:

- Call click tracking.
- Chat start tracking.
- Save/share tracking.
- Lead/interested user records.
- Completion status.

Owns data:

- interactions.
- saved_listings.
- listing_shares.
- contact_limits.

Publishes:

- InteractionCreated.
- CallClicked.
- ChatStarted.
- ListingSaved.
- InteractionCompleted.

### 6.7 Chat Service

Responsibilities:

- One-to-one listing-context chat.
- Message delivery.
- Read state later.
- Chat block/report integration.

Owns data:

- chats.
- chat_participants.
- chat_messages.
- chat_blocks.

Publishes:

- ChatMessageSent.
- ChatReported.

MVP decision:

- If build speed is tight, launch call-first and ship chat in phase 1.5.
- If microservices team is ready, Chat Service can be included in MVP.

### 6.8 Trust And Moderation Service

Responsibilities:

- Reports.
- Moderation cases.
- Risk signals.
- User/listing enforcement decisions.
- Admin action audit.
- Safety workflows.

Owns data:

- reports.
- moderation_cases.
- risk_signals.
- enforcement_actions.
- admin_actions.
- audit_logs.

Consumes:

- ListingCreated.
- ListingReported.
- UserReported.
- ChatReported.
- InteractionCreated.

Publishes:

- ListingApproved.
- ListingRejected.
- ListingRemoved.
- UserRestricted.
- UserSuspended.
- RiskScoreUpdated.

### 6.9 Verification Service

Responsibilities:

- Employer verification.
- ID verification later.
- Verification document handling metadata.
- Verification status.

Owns data:

- verifications.
- verification_documents_metadata.
- verification_reviews.

Publishes:

- VerificationSubmitted.
- VerificationApproved.
- VerificationRejected.
- VerificationStatusChanged.

### 6.10 Rating Service

Responsibilities:

- Ratings and reviews.
- Rating eligibility.
- Rating summary.
- Review moderation hooks.

Owns data:

- ratings.
- reviews.
- rating_summaries.

Consumes:

- InteractionCompleted.

Publishes:

- RatingSubmitted.
- RatingSummaryUpdated.

### 6.11 Notification Service

Responsibilities:

- Push notifications.
- SMS transactional messages.
- Notification templates.
- User notification preferences.
- Provider retries.

Owns data:

- notifications.
- notification_templates.
- notification_preferences.
- provider_delivery_logs.

Consumes:

- NotificationRequested.
- ChatMessageSent.
- ListingApproved.
- ListingRejected.
- InteractionCreated.

Publishes:

- NotificationSent.
- NotificationFailed.

### 6.12 Monetization Service

Responsibilities:

- Plans.
- Listing boosts.
- Employer subscriptions.
- Pay-per-lead accounting.

Owns data:

- plans.
- subscriptions.
- boosts.
- lead_charges.

Publishes:

- BoostActivated.
- SubscriptionActivated.
- LeadChargeCreated.

### 6.13 Payment Service

Phase:

- Phase 3 onward.

Responsibilities:

- Payment initiation.
- Payment gateway integration.
- Webhook verification.
- Payment reconciliation.
- Refund state.

Owns data:

- payments.
- payment_attempts.
- refunds.
- gateway_events.

Publishes:

- PaymentInitiated.
- PaymentSucceeded.
- PaymentFailed.
- RefundProcessed.

### 6.14 Analytics/Event Service

Responsibilities:

- Product event ingestion.
- Event validation.
- Stream forwarding to warehouse/analytics tools.
- Funnel datasets.

Owns data:

- raw_events.
- event_processing_offsets.

Consumes:

- Domain events from all services.

Exposes:

- POST /events/client

### 6.15 AI And Risk Service

Phase:

- Phase 2 rules engine, phase 5 ML maturity.

Responsibilities:

- Spam score.
- Listing quality score.
- Duplicate detection.
- Recommendation scores.
- Price/pay suggestions.
- Fraud risk signals.

Owns data:

- model_versions.
- scoring_requests.
- scoring_results.
- feature_snapshots.

Publishes:

- ListingRiskScored.
- TrustScoreUpdated.
- RecommendationScoreUpdated.

## 7. Service Communication

### 7.1 Synchronous Communication

Use REST internally for simple service-to-service calls during MVP.

Use gRPC later for high-throughput internal calls if needed.

Rules:

- All internal calls must include requestId/correlationId.
- Timeouts are mandatory.
- Retries only for idempotent operations.
- Circuit breakers for unstable dependencies.

### 7.2 Asynchronous Communication

Use event bus for:

- Side effects.
- Projections.
- Notifications.
- Analytics.
- Risk scoring.
- Search indexing.

Rules:

- Events must be versioned.
- Consumers must be idempotent.
- Use dead-letter queues.
- Use outbox pattern for reliable event publishing from transactional services.

### 7.3 Event Naming

Use past-tense business events:

- UserRegistered.
- ProfileUpdated.
- ListingCreated.
- ListingApproved.
- InteractionCreated.
- PaymentSucceeded.

Avoid command-like event names:

- SendNotification.
- ApproveListing.

Commands can exist separately where needed.

## 8. Data Architecture Requirements

### 8.1 Service-Owned Databases

Recommended day-one split:

- identity_db
- profile_db
- listing_db
- feed_search_db
- interaction_db
- chat_db
- trust_db
- verification_db
- rating_db
- notification_db
- monetization_db
- payment_db later
- analytics_db or warehouse

Operational compromise:

- These can run on the same PostgreSQL cluster initially, but ownership must be separated by database/schema/user permissions.
- No service should read another service's tables directly.

### 8.2 Read Models And Projections

Allowed:

- Feed/Search Service keeps listing projection.
- Admin BFF may read from Trust/Admin projection service.
- Analytics keeps denormalized events.

Projection updates:

- Consume events.
- Rebuild from source events or service APIs when needed.

### 8.3 Location Data

Listing Service owns canonical listing location.

Feed/Search Service owns searchable location projection.

Requirements:

- PostGIS geography points.
- Index active listings by location/status/category.
- Public response shows approximate distance/locality, not exact coordinates unless allowed.

### 8.4 Data Consistency Model

Use eventual consistency for:

- Feed projection updates.
- Rating summary updates.
- Trust score updates.
- Notification dispatch.
- Analytics.

Use strong consistency for:

- Authentication.
- Listing ownership.
- Payment state.
- Verification decision.
- Admin enforcement actions.

## 9. API Requirements

### 9.1 Public API Style

Public APIs:

- REST via API Gateway/BFF.
- Versioned under /api/v1.
- Documented using OpenAPI.

Internal APIs:

- REST initially.
- gRPC optional later.
- Documented with OpenAPI or protobuf where used.

Event contracts:

- Document with AsyncAPI.

### 9.2 Public API Groups

```text
/api/v1/auth
/api/v1/me
/api/v1/profiles
/api/v1/feed
/api/v1/search
/api/v1/listings
/api/v1/interactions
/api/v1/chats
/api/v1/reports
/api/v1/ratings
/api/v1/media
/api/v1/notifications
/api/v1/admin
/api/v1/employer
/api/v1/payments
```

### 9.3 API Gateway Rules

- Enforce TLS.
- Validate JWT where applicable.
- Apply route-level rate limits.
- Generate/propagate request ID.
- Block known malicious patterns.
- Enforce max request body sizes.

## 10. Performance Requirements

MVP server-side targets:

- Mobile feed BFF response: under 800 ms p95 for common pilot locality queries.
- Listing detail response: under 500 ms p95.
- OTP request response: under 500 ms excluding SMS provider delay.
- Create listing response: under 800 ms excluding media upload.
- Admin moderation queue: under 1 second p95.

Event targets:

- ListingApproved to feed projection visible: under 10 seconds p95.
- ChatMessageSent to push notification queued: under 5 seconds p95.
- ReportSubmitted to admin queue visible: under 5 seconds p95.

Client targets:

- Feed usable in under 3 seconds on common 4G.
- App remains usable on low-end Android devices.

## 11. Reliability Requirements

MVP availability target:

- 99% monthly for public APIs.

Required:

- Health checks per service.
- Readiness/liveness probes.
- Centralized alerting.
- Retry queues.
- Dead-letter queues.
- Database backups per service.
- Disaster recovery runbook.
- Graceful degradation if non-critical services fail.

Examples:

- If Notification Service fails, listing creation must still work.
- If Analytics Service fails, user-facing flows must still work.
- If Feed projection lags, user can still open direct listing by ID.

## 12. Observability Requirements

Mandatory from day one:

- Structured JSON logs.
- Correlation ID across gateway, BFF, services, and events.
- Distributed tracing.
- Metrics per service.
- Central error tracking.
- Audit logs for admin/trust/payment actions.

Metrics:

- Request rate.
- Error rate.
- Latency p50/p95/p99.
- Event lag.
- Queue depth.
- DLQ count.
- Database connection usage.
- OTP provider success/failure.
- Feed projection delay.
- Moderation backlog.

## 13. Testing Requirements

Required test layers:

- Unit tests per service.
- Contract tests between services.
- API integration tests.
- Event contract tests.
- E2E tests through BFF/API gateway.
- Security tests for auth, authorization, rate limits.
- Load tests for feed, listing creation, OTP, and chat.

Critical:

- Contract tests are mandatory in microservices.
- Consumer-driven contracts should be used for BFF-service dependencies.
- Event schema compatibility must be tested before deployment.

## 14. DevOps Requirements

### 14.1 Repository Strategy

Recommended:

- Monorepo for backend services initially, with clear service directories.

Reason:

- Easier shared tooling.
- Easier cross-service refactoring early.
- Consistent CI/CD standards.

Alternative:

- Multi-repo once teams grow.

### 14.2 CI/CD

Each service must have:

- Lint.
- Type check.
- Unit tests.
- Contract tests.
- Container build.
- Security scan.
- Migration validation.
- Deployment pipeline.

Deployment:

- Independent service deployment.
- Staging before production.
- Blue/green or rolling deployments.
- Feature flags for risky changes.

### 14.3 Infrastructure As Code

Required:

- Terraform, Pulumi, or cloud-native IaC.
- Environment parity for dev/staging/prod where practical.
- Secrets managed outside code.

## 15. Security Baseline

Use:

- OWASP API Security Top 10 2023.
- OWASP MASVS.
- OWASP ASVS.
- DPDP Act/rules readiness.
- CERT-In logging and incident response expectations.

Additional microservices security:

- Service-to-service authentication.
- Network segmentation.
- Least-privilege database users.
- Secrets rotation.
- API gateway route policies.
- Internal mTLS or service mesh when service count grows.

## 16. Technical Risks

| Risk | Impact | Mitigation |
|---|---:|---|
| Microservices operational complexity | High | Managed infra, monorepo, strict templates, platform automation |
| Distributed data consistency bugs | High | Outbox pattern, idempotent consumers, event contracts |
| API latency from service chaining | Medium | BFF aggregation, caching, projections, timeout budgets |
| OTP abuse cost | High | Rate limits, quotas, risk scoring |
| Fake listings | High | Moderation, risk scoring, report workflows |
| Location privacy exposure | High | Approximate display, strict access controls |
| Contract drift | High | OpenAPI/AsyncAPI, contract tests |
| Observability gaps | High | Mandatory tracing/logging before pilot |
| Over-fragmentation | Medium | Keep only business-capability services, avoid tiny services |

## 17. CTO Recommendation

Build Upaadhi with day-one microservices, but keep the service count disciplined.

MVP services:

- API Gateway.
- Mobile BFF.
- Admin BFF.
- Identity Service.
- Profile Service.
- Listing Service.
- Feed/Search Service.
- Interaction Service.
- Trust/Moderation Service.
- Media Service.
- Notification Service.
- Rating Service.
- Analytics/Event Service.

Phase 2/3 services:

- Chat Service if not included in MVP.
- Verification Service.
- Monetization Service.
- Payment Service.
- AI/Risk Service.

Recommended stack:

- Flutter mobile app.
- Next.js/React admin web.
- NestJS TypeScript microservices.
- PostgreSQL + PostGIS for listing/feed location needs.
- Redis.
- Kafka-compatible or managed event bus.
- S3-compatible object storage.
- Kubernetes or managed containers.
- Centralized logging, metrics, and tracing.

This is operationally heavier than a simple single-service backend, but if the strategic decision is to use microservices from day one, this structure keeps the system coherent instead of becoming a distributed mess.
