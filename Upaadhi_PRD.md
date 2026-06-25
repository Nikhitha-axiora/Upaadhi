# Upaadhi Product Requirements Document

## 1. Document Control

Product: Upaadhi

Document type: Product Requirements Document

Prepared by: Business Analyst

Primary inputs:

- Founder vision: Upaadhi as a zero-unemployment, hyperlocal income ecosystem.
- Feature concept: one unified feed for jobs, services, selling, and renting.
- CTO input: use day-one microservices with clear bounded contexts, keep listing behavior unified inside the Listing Service, and build moderation/trust foundations early.
- Strategic market analyst input: win one dense locality and one high-frequency category before expanding.
- Indian employment app landscape: Apna, WorkIndia, Urban Company, OLX, Quikr, WhatsApp groups, local agents.

## 2. Executive Summary

Upaadhi is a hyperlocal earning marketplace for India. It helps people find and post nearby income opportunities across daily work, local services, selling, and renting.

The product should not start as a heavy "AI ecosystem." It should start as a fast, simple local feed where a user can:

- Find nearby earning opportunities in under 5 seconds.
- Post a work/service/sell/rent listing in under 30 seconds.
- Contact the other party through call or chat immediately.
- Build trust through profile, ratings, verification, and work history.

The long-term ambition is to become India's local income infrastructure. The short-term execution must be narrow, fast, and trust-led.

## 3. Product Vision

### 3.1 Vision Statement

To make daily income opportunities accessible to every Indian through a simple, trusted, hyperlocal marketplace.

### 3.2 Product Promise

Find nearby work. Post nearby work. Earn today.

### 3.3 Strategic Positioning

Upaadhi is not only:

- A jobs app.
- A freelance app.
- A classifieds app.
- A rental app.

Upaadhi is:

> A local earning marketplace.

### 3.4 Core Product Idea

One feed. Everything earnable.

Users should not feel they are switching between four different apps. Jobs, services, products, and rentals should appear in one consistent feed with category tags and smart filters.

## 4. Market Context

### 4.1 India Employment And Gig Context

India has a large base of unemployed, underemployed, informal, and flexible workers. The opportunity is not only formal employment. It is daily income access.

Relevant signals:

- NITI Aayog estimated India's gig workforce at 7.7 million in 2020-21 and projected 23.5 million workers by 2029-30.
- Apna positions itself as India's leading jobs platform and advertises a large base of job seekers and career opportunities.
- WorkIndia focuses heavily on fast blue-collar and grey-collar hiring, including direct candidate calls and fast employer response.
- UPI adoption makes small-value, frequent local transactions more practical than before.

### 4.2 User Behavior Observations

Indian unemployed youth and informal workers often show these behaviors:

- Prefer immediate income over long application cycles.
- Prefer call or WhatsApp over long forms.
- Search for work through friends, agents, shops, posters, and local groups.
- Often lack formal resumes.
- May have skills but no digital proof of skill.
- Are sensitive to travel cost and distance.
- Need trust because fake jobs and agent fraud are common.
- May not pay upfront for job access.
- Respond better to local language, voice, and simple visual flows.
- Value same-day payment and weekly payment more than monthly salary promises.

### 4.3 Competitor Learnings

Apna:

- Strong in job discovery, job seeker scale, communities, resume/career tools, employer hiring.
- Learning for Upaadhi: large supply matters, but Upaadhi should avoid becoming only another job board.

WorkIndia:

- Strong in fast employer-candidate connection, direct calls, blue/grey collar roles.
- Learning for Upaadhi: speed matters more than perfect matching for local hiring.

Urban Company:

- Strong in managed local services.
- Learning for Upaadhi: trust, service quality, ratings, and standardized pricing matter.

OLX/Quikr:

- Strong in classifieds.
- Learning for Upaadhi: product resale is familiar, but fraud and low monetization must be handled carefully.

WhatsApp groups/local agents:

- Strong because they are local, fast, and familiar.
- Weak because they lack verification, structured discovery, and accountability.

Upaadhi's opportunity is to combine local speed with structured trust.

## 5. Problem Statement

### 5.1 Problems For Earners

