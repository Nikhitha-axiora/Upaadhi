# Upaadhi Functional Requirements Document

## 1. Document Control

Product: Upaadhi

Document type: Functional Requirements Document

Prepared by: Business Analyst

Related document: Upaadhi Product Requirements Document

Scope: MVP plus phased functional roadmap.

## 2. Purpose

This FRD defines the functional behavior required to build Upaadhi as a hyperlocal earning marketplace. It translates the product vision into modules, workflows, data requirements, business rules, and acceptance criteria.

## 3. Functional Scope Summary

Upaadhi will allow users to:

- Register using phone OTP.
- Create a basic profile.
- Discover nearby earning opportunities in one feed.
- Post listings across Job, Service, Sell, and Rent categories.
- Filter listings by distance, category, price/pay, urgency, and status.
- Contact listing owners through call and chat.
- Save, share, report, and block.
- Rate users after an interaction.
- Build trust through verification and work history.

Admins will be able to:

- Review listings.
- Moderate users.
- Resolve reports.
- Manage categories.
- View platform activity.
- Track fraud and safety signals.

Employers will later be able to:

- Manage job posts.
- View leads.
- Boost listings.
- Subscribe to paid plans.
- Track hiring outcomes.

## 4. User Roles

### 4.1 Guest User

Permissions:

- View limited public listings.
- Select location.
- Start signup/login.

Restrictions:

- Cannot contact users.
- Cannot post listings.
- Cannot save listings.
- Cannot report except through public abuse form, if enabled.

### 4.2 Registered User

Permissions:

- View full listings.
- Create profile.
- Post listings.
- Contact users.
- Chat/call.
- Save/share listings.
- Report listings/users.
- Rate completed interactions.

### 4.3 Earner

A registered user who uses the platform to find work or offer services.

Additional capabilities:

- Set availability.
- Add skills.
- Add work preferences.
- Apply/contact job listings.
- Create service listings.

### 4.4 Employer/Demand Creator

A registered user who posts work opportunities.

Additional capabilities:

- Post job listings.
- View interested candidates.
- Mark hired/closed.
- Rate workers.
- Use paid boosts or employer plan later.

### 4.5 Seller/Renter

A registered user who posts product sale or rental listings.

Additional capabilities:

- Add product/rental details.
- Upload images.
- Mark sold/rented/unavailable.

### 4.6 Admin

Internal operations user.

Permissions:

- View all users/listings.
- Approve/reject listings.
- Suspend users.
- Resolve reports.
- Manage categories and metadata.
- View analytics.

### 4.7 Super Admin

Permissions:

- All admin permissions.
- Manage admin users.
- Configure system rules.
- Manage city launches.
- Manage monetization settings.

## 5. Core Modules

### 5.1 Authentication Module

Functional requirements:

- System shall allow login/signup using Indian mobile number.
- System shall send OTP through SMS provider.
- System shall verify OTP before account activation.
- System shall support retry OTP with cooldown.
- System shall prevent excessive OTP requests.
- System shall allow logout.
- System shall support account deactivation request.

Business rules:

- Mobile number must be unique.
- OTP should expire after a configured duration.
- Too many failed OTP attempts should temporarily lock verification.

Acceptance criteria:

- User can sign up with phone number and OTP.
- User cannot post or contact without successful OTP verification.
- Duplicate phone number logs into existing account.

### 5.2 User Profile Module

Functional requirements:

- User shall be able to add name, profile photo, gender optional, age optional, city, locality, languages, skills, and bio.
- User shall be able to select role preferences: find work, hire, offer service, sell, rent.
- User shall be able to add preferred work categories.
- User shall be able to set availability: today, this week, weekends, custom.
- User shall be able to edit profile.
- System shall show trust indicators on profile.

Trust indicators:

- Phone verified.
- ID verified, later.
- Employer verified, later.
- Rating.
- Completed interactions.
- Response time.
- Joined date.

Business rules:

- Phone verification is mandatory.
- ID verification is optional in MVP unless high-risk category requires it later.
- Profile completeness should be calculated as a percentage.

Acceptance criteria:

- Profile can be created in under 2 minutes.
- Profile page shows user listings, ratings, and trust signals.

### 5.3 Location Module

Functional requirements:

