# Upaadhi Phase-Wise Technical Planning

## 1. Planning Objective

This document defines phase-wise execution for building Upaadhi using day-one microservices.

The plan assumes:

- Microservices from the beginning.
- Service-owned databases.
- API gateway and BFF pattern.
- Event bus from MVP.
- Strong observability and contract testing from day one.
- Controlled pilot before city expansion.

## 2. Phase 0: Platform Foundation

Duration: 3-4 weeks

Goal:

- Build the foundation needed to safely operate microservices.

Key outputs:

- Cloud account/project structure.
- Kubernetes or managed container setup.
- API Gateway.
- Service template.
- CI/CD template.
- Observability stack.
- Event broker.
- Database provisioning pattern.
- Secrets manager.
- Local Docker Compose environment.

Engineering tasks:

- Create backend monorepo or service workspace.
- Create service template with health checks, logging, tracing, validation, OpenAPI, auth middleware.
- Create BFF template.
- Set up PostgreSQL cluster and service database creation pattern.
- Set up Redis.
- Set up event broker.
- Set up object storage.
- Set up central logs, metrics, tracing, alerting.
- Set up IaC using Terraform/Pulumi/cloud-native IaC.
- Define event envelope and API response standard.
- Define service naming and repository conventions.

Exit criteria:

- A sample service can be deployed independently.
- API Gateway routes to a sample BFF.
- Events can be published and consumed.
- Logs/traces show full request path.
- CI/CD can deploy to staging.

## 3. Phase 1: MVP Service Build

Duration: 10-12 weeks

Goal:

- Launch controlled pilot with essential marketplace microservices.

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

### Sprint 1: Service Skeletons

Tasks:

- Generate service skeletons.
- Add health/readiness endpoints.
- Add OpenAPI documentation.
- Add service auth middleware.
- Add request/correlation ID propagation.
- Add basic database migrations per service.

Exit criteria:

- All MVP services boot in dev/staging.
- Gateway can route to BFFs.

### Sprint 2: Identity And Profile

Tasks:

- OTP request/verify.
- Token issue/refresh/logout.
- UserRegistered event.
- Profile creation/update.
- ProfileCreated/ProfileUpdated events.
- Admin identity setup.

Exit criteria:

- User can register and create profile through mobile BFF.

### Sprint 3: Listing And Media

Tasks:

- Listing create/update/close.
- Category-specific metadata.
- Signed media upload.
- Media processing lifecycle.
- ListingCreated event.
- Basic moderation submission.

Exit criteria:

- User can create listing with media.

### Sprint 4: Moderation And Feed Projection

Tasks:

- Trust/Moderation report and review flow.
- Listing approval/rejection events.
- Feed/Search projection consumes approved listings.
- Location radius filtering.
- Feed API through Mobile BFF.

Exit criteria:

- Approved listing appears in feed.
- Rejected listing does not appear.

### Sprint 5: Interaction, Rating, Notification

Tasks:

- Call click tracking.
- InteractionCreated event.
- Rating eligibility and submission.
- NotificationRequested flow.
- Push notification base integration.

Exit criteria:

- User can contact listing owner and rate after completed interaction.

### Sprint 6: Admin Operations

Tasks:

- Admin BFF dashboard.
- Listing moderation queue.
- Report queue.
- User suspension/restriction.
- Admin audit logs.

Exit criteria:

- Admin can remove unsafe listing and suspend user.

### Sprint 7: Analytics And Hardening

Tasks:

- Product event ingestion.
- Funnel event tracking.
- Service contract tests.
- Load tests for feed/listing/OTP.
- Security tests.
- Failure-mode testing.

Exit criteria:

- Pilot dashboards show core funnel and service health.

### Sprint 8: Pilot Readiness

Tasks:

- UAT.
- Bug fixing.
- Runbooks.
- Incident response drill.
- Backup/restore test.
- Release candidate.

Exit criteria:

- MVP can launch in one pilot locality.

## 4. Phase 2: Trust, Safety, And Liquidity

Duration: 6-8 weeks

Goal:

- Improve trust, verification, and marketplace liquidity.

New/expanded services:

- Verification Service.
- AI/Risk Service with rules-first scoring.
- City Config Service.

Tasks:

- Employer verification workflow.
- VerificationSubmitted/VerificationStatusChanged events.
- Risk scoring rules.
- Duplicate listing detection.
- Saved searches.
- Referral tracking.
- Local language content/config support.
- Regional moderation queue.

Exit criteria:

- Employer verification badge is live.
- Risk flags are visible to moderators.
- City/locality configuration does not require deployment.

## 5. Phase 3: Chat And Communication Maturity

Duration: 4-6 weeks

Goal:

- Add or mature in-app communication.

Service:

- Chat Service.

Tasks:

- Listing-context chat.
- Chat participants.
- Message persistence.
- Block/report from chat.
- ChatMessageSent event.
- Push notification for messages.
- Basic spam controls.

Exit criteria:

- Users can chat safely within listing context.
- Reported chats enter moderation queue.

## 6. Phase 4: Employer Monetization

Duration: 6-8 weeks

Goal:

- Start revenue through employer-side features.

New services:

- Monetization Service.
- Payment Service.
- Employer BFF.

Tasks:

- Employer dashboard.
- Plans.
- Listing boosts.
- Pay-per-lead records.
- Payment initiation.
- Payment gateway webhooks.
- PaymentSucceeded/PaymentFailed events.
- BoostActivated event.
- Revenue dashboard.

Exit criteria:

- Employer can pay for boost/subscription.
- Boost affects feed ranking through event projection.
- Payment state is auditable and reconciled.

## 7. Phase 5: Transaction Safety

Duration: 8-12 weeks

Goal:

- Support safer service and rental transactions.

Expanded services:

- Payment Service.
- Trust/Moderation Service.
- Verification Service.
- Media Service.

Tasks:

- Booking entity.
- Payment proof upload.
- Escrow-like flow if legally/vendor-supported.
- Rental deposit handling.
- Agreement generation.
- Dispute workflow.
- Refund workflow.

Exit criteria:

- Service/rental transaction can be tracked end to end.
- Disputes are handled through admin workflow.
- High-value rental requires stronger verification.

## 8. Phase 6: AI And Intelligent Matching

Duration: 8-12 weeks

Goal:

- Improve matching, safety, and pricing using data.

Service:

- AI/Risk Service.

Tasks:

- Recommendation scoring.
- Fraud risk scoring.
- Listing quality scoring.
- Salary/pay suggestions.
- Price suggestions.
- Feature snapshots.
- Model versioning.
- Admin explainability view.

Rules:

- AI cannot be sole basis for punitive action.
- Risk scores must include reason codes.
- Sensitive attribute use requires legal review.

Exit criteria:

- Feed ranking improves contact/completion metrics.
- Moderation workload decreases.
- AI decisions are auditable.

## 9. Phase 7: Multi-City And National Scale

Duration: ongoing

Goal:

- Scale services and operations for multi-city rollout.

Tasks:

- City operations dashboard.
- City-specific category/rule config.
- Regional moderation.
- Search index scaling.
- Feed caching by locality.
- Data warehouse.
- Advanced bot protection.
- Service mesh/mTLS if not already enabled.
- Dedicated SRE practices.

Exit criteria:

- New city launches without code changes.
- Service scaling is independent.
- Operational dashboards exist by city/category.

## 10. Team Structure

### MVP Microservices Team

Minimum:

- CTO/architect.
- 2 backend engineers.
- 1 mobile engineer.
- 1 frontend/admin engineer.
- 1 DevOps/platform engineer.
- 1 QA automation engineer.
- 1 UI/UX designer.
- 1 Product/BA.

Recommended:

- 3 backend engineers due to service count.
- Part-time security consultant before pilot.

### Growth Team

- Platform/SRE.
- Backend service owners.
- Mobile team.
- Web/admin team.
- Data/AI engineer.
- QA automation.
- Security/compliance support.
- Support operations lead.

## 11. Build Vs Buy Decisions

Build:

- Domain services.
- Feed ranking.
- Listing lifecycle.
- Moderation workflows.
- Trust/risk rules.
- BFFs.

Buy/use providers:

- SMS OTP.
- Push notifications.
- Maps/geocoding.
- Object storage/CDN.
- Payment gateway.
- KYC provider.
- Observability tools where useful.
- Managed event broker.

## 12. Release Readiness Checklist

Before MVP pilot:

- Gateway and BFFs are live.
- All MVP services have health checks.
- All MVP services have logs, metrics, traces.
- Service databases have backups.
- Event bus has DLQs.
- Contract tests pass.
- OTP rate limits are enabled.
- Feed projection works.
- Listing moderation works.
- Report/block works.
- Admin can suspend users.
- Security logs are production safe.
- Incident runbook exists.
- Privacy policy and terms are reviewed.

## 13. CTO Red Lines

Do not launch if:

- Gateway can be bypassed to public services.
- Services share databases without ownership boundaries.
- No request/correlation ID across services.
- Event consumers are not idempotent.
- Admin cannot remove unsafe listings.
- OTP can be abused without rate limits.
- Exact home location is exposed by default.
- Production logs contain OTPs/tokens.
- There is no backup and restore plan.
- There is no report/block flow.

## 14. Practical Recommendation

Day-one microservices are valid if you accept the operational cost.

To keep it survivable:

- Use a monorepo initially.
- Use one backend framework.
- Use service templates.
- Use managed databases/event broker.
- Keep service count disciplined.
- Invest early in observability and contract tests.
- Do not split tiny features into separate services.