- Inconsistent daily work.
- Dependence on local agents and informal networks.
- Lack of visibility for skills.
- Fake jobs and cheating.
- High travel cost for small jobs.
- No simple way to combine multiple income streams.
- No verified work history.
- No easy way to find nearby work by urgency, pay, distance, or skill.

### 5.2 Problems For Employers And Local Demand Creators

- Hard to find trusted workers quickly.
- High no-show and dropout rates.
- Expensive or unreliable agents.
- No quick replacement system.
- No simple way to hire for 2-hour, 4-hour, full-day, or weekly work.
- Limited trust signals before calling a worker.

### 5.3 Problems For Service Providers

- Lack of visibility outside their local circle.
- No standard pricing support.
- Difficulty building credibility.
- Payment uncertainty.
- Competition from unstructured referrals.

### 5.4 Problems For Local Commerce

- People want to sell unused goods quickly but face fraud/no-show risk.
- Renting assets is trust-heavy.
- Buyers and renters need local discovery, verification, and safety.

## 6. Goals And Success Metrics

### 6.1 Business Goals

- Create a dense hyperlocal marketplace for income opportunities.
- Build trust between earners, employers, service providers, buyers, sellers, and renters.
- Monetize employers and high-intent transactions without burdening workers early.
- Build a repeatable city launch model.

### 6.2 Product Goals

- One unified feed for all earning opportunities.
- Fast post creation.
- Fast contact between interested parties.
- Basic trust layer from day one.
- Operational moderation from day one.
- Data foundation for future AI matching and verification.

### 6.3 North-Star Metric

Successful local earning connections per day.

### 6.4 Supporting Metrics

- Daily active users.
- Daily active listings.
- Listings posted per day.
- Time from listing creation to first contact.
- Contact-to-completion rate.
- Repeat posting rate.
- Repeat earner activity.
- Employer paid conversion rate.
- Fraud/report rate.
- Verified profile percentage.
- Worker response rate.
- Employer response rate.
- Listing approval turnaround time.

## 7. Target Users And Personas

### 7.1 Persona A: Unemployed Youth

Profile:

- Age 18-29.
- May be 10th/12th pass, graduate, diploma holder, or college dropout.
- Uses Android phone and WhatsApp.
- Needs quick income.

Needs:

- Nearby work.
- Low-friction application.
- Call-based communication.
- Trustworthy employers.
- Skill-based opportunities.

Pain points:

- Long job processes.
- Fake vacancies.
- No resume.
- Travel cost.
- Family income pressure.

### 7.2 Persona B: Student Part-Time Earner

Profile:

- College student or fresher.
- Wants evening/weekend work.
- Open to tutoring, delivery, design, event help, sales, data entry.

Needs:

- Flexible timing.
- Short-duration tasks.
- Safety and transparent pay.
- Digital proof of completed work.

### 7.3 Persona C: Homemaker Or Woman Seeking Flexible Income

Profile:

- Needs local, safe, flexible work.
- May prefer home-based services, tutoring, tailoring, food, beauty, packing, online tasks.

Needs:

- Safety filters.
- Locality-based work.
- Verified clients/employers.
- Flexible timing.
- Privacy controls.

### 7.4 Persona D: Local Service Provider

Profile:

- Electrician, plumber, beautician, tutor, cleaner, driver, mechanic, designer, photographer.

Needs:

- More local leads.
- Profile credibility.
- Easy call/chat.
- Pricing guidance.
- Reviews and repeat customers.

### 7.5 Persona E: Small Business Employer

Profile:

- Shop owner, restaurant owner, salon owner, garage owner, event operator, warehouse operator.

Needs:

- Fast hiring.
- Low-cost leads.
- Nearby workers.
- Replacement for no-shows.
- Verified worker profiles.

### 7.6 Persona F: Seller/Renter

Profile:

- Person or small business wanting to sell or rent local assets.

Needs:

- Nearby buyers.
- Trust and identity checks.
- Price suggestion.
- Chat/call.
- Optional payment protection later.

## 8. Product Scope

### 8.1 MVP Scope

MVP must include:

- Phone OTP login.
- User profile.
- Unified feed.
- Listing creation.
- Category tagging: Job, Service, Sell, Rent.
- Location and distance filtering.
- Basic search.
- Listing detail page.
- Call and chat initiation.
- Save/share listing.
- Report listing/user.
- Basic ratings.
- Admin moderation panel.
- Notification system.

### 8.2 Post-MVP Scope

Post-MVP should include:

- Employer dashboard.
- Verification workflow.
- Advanced filters.
- AI spam detection.
- AI category suggestion.
- Price/pay suggestions.
- UPI payment proof.
- Work completion tracking.
- Paid boosts.
- Employer subscription.

### 8.3 Later Scope

Later roadmap:

- Escrow.
- Rental agreements.
- Damage protection.
- Worker insurance partnerships.
- Skill certification.
- Attendance and geo-validation.
- AI reliability score.
- Multilingual voice assistant.
- City operations dashboard.

### 8.4 Out Of Scope For MVP

- Full escrow system.
- Aadhaar/PAN mandatory verification.
- In-app wallet.
- Complex dispute arbitration.
- Guaranteed employment claim.
- AI behavior prediction.
- Insurance.
- Full B2B payroll.
- Nationwide launch.

## 9. Product Principles

- Speed over complexity.
- Trust over virality.
- Workers should not pay heavily early.
- Locality density over national vanity.
- One feed, category-aware behavior.
- Voice/call-friendly flows.
- Low text burden.
- Works well on low-end Android devices.
- AI should support the experience quietly.
- Every feature should improve earning, hiring, trust, or liquidity.

## 10. Core User Journeys

### 10.1 Earner Finds Work

1. User opens app.
2. Feed shows nearby opportunities.
3. User applies filters: distance, category, urgency, pay.
4. User opens listing.
5. User calls or chats.
6. Employer responds.
7. Work is completed offline.
8. Both users can mark complete and rate each other.

### 10.2 Employer Posts Work

1. Employer taps Post.
2. Selects Job.
3. Enters role, pay, location, date/time, duration, contact preference.
4. Publishes listing.
5. Listing goes live or enters moderation depending on risk score.
6. Candidates contact employer.
7. Employer marks hired/closed.
8. Employer rates worker.

### 10.3 Service Provider Gets Client

1. Provider creates profile and service listing.
2. Client discovers listing through feed/search.
3. Client calls/chats.
4. Provider completes work.
5. Client rates provider.

### 10.4 User Sells Product

1. User selects Sell.
2. Adds title, price, images, condition, location.
3. Buyer contacts seller.
4. Seller marks item sold.

### 10.5 User Rents Asset

MVP version:

1. User posts rental item.
2. Interested renter contacts owner.
3. Deal happens offline.
4. Users can rate/report.

Later version:

1. User posts rental item.
2. Renter verifies identity.
3. Deposit/payment held.
4. Rental agreement generated.
5. Return confirmed.
6. Deposit released.

## 11. Feature Prioritization

### 11.1 P0: Must Have

- OTP login.
- Unified feed.
- Listing creation.
- Listing detail.
- Filters.
- Call/chat.
- Profile.
- Report/block.
- Admin moderation.
- Basic notifications.
- Analytics events.

### 11.2 P1: Should Have

- Ratings.
- Verification badge.
- Employer dashboard.
- Listing boost.
- Saved searches.
- Referral system.
- AI spam/category suggestions.
- Payment proof upload.
- Local language support.

### 11.3 P2: Could Have

- Escrow.
- Rental agreements.
- Insurance.
- Skill tests.
- Attendance tracking.
- Geo-validation.
- Advanced AI matching.
- Voice assistant.

## 12. Monetization Strategy

### 12.1 Early Stage

- Free worker accounts.
- Free basic employer posting.
- Limited paid boosts after liquidity.

### 12.2 Employer Revenue

- Featured job post.
- Pay per verified candidate lead.
- Monthly employer subscription.
- Urgent hiring boost.
- Candidate database access.

### 12.3 Service Revenue

- Premium provider profile.
- Commission on booked services after payment flows exist.
- Verification fee.
- Portfolio boost.

### 12.4 Commerce Revenue

