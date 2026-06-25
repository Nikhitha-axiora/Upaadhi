# Upaadhi Project Architecture

## 1. Architecture Goal

Upaadhi will use a day-one microservices architecture with layered service boundaries.

The architecture must support:

- Independent scaling of feed, listing, chat, notification, trust, and payment capabilities.
- Clear domain ownership.
- Service-owned databases.
- Event-driven projections.
- Strong security between services.
- Multi-city rollout.
- Future AI, verification, escrow, subscriptions, and employer dashboards.

## 2. High-Level Architecture

```text
User Mobile App        Admin Web App        Employer Web App
      |                    |                      |
      | HTTPS              | HTTPS                | HTTPS
      v                    v                      v
   CDN/WAF ------------- API Gateway / Edge Rate Limiter
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
   Mobile BFF           Admin BFF           Employer BFF
        |                   |                   |
        +-------------------+-------------------+
                            |
                  Service-to-Service APIs
                            |
 +--------------------------+---------------------------+
 | Identity Service          Profile Service             |
 | Listing Service           Feed/Search Service         |
 | Interaction Service       Chat Service                |
 | Trust/Moderation Service  Verification Service        |
 | Media Service             Notification Service        |
 | Rating Service            Monetization Service        |
 | Payment Service           Analytics/Event Service     |
 | AI/Risk Service           City Config Service         |
 +--------------------------+---------------------------+
                            |
                 Event Bus / Message Broker
                            |
 +--------------------------+---------------------------+
 | Service-owned DBs         Redis                       |
 | Search Index              Object Storage              |
 | Analytics Warehouse       Observability Stack         |
 +--------------------------+---------------------------+
```

## 3. Layered Architecture

### 3.1 Client Layer

Applications:

- Flutter user app.
- Admin web panel.
- Employer web dashboard.

Responsibilities:

- User interaction.
- Local validation.
- Secure token storage.
- Client-side caching where safe.
- Simple error display.

### 3.2 Edge Layer

Components:

- CDN.
- WAF.
- API Gateway.
- Edge rate limiter.

Responsibilities:

- TLS termination.
- Bot and abuse protection.
- Route-level throttling.
- Request body size control.
- Request ID creation.
- Public API routing.

### 3.3 Experience Layer

Components:

- Mobile BFF.
- Admin BFF.
- Employer BFF.

Responsibilities:

- Aggregate service data.
- Shape responses for client needs.
- Reduce mobile round trips.
- Handle client version compatibility.
- Translate internal errors into standard API responses.

### 3.4 Domain Service Layer

Domain services own business capability, APIs, database, and events.

Core MVP services:

- Identity.
- Profile.
- Listing.
- Feed/Search.
- Interaction.
- Trust/Moderation.
- Media.
- Notification.
- Rating.
- Analytics/Event.

Growth services:

- Chat.
- Verification.
- Monetization.
- Payment.
- AI/Risk.
- City Config.

### 3.5 Data Layer

Components:

- PostgreSQL databases.
- PostGIS-backed listing/feed stores.
- Redis.
- Search index.
- Object storage.
- Analytics warehouse.

Rules:

- No cross-service database reads.
- Each service uses its own credentials.
- Read models are built through events.
- Data duplication is acceptable when owned by a projection.

### 3.6 Platform Layer

Components:

- Kubernetes or managed container platform.
- Container registry.
- CI/CD.
- Secrets manager.
- Observability stack.
- Infrastructure as Code.
- Service mesh optional after service count grows.

## 4. Microservice Boundaries

### 4.1 Identity Service

Owns:

- Authentication.
- OTP lifecycle.
- Tokens.
- User account status.
- Device records.

Does not own:

- Public profile.
- Ratings.
- Listings.

### 4.2 Profile Service

Owns:

- Public profile.
- Skills.
- Availability.
- Role preferences.
- Profile completeness.

Consumes:

- UserRegistered.
- RatingSummaryUpdated.
- VerificationStatusChanged.

### 4.3 Listing Service

Owns:

- Listing creation.
- Listing updates.
- Listing lifecycle.
- Listing category detail records.

Does not own:

- Feed ranking.
- Search index.
- Payments.
- Chat.

### 4.4 Feed/Search Service

Owns:

- Feed projection.
- Search projection.
- Ranking rules.
- Location filtering.

Consumes:

- ListingApproved.
- ListingUpdated.
- ListingClosed.
- RatingSummaryUpdated.
- TrustScoreUpdated.
- BoostActivated.

### 4.5 Interaction Service

Owns:

- Contact attempts.
- Call click logs.
- Saved listings.
- Shares.
- Completion records.

Supports:

- Lead monetization later.
- Rating eligibility.

### 4.6 Chat Service

Owns:

- Conversations.
- Messages.
- Chat participant state.
- Chat blocking.

Can be delayed if MVP launches call-first.

### 4.7 Trust And Moderation Service

Owns:

- Reports.
- Moderation cases.
- Risk signals.
- Enforcement actions.
- Admin audit logs.

Critical:

- This service must exist for MVP.

### 4.8 Media Service

Owns:

- Signed upload URLs.
- Media metadata.
- Image processing.
- Public/private storage routing.

### 4.9 Notification Service

Owns:

- Push notification dispatch.
- SMS transaction dispatch.
- Templates.
- Preferences.
- Provider retry logs.

### 4.10 Rating Service

Owns:

- Ratings.
- Reviews.
- Rating summaries.

### 4.11 Verification Service

Owns:

- Employer verification.
- ID verification later.
- Document review status.

### 4.12 Monetization Service

Owns:

- Plans.
- Boosts.
- Employer subscriptions.
- Pay-per-lead charges.

### 4.13 Payment Service

Owns:

- Payment gateway integration.
- Webhooks.
- Payment status.
- Refund state.

### 4.14 AI/Risk Service

Owns:

- Risk scoring.
- Fraud signals.
- Recommendation score.
- Price/pay suggestions.
- Model versions.

## 5. Communication Architecture

### 5.1 Public Communication

Clients call:

- API Gateway.

Clients do not call:

- Domain services directly.

### 5.2 BFF To Service Communication

Use REST initially.

Rules:

- Timeout per downstream service.
- No unbounded service fanout.
- Response shaping belongs in BFF.
- BFF must degrade gracefully when non-critical services fail.

### 5.3 Service To Service Communication

Use synchronous APIs only when immediate consistency is needed.

Examples:

- BFF checks Identity.
- Listing validates owner status.
- Admin BFF fetches moderation case.

Use events for side effects.

Examples:

- ListingApproved updates Feed/Search.
- InteractionCreated triggers Notification.
- RatingSubmitted updates Profile trust summary.

### 5.4 Event Bus

Required from day one.

Event requirements:

- Versioned schemas.
- Idempotent consumers.
- Dead-letter queues.
- Outbox pattern.
- Correlation ID.
- Replay strategy for projections.

## 6. Database Architecture

### 6.1 Database Ownership

Recommended initial database split:

```text
identity_db
profile_db
listing_db
feed_search_db
interaction_db
chat_db
trust_db
media_db
notification_db
rating_db
verification_db
monetization_db
payment_db
analytics_db
```

Practical deployment:

- These can initially be separate databases on the same managed PostgreSQL cluster.
- Use separate database users and permissions.
- Never share ORM models across services as a shortcut.

### 6.2 Read Projections

Feed/Search projection:

- listing id.
- title.
- category.
- price/pay.
- location point.
- locality.
- owner trust summary.
- media thumbnail.
- urgency.
- status.
- boosted flag later.

Admin projection:

- report count.
- risk flags.
- listing moderation status.
- owner summary.

Analytics projection:

- event stream.
- user journey data.
- city/category performance.

## 7. Deployment Architecture

### 7.1 Environments

Required:

- Local.
- Dev.
- Staging.
- Production.

### 7.2 Local Development

Use Docker Compose for:

- Service dependencies.
- Local Postgres instances/schemas.
- Redis.
- Event broker.
- Object storage emulator.

Developers should be able to run:

- A single service.
- Its dependencies.
- Contract tests.

### 7.3 Production Deployment

Recommended:

- Kubernetes or managed containers.
- Horizontal Pod Autoscaling for high-traffic services.
- Managed PostgreSQL.
- Managed Redis.
- Managed event broker.
- Centralized secrets.

Services with higher scaling needs:

- Feed/Search.
- Listing.
- Notification.
- Chat.
- Media.

## 8. API Architecture

### 8.1 External APIs

External APIs are exposed only through:

- API Gateway.
- BFFs.

Path pattern:

```text
/api/v1/{resource}
```

### 8.2 Internal APIs

Internal APIs should be private to the cluster/network.

Rules:

- Service authentication required.
- No public exposure.
- Contract documented.
- Timeout and retry policy defined.

### 8.3 Contract Management

Use:

- OpenAPI for REST APIs.
- AsyncAPI for events.
- Consumer-driven contract tests for BFF/service relationships.

## 9. Observability Architecture

Required from MVP:

- Centralized logs.
- Metrics.
- Distributed traces.
- Error tracking.
- Audit logs.

Each request must carry:

- requestId.
- correlationId.
- userId where applicable.
- service name.
- client version.

Each event must carry:

- eventId.
- eventType.
- eventVersion.
- occurredAt.
- producer.
- correlationId.

## 10. Security Architecture

Required:

- API Gateway auth enforcement.
- JWT validation.
- Service-to-service authentication.
- Network segmentation.
- Secrets manager.
- Least-privilege database users.
- Admin MFA.
- Encryption in transit.
- Encryption at rest.
- WAF/rate limits.

Later:

- Service mesh with mTLS.
- Policy-as-code.
- Advanced bot protection.

## 11. Scaling Architecture

### 11.1 MVP

Scale independently:

- Feed/Search Service.
- Listing Service.
- Identity Service.
- Notification Service.

### 11.2 City Expansion

Add:

- City Config Service.
- Regional moderation queues.
- Search index shards if needed.
- CDN-heavy media delivery.

### 11.3 National Scale

Add:

- Data warehouse.
- Event streaming pipeline.
- Dedicated AI/Risk service.
- Dedicated chat infrastructure.
- Payment/escrow hardening.

## 12. Architecture Decision Records

### ADR-001: Day-One Microservices

Decision:

- Use microservices from day one.

Reason:

- Founder/CTO preference for independent scaling and clean long-term boundaries.
- Upaadhi has multiple natural bounded contexts: identity, listing, feed, trust, chat, notification, payment, AI.

Tradeoff:

- Higher operational complexity.

Mitigation:

- Use managed infrastructure, monorepo, templates, contract testing, and central observability.

### ADR-002: Service-Owned Databases

Decision:

- Each service owns its database or schema boundary.

Reason:

- Prevents hidden coupling.
- Enables independent evolution.

### ADR-003: Event-Driven Projections

Decision:

- Use event bus for feed/search/admin/analytics projections.

Reason:

- Supports scalable reads and decoupled side effects.

### ADR-004: BFF Pattern

Decision:

- Use Mobile BFF, Admin BFF, and later Employer BFF.

Reason:

- Keeps clients simple and avoids direct dependency on many services.

### ADR-005: REST First, Events First For Side Effects

Decision:

- Use REST for public/synchronous APIs and events for side effects/projections.

Reason:

- Simple integration while preserving microservice decoupling.