- System shall ask user to select or detect location.
- User shall be able to manually choose city/locality.
- Feed shall use selected location for nearby listings.
- User shall be able to change location.
- Listing shall store latitude, longitude, city, locality, and approximate display address.

Business rules:

- Exact address should not be exposed publicly unless user chooses.
- MVP default radius should be configurable, recommended 5 km.
- Users can filter within 1 km, 3 km, 5 km, 10 km, and city-wide.

Acceptance criteria:

- Feed changes when user changes location.
- Listing cards show approximate distance.

### 5.4 Unified Feed Module

Functional requirements:

- System shall display listings from Job, Service, Sell, and Rent categories in one feed.
- Feed cards shall use a consistent layout.
- Each card shall show title, category badge, price/pay, distance, posted time, trust score/rating, and primary action.
- Feed shall support infinite scroll or pagination.
- Feed shall prioritize active, nearby, relevant, and trusted listings.

Sorting logic for MVP:

1. Active status.
2. Location proximity.
3. Recency.
4. Category preference.
5. Trust score.

Future ranking:

- AI recommendation score.
- User behavior.
- Completion probability.
- Fraud risk.

Acceptance criteria:

- User can open app and see local listings without selecting category.
- Feed loads within acceptable performance target.
- Expired/closed listings do not dominate feed.

### 5.5 Search And Filter Module

Functional requirements:

- User shall be able to search by keyword.
- User shall be able to filter by category.
- User shall be able to filter by distance.
- User shall be able to filter by price/pay range.
- User shall be able to filter by urgency: today, immediate, this week.
- User shall be able to filter by verification status later.
- User shall be able to clear filters.

Category filters:

- Jobs.
- Services.
- Buy/Sell.
- Rent.

Acceptance criteria:

- Filter changes update feed results.
- User can return to unified feed by clearing filters.

### 5.6 Listing Creation Module

Functional requirements:

- User shall tap Post from bottom navigation.
- User shall select listing type: Job, Service, Sell, Rent.
- System shall show dynamic fields by type.
- User shall preview listing before publishing.
- Listing shall be published or sent to moderation depending on rules.
- User shall be able to edit, pause, close, delete, or renew listing.

Common fields:

- Title.
- Description.
- Category.
- Price/pay.
- Location.
- Images optional depending on type.
- Contact preference.
- Urgency.
- Expiry date.

Business rules:

- Required fields must be validated.
- Suspicious words or high-risk categories may trigger manual review.
- Duplicate posts should be flagged.
- Posting flow target: under 30 seconds for common listings.

Acceptance criteria:

- User can create a valid listing.
- Invalid listing shows clear validation errors.
- Listing appears in user's profile and feed after approval/live status.

### 5.7 Job Listing Requirements

Fields:

- Job title.
- Work type: 2-hour, 4-hour, full-day, weekly, monthly, part-time.
- Pay amount.
- Pay frequency: hourly, daily, weekly, monthly, fixed.
- Work date/time.
- Location.
- Required skills.
- Number of workers required.
- Gender preference, only if legally and operationally appropriate.
- Food/accommodation provided, optional.
- Contact preference.
- Employer type: individual, shop, company, agency.

Business rules:

- Upfront fee jobs must be blocked or reviewed.
- Jobs with suspicious income claims must be reviewed.
- Night jobs should show safety warning.
- Employer verification may be required for repeated hiring.

Acceptance criteria:

- Employer can post a job.
- Earner can contact employer.
- Employer can mark listing as hired or closed.

### 5.8 Service Listing Requirements

Fields:

- Service title.
- Service category.
- Starting price.
- Service area radius.
- Availability.
- Experience.
- Portfolio images optional.
- Languages.
- Home visit available yes/no.

Business rules:

- Service providers can maintain active service listings.
- Reviews should be attached to provider and service category.
- Price suggestions may be added later.

Acceptance criteria:

- Service provider can create a service listing.
- Client can contact provider.
- Listing shows rating and response time.

### 5.9 Sell Listing Requirements

Fields:

- Product title.
- Product category.
- Condition: new, like new, used, needs repair.
- Price.
- Negotiable yes/no.
- Images.
- Location.
- Description.

Business rules:

- High-value products may require extra review.
- Suspicious or prohibited products must be blocked.
- Listing can be marked sold.