- Featured sell listing.
- Dealer subscription.
- Transaction protection fee.

### 12.5 Renting Revenue

- Rental commission.
- Deposit handling fee.
- Agreement fee.
- Protection/insurance partnership.

## 13. Trust And Safety Strategy

### 13.1 Day-One Controls

- Phone verification.
- Report listing.
- Report user.
- Block user.
- Admin moderation.
- Suspicious keyword rules.
- Duplicate post detection.
- Manual review for high-risk categories.

### 13.2 Trust Signals

- Verified phone.
- Optional ID verified.
- Employer verified.
- Rating.
- Response time.
- Completed work count.
- Joined date.
- Report history.
- Profile completeness.

### 13.3 Safety Considerations

Special care should be given to:

- Women users.
- Night jobs.
- Home visits.
- Cash collection jobs.
- Rental assets.
- High-value products.
- Jobs asking for upfront fees.
- Suspicious work-from-home offers.

## 14. Technical Direction From CTO Perspective

### 14.1 Architecture Principles

- Build mobile-first.
- Use a dedicated Listing Service with unified listing behavior and category-specific metadata.
- Keep service boundaries business-driven and avoid splitting tiny features into unnecessary services.
- Build admin tools early.
- Keep audit logs for trust and compliance.
- Design for future AI, payments, and verification.

### 14.2 Core Entities

- User.
- Profile.
- Listing.
- Listing category metadata.
- Interaction.
- Chat.
- Report.
- Rating.
- Verification.
- Payment proof.
- Subscription/boost.
- Notification.
- Admin action.

### 14.3 Platform Channels

MVP:

- Android app or responsive PWA.
- Admin web panel.

Later:

- iOS.
- Employer web dashboard.
- WhatsApp bot/assistant.

## 15. Launch Strategy

### 15.1 Pilot Market

Start in one dense locality or city cluster. Avoid nationwide launch at MVP.

Recommended first category:

- Daily jobs and local services.

Secondary category:

- Used product selling.

Delay:

- Complex renting, escrow, and insurance.

### 15.2 Pilot Targets

First 90 days:

- 5,000 registered users.
- 500 active earners.
- 100 active employers.
- 100 daily active listings.
- 30-50 successful earning connections per day.
- Less than 5% listings reported as fraudulent or misleading.

### 15.3 Acquisition Model

- Field onboarding.
- Local shop visits.
- QR posters.
- College and hostel campaigns.
- Labor locality onboarding.
- WhatsApp community seeding.
- Employer-assisted posting.
- Referral rewards.

## 16. Risks And Mitigation

| Risk | Impact | Mitigation |
|---|---:|---|
| Too broad product | High | Start with daily jobs and services |
| Low supply | High | Field onboarding and referral loops |
| Low demand | High | Anchor employers before launch |
| Fraud | High | Moderation, reports, verification |
| User bypass | Medium | Ratings, history, paid lead model |
| Low willingness to pay | Medium | Monetize employers first |
| Legal exposure | Medium | Avoid guaranteed employment claim |
| Operational overload | High | Limit categories and build admin tools |
| Poor retention | High | Notifications, saved searches, repeat employers |

## 17. Open Questions

- Which city/locality should be chosen for pilot?
- Should MVP be Android-native first or PWA first?
- Should chat be fully in-app from day one or use call/WhatsApp first?
- What is the first monetizable employer segment?
- What verification level is required before launch?
- What categories should be blocked or manually reviewed?
- Which local languages are required for pilot?

## 18. Source References

- NITI Aayog gig economy report: https://www.niti.gov.in/sites/default/files/2023-06/Policy_Brief_India%27s_Booming_Gig_and_Platform_Economy_27062022.pdf
- Apna platform reference: https://apna.co/
- WorkIndia platform reference: https://www.workindia.in/
- NPCI UPI statistics: https://www.npci.org.in/product/upi/product-statistics
- MoSPI PLFS reference: https://www.mospi.gov.in/themes/product/69-periodic-labour-force-survey-plfs
- Upaadhi internal feature document: D:\Products\Upadi\Upaadhi feature.docx
- Upadi AI internal concept document: D:\Products\Upadi\Upadi_AI.pdf