Acceptance criteria:

- Seller can post product with images.
- Buyer can contact seller.
- Seller can mark sold.

### 5.10 Rent Listing Requirements

Fields:

- Item title.
- Rental category.
- Price per hour/day/week/month.
- Deposit required.
- Availability dates.
- Images.
- Pickup/delivery option.
- Location.
- Terms.

Business rules:

- MVP rental transactions happen offline.
- High-value rentals should be marked as "verification recommended."
- Later phases may require ID verification and deposit handling.

Acceptance criteria:

- Owner can post rental item.
- Renter can contact owner.
- Owner can pause or close listing.

### 5.11 Listing Detail Module

Functional requirements:

- System shall display complete listing details.
- System shall show owner profile summary.
- System shall show trust indicators.
- System shall show call/chat actions.
- System shall show report and share options.
- System shall show similar nearby listings.

Acceptance criteria:

- User can understand pay/price, location, category, owner trust, and action options from listing detail.

### 5.12 Call And Chat Module

Functional requirements:

- User shall be able to initiate call from listing.
- System shall log call intent event.
- User shall be able to initiate chat from listing.
- Chat shall support text messages.
- Chat shall support image sharing later.
- System shall create interaction record for each listing contact.

Business rules:

- Users must be logged in to contact.
- Abusive users can be blocked.
- Contact limits may apply to prevent spam.

Acceptance criteria:

- Contact action creates interaction history.
- User can block/report from chat.

### 5.13 Interaction And Status Module

Functional requirements:

- System shall track listing interactions.
- Owner shall be able to mark status: open, in discussion, hired/booked, completed, closed.
- Interested user shall be able to mark "contacted" or "work completed" where applicable.
- System shall request ratings after completion.

Statuses:

- Draft.
- Pending review.
- Active.
- Paused.
- In discussion.
- Hired/booked.
- Completed.
- Closed.
- Rejected.
- Removed.

Acceptance criteria:

- Listing lifecycle is visible to owner.
- Closed listings cannot receive new leads unless reopened.

### 5.14 Ratings And Reviews Module

Functional requirements:

- Users shall be able to rate each other after a completed interaction.
- Rating shall be 1-5 stars.
- Review text optional.
- System shall calculate average rating.
- System shall show rating count.

Business rules:

- Only users with interaction history can rate.
- Duplicate ratings for same interaction not allowed.
- Admin can hide abusive reviews.

Acceptance criteria:

- Completed interaction triggers rating prompt.
- Rating appears on profile after submission.

### 5.15 Verification Module

MVP:

- Phone verified badge.
- Manual employer verification flag by admin.

Later:

- ID verification.
- Business verification.
- Face match.
- Address proof.
- Skill certificate upload.

Functional requirements:

- User shall see verification status.
- Admin shall update verification status.
- System shall store verification method, status, timestamp, and reviewer.

Statuses:

- Not started.
- Pending.
- Verified.
- Rejected.
- Expired.

Acceptance criteria:

- Verified users show badge.
- Rejected verification does not expose sensitive reason publicly.

### 5.16 Report, Block, And Safety Module

Functional requirements:

- User shall be able to report listing.
- User shall be able to report user.
- User shall be able to block user.
- Admin shall receive report queue.
- System shall allow admin action: warn, remove listing, suspend user, dismiss report.

Report reasons:

- Fake job.
- Asked for money.
- Fraud/scam.
- Harassment.
- Wrong category.
- Illegal/prohibited item.
- Payment issue.
- No-show.
- Unsafe behavior.
- Other.

Acceptance criteria:

- Report creates admin case.
- Blocked user cannot chat with blocker.

### 5.17 Notifications Module

Functional requirements:

- System shall send notification for new chat.
- System shall send notification for listing contact.
- System shall send notification for listing approval/rejection.
- System shall send notification for saved search matches later.
- System shall send notification for rating reminder.

Channels:

- Push notification.
- SMS for critical events, optional.
- WhatsApp later, subject to policy and consent.

Acceptance criteria:

- User receives notification for important listing and chat events.

### 5.18 Admin Panel Module

Functional requirements:

- Admin shall log in securely.
- Admin shall view dashboard metrics.
- Admin shall view listing queue.
- Admin shall approve/reject listings.
- Admin shall view user profiles.
- Admin shall suspend/reactivate users.
- Admin shall resolve reports.
- Admin shall manage categories and prohibited keywords.
- Admin shall view audit logs.

Dashboard metrics:

- New users.
- Active users.
- Listings posted.
- Listings pending review.
- Reports open.
- Successful interactions.
- Top categories.
- Top localities.

Acceptance criteria:

- Admin can moderate reported listing within panel.
- All admin actions are logged.

### 5.19 Analytics Module

Functional requirements:

- System shall track key product events.
- System shall support funnel analysis.
- System shall track city/locality/category performance.

Events:

- App opened.
- Location selected.
- Feed viewed.
- Listing viewed.
- Filter applied.
- Listing posted.
- Listing approved.
- Call clicked.
- Chat started.
- Listing saved.
- Listing shared.
- Listing reported.
- User blocked.
- Status changed.
- Rating submitted.

Acceptance criteria:

- Product team can measure north-star metric and conversion funnels.

### 5.20 Monetization Module

MVP:

- No mandatory worker charges.
- Admin-configured free plans.

Post-MVP:

- Featured listing.
- Urgent boost.
- Employer subscription.
- Pay per lead.
- Premium service provider profile.

Functional requirements:

- System shall allow listing boost purchase later.
- System shall mark boosted listing.
- System shall track paid plan status.
- System shall support invoice/receipt generation later.

Acceptance criteria:

- Employer can purchase boost in post-MVP phase.
- Boosted listing appears with ranking advantage and label.

## 6. Data Requirements

### 6.1 User Entity

Fields:

- user_id.
- phone.
- phone_verified.
- name.
- profile_photo_url.
- city.
- locality.
- latitude.
- longitude.
- languages.
- user_roles.
- status.
- created_at.
- updated_at.

### 6.2 Profile Entity

Fields:

- profile_id.
- user_id.
- bio.
- skills.
- availability.
- experience_years.
- preferred_categories.
- profile_completeness.
- rating_average.
- rating_count.
- completed_count.
- response_time_score.
- verification_status.

### 6.3 Listing Entity

Fields:

- listing_id.
- owner_user_id.
- listing_type.
- title.
- description.
- price_amount.
- price_unit.
- negotiable.
- city.
- locality.
- latitude.
- longitude.
- distance_visibility_level.
- urgency.
- status.
- moderation_status.
- risk_score.
- created_at.
- updated_at.
- expires_at.

### 6.4 Listing Metadata Entities

Job metadata:

- work_duration.
- pay_frequency.
- required_skills.
- workers_required.
- work_date_time.
- employer_type.

Service metadata:

- service_category.
- service_radius.
- availability.
- home_visit.
- portfolio_urls.

Sell metadata:

- product_category.
- condition.
- image_urls.

Rent metadata:

- rental_category.
- rental_unit.
- deposit_amount.
- availability_dates.
- terms.
- image_urls.

### 6.5 Interaction Entity

Fields:

- interaction_id.
- listing_id.
- owner_user_id.
- interested_user_id.
- interaction_type.
- status.
- created_at.
- completed_at.

### 6.6 Report Entity

Fields:

- report_id.
- reporter_user_id.
- reported_user_id.
- listing_id.
- reason.
- details.
- status.
- admin_notes.
- created_at.
- resolved_at.

### 6.7 Rating Entity

Fields:

- rating_id.
- interaction_id.
- from_user_id.
- to_user_id.
- rating.
- review_text.
- status.
- created_at.

### 6.8 Admin Action Entity

Fields:

- action_id.
- admin_user_id.
- entity_type.
- entity_id.
- action_type.
- old_value.
- new_value.
- reason.
- created_at.

## 7. Business Rules

### 7.1 Posting Rules

- Users must be logged in and phone verified to post.
- Title and category are mandatory.
- Location is mandatory.
- Pay/price is mandatory for Job, Sell, and Rent.
- Images are mandatory for Sell and recommended for Rent.
- Suspicious listings may require manual review.
- Prohibited items and illegal services must be blocked.

### 7.2 Contact Rules

- Users must be logged in to contact.
- Contact limits may be applied to new accounts.
- Reported/suspended users cannot contact others.
- Users blocked by another user cannot message that user.

### 7.3 Moderation Rules

- High-risk keywords trigger review.
- Repeated reports increase user risk score.
- Admin can remove listing immediately for safety reasons.
- Suspended users cannot post or contact.

### 7.4 Rating Rules

- Only interacted users can rate.
- Rating is allowed after completed/closed interaction.
- Admin may hide abusive or fake reviews.

### 7.5 Monetization Rules

- Workers are free during MVP.
- Employer boosts and subscriptions are optional post-MVP.
- Paid features must not hide critical safety information.

## 8. Non-Functional Requirements

### 8.1 Performance

- Feed first load should target under 3 seconds on common 4G connections.
- Listing detail should load under 2 seconds after feed card tap.
- Posting flow should submit within 3 seconds after user taps publish, excluding image upload delay.

### 8.2 Availability

- MVP target availability: 99%.
- Admin panel should remain available during moderation hours.

### 8.3 Scalability

- System should support city-wise rollout.
- Data model should support millions of listings over time.
- Search and feed APIs should support pagination and filtering.

### 8.4 Security

- OTP abuse protection.
- Secure admin login.
- Role-based access control.
- Sensitive data encrypted at rest where applicable.
- Audit logs for admin actions.
- Rate limiting for contact and posting.

### 8.5 Privacy

- Exact address should not be exposed by default.
- Phone number masking should be considered after MVP.
- Users should be able to report privacy issues.
- Data collection should be minimized.

### 8.6 Accessibility And Usability

- Mobile-first UI.
- Large tap targets.
- Low text burden.
- Local language-ready.
- Works on low-end Android devices.
- Clear labels and icons.

## 9. Phased Delivery Plan

### Phase 1: MVP

Modules:

- Authentication.
- Profile.
- Location.
- Unified feed.
- Listing creation.
- Listing detail.
- Search/filter.
- Call/chat initiation.
- Report/block.
- Basic ratings.
- Admin moderation.
- Analytics events.

### Phase 2: Trust And Growth

Modules:

- Verification workflow.
- Employer dashboard.
- Saved searches.
- Referral system.
- Advanced notifications.
- AI spam/category detection.
- Local language support.

### Phase 3: Monetization

Modules:

- Listing boosts.
- Employer subscription.
- Pay per lead.
- Premium provider profiles.
- Payment proof.

### Phase 4: Transaction Safety

Modules:

- Escrow.
- Rental deposit handling.
- Agreements.
- Dispute workflow.
- Insurance/protection integrations.

### Phase 5: Intelligence And Scale

Modules:

- AI recommendation engine.
- Reliability score.
- Salary/price intelligence.
- Geo-attendance.
- City operations dashboard.
- Multilingual voice assistant.

## 10. MVP Acceptance Criteria

The MVP can be considered ready for controlled pilot when:

- User can register with phone OTP.
- User can create/edit profile.
- User can set location.
- User can view unified feed.
- User can create Job, Service, Sell, and Rent listings.
- User can filter by category and distance.
- User can open listing detail.
- User can call/chat from listing.
- User can report listing/user.
- Admin can review and remove listings.
- User can rate after interaction.
- Analytics track key events.
- Basic suspicious listing rules exist.
- App supports at least one pilot city/locality.

## 11. Dependencies

External dependencies:

- SMS OTP provider.
- Push notification service.
- Maps/location service.
- Image storage.
- Analytics tool.
- Payment gateway later.
- KYC provider later.
- WhatsApp Business API later, if used.

Internal dependencies:

- Category taxonomy.
- Prohibited listing policy.
- Moderation SOP.
- City launch plan.
- Support escalation process.
- Pricing plan for employer monetization.

## 12. Key Open Decisions

- Android native vs PWA for MVP.
- In-app chat from day one vs call-first model.
- Whether phone numbers are masked in MVP.
- First pilot city/locality.
- First monetizable category.
- Verification vendor.
- Admin staffing model.
- Local language priority.

## 13. Functional Assumptions

- Most early users will use Android phones.
- Many users will prefer calls over formal applications.
- Employers want fast contact, not long applicant tracking.
- Workers should not be charged during early liquidity building.
- Locality density is more important than national user count.
- Trust and moderation are core product features, not back-office extras.

