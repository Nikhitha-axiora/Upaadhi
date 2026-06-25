import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Flag,
  Home,
  Inbox,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ApiResponse, FeedListing, Listing, ListingType, UserProfile } from "@upaadhi/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

const categories: Array<{ label: string; value: ListingType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Jobs", value: "job" },
  { label: "Services", value: "service" },
  { label: "Sell", value: "sell" },
  { label: "Rent", value: "rent" }
];

const categoryLabels: Record<ListingType, string> = {
  job: "Job",
  service: "Service",
  sell: "Sell",
  rent: "Rent"
};

const priceUnits: Record<FeedListing["priceUnit"], string> = {
  hour: "hr",
  day: "day",
  week: "week",
  month: "month",
  fixed: "fixed"
};

const verificationLabels: Record<UserProfile["verificationStatus"], string> = {
  none: "New member",
  phone_verified: "Phone verified",
  employer_verified: "Employer verified",
  id_verified: "ID verified"
};

function isVerified(status: UserProfile["verificationStatus"]) {
  return status !== "none";
}

function urgencyLabel(urgency: FeedListing["urgency"]) {
  return urgency.replace("_", " ");
}

interface Session {
  token: string;
  user: UserProfile;
}

export function App() {
  const [activeView, setActiveView] = useState<"feed" | "post" | "chats" | "profile">("feed");
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem("upaadhi.session");
    return stored ? (JSON.parse(stored) as Session) : null;
  });
  const [phone, setPhone] = useState("+919876543210");
  const [otp, setOtp] = useState("");
  const [loginStatus, setLoginStatus] = useState("Use the demo phone and request OTP.");
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [activeCategory, setActiveCategory] = useState<ListingType | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<FeedListing | null>(null);
  const [pendingListing, setPendingListing] = useState<Listing | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postPay, setPostPay] = useState("600");
  const [actionStatus, setActionStatus] = useState("Login to test posting, approval, report, call and chat actions.");

  useEffect(() => {
    if (session) {
      void loadFeed(activeCategory);
    }
  }, [activeCategory, session]);

  async function api<T>(path: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string> | undefined) ?? {})
    };

    if (init?.body) {
      headers["content-type"] = "application/json";
    }

    if (session?.token) {
      headers.authorization = `Bearer ${session.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = (await response.json()) as ApiResponse<T>;

    if (!body.success) {
      throw new Error(body.error.message);
    }

    return body.data;
  }

  async function requestOtp() {
    try {
      const data = await api<{ devOtp?: string }>("/api/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      setOtp(data.devOtp ?? "");
      setLoginStatus(data.devOtp ? `OTP generated for local testing: ${data.devOtp}` : "OTP sent.");
    } catch (error) {
      setLoginStatus(error instanceof Error ? error.message : "Unable to request OTP.");
    }
  }

  async function verifyOtp() {
    try {
      const data = await api<{ accessToken: string; user: UserProfile }>("/api/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, otp })
      });
      const nextSession = { token: data.accessToken, user: data.user };
      localStorage.setItem("upaadhi.session", JSON.stringify(nextSession));
      setSession(nextSession);
      setLoginStatus("Logged in.");
      setActionStatus("Logged in. Try creating a quick job.");
    } catch (error) {
      setLoginStatus(error instanceof Error ? error.message : "Unable to verify OTP.");
    }
  }

  function logout() {
    localStorage.removeItem("upaadhi.session");
    setSession(null);
    setListings([]);
    setSelectedListing(null);
    setPendingListing(null);
    setActionStatus("Logged out.");
  }

  async function loadFeed(category: ListingType | "all") {
    setIsLoading(true);
    const query = category === "all" ? "" : `?type=${category}`;

    try {
      const data = await api<{ listings: FeedListing[] }>(`/api/v1/feed${query}`);
      setListings(data.listings);
      setSelectedListing((current) => {
        if (current && data.listings.some((item) => item.id === current.id)) return current;
        return data.listings[0] ?? null;
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function createQuickPost() {
    try {
      const listing = await api<Listing>("/api/v1/listings", {
        method: "POST",
        body: JSON.stringify({
          type: "job",
          title: postTitle || "Part-time helper needed today",
          description: "Need help for local shop work. Call to confirm timing.",
          priceAmount: Number(postPay || 600),
          priceUnit: "day",
          locality: "Ameerpet",
          city: "Hyderabad",
          urgency: "today"
        })
      });
      setPostTitle("");
      setPendingListing(listing);
      setActionStatus(`Created listing "${listing.title}". Status: ${listing.status}. Approve it to show in feed.`);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Unable to create listing.");
    }
  }

  async function approvePendingListing() {
    if (!pendingListing) return;

    try {
      const listing = await api<Listing>(`/api/v1/admin/listings/${pendingListing.id}/approve`, { method: "POST" });
      setPendingListing(listing);
      setActionStatus(`Approved "${listing.title}". It should now appear in the feed.`);
      await loadFeed(activeCategory);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Unable to approve listing.");
    }
  }

  async function reportSelectedListing() {
    if (!selectedListing) return;

    try {
      const report = await api<{ id: string; status: string }>("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({
          listingId: selectedListing.id,
          reason: "user_test",
          details: "Reported from local feature test."
        })
      });
      setActionStatus(`Report created: ${report.id}. Status: ${report.status}.`);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Unable to report listing.");
    }
  }

  const stats = useMemo(
    () => [
      { label: "Nearby listings", value: listings.length || 0 },
      { label: "Avg response", value: "12 min" },
      { label: "Verified posts", value: "68%" }
    ],
    [listings.length]
  );

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-panel">
          <div className="brand large">
            <div className="brand-mark">U</div>
            <div>
              <strong>Upaadhi</strong>
              <span>Find nearby work. Earn today.</span>
            </div>
          </div>
          <h1>Login to test the local app</h1>
          <p>Use the demo phone number, request OTP, then verify. In local mode the OTP is shown here for testing.</p>
          <label>
            Phone number
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="primary-button full" type="button" onClick={() => void requestOtp()}>
            Request OTP
          </button>
          <label>
            OTP
            <input value={otp} onChange={(event) => setOtp(event.target.value)} />
          </label>
          <button className="secondary-button full" type="button" onClick={() => void verifyOtp()}>
            Verify and login
          </button>
          <div className="status-box">{loginStatus}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">U</div>
          <div>
            <strong>Upaadhi</strong>
            <span>Earn nearby</span>
          </div>
        </div>

        <nav className="nav-list">
          <button className={activeView === "feed" ? "active" : ""} type="button" onClick={() => setActiveView("feed")}>
            <Home size={18} /> Feed
          </button>
          <button className={activeView === "post" ? "active" : ""} type="button" onClick={() => setActiveView("post")}>
            <Plus size={18} /> Post
          </button>
          <button className={activeView === "chats" ? "active" : ""} type="button" onClick={() => setActiveView("chats")}>
            <MessageCircle size={18} /> Chats
          </button>
          <button className={activeView === "profile" ? "active" : ""} type="button" onClick={() => setActiveView("profile")}>
            <UserRound size={18} /> Profile
          </button>
        </nav>

        <div className="profile-mini">
          <div className="avatar">{session.user.name.slice(0, 1)}</div>
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.locality}</span>
          </div>
          <button className="icon-button" type="button" onClick={logout} aria-label="Logout">
            <LogOut size={17} />
          </button>
        </div>

        <div className="safety-note">
          <ShieldCheck size={20} />
          <p>Never pay money to get a job. Report suspicious listings anytime.</p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <button className="location-button" type="button">
            <MapPin size={18} />
            Ameerpet, Hyderabad
          </button>
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search work, services, products" />
          </div>
          <button className="icon-button" type="button" aria-label="Notifications">
            <Bell size={18} />
          </button>
        </header>

        {activeView === "feed" ? (
          <>
            <section className="hero-band">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} />
              One feed · Everything earnable
            </p>
            <h1>
              Find local work, services, selling and rent — and{" "}
              <span className="accent">earn today</span>, near you.
            </h1>
          </div>
          <button className="primary-button" type="button" onClick={() => setActionStatus("Use the quick post panel on the right.")}>
            <Plus size={18} />
            Post in 30 sec
          </button>
        </section>

        <section className="stats-row">
          {stats.map((item) => (
            <div className="stat" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>

        <div className="filter-row">
          {categories.map((item) => (
            <button
              className={activeCategory === item.value ? "chip active" : "chip"}
              key={item.value}
              type="button"
              onClick={() => setActiveCategory(item.value)}
            >
              {item.label}
            </button>
          ))}
          <button className="chip muted" type="button">
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        <div className="status-box">{actionStatus}</div>

        <section className="workspace">
          <div className="feed-column">
            <div className="section-heading">
              <h2>Nearby feed</h2>
              <span>{isLoading ? "Loading..." : `${listings.length} active`}</span>
            </div>

            <div className="listing-list">
              {isLoading && listings.length === 0
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div className="skeleton-card" key={`skeleton-${index}`} aria-hidden="true">
                      <div className="card-top">
                        <span className="sk pill" />
                        <span className="sk line short" />
                      </div>
                      <span className="sk title" />
                      <span className="sk line short" />
                      <span className="sk line mid" />
                    </div>
                  ))
                : listings.map((listing) => (
                    <button
                      className={selectedListing?.id === listing.id ? "listing-card selected" : "listing-card"}
                      key={listing.id}
                      type="button"
                      onClick={() => setSelectedListing(listing)}
                    >
                      <div className="card-top">
                        <span className="card-badges">
                          <span className={`badge ${listing.type}`}>{categoryLabels[listing.type]}</span>
                          <span className={`urgency ${listing.urgency}`}>
                            {listing.urgency === "immediate" || listing.urgency === "today" ? (
                              <Zap size={11} />
                            ) : (
                              <span className="dot" />
                            )}
                            {urgencyLabel(listing.urgency)}
                          </span>
                        </span>
                        <span>{formatPosted(listing.postedAt)}</span>
                      </div>
                      <h3>{listing.title}</h3>
                      <p className="price">
                        Rs {listing.priceAmount}
                        <span className="unit"> /{priceUnits[listing.priceUnit]}</span>
                      </p>
                      <p className="meta">
                        <MapPin size={15} />
                        {listing.distanceKm} km · {listing.locality}
                      </p>
                      <div className="trust-row">
                        {isVerified(listing.owner.verificationStatus) ? (
                          <span className="verified">
                            <BadgeCheck size={15} />
                            {verificationLabels[listing.owner.verificationStatus]}
                          </span>
                        ) : (
                          <span>
                            <ShieldCheck size={15} />
                            Trust {listing.trustScore}
                          </span>
                        )}
                        <span className="rating">
                          <Star size={15} />
                          {listing.owner.rating}
                        </span>
                        <span>
                          <Clock size={15} />
                          {listing.owner.responseTimeMinutes} min
                        </span>
                      </div>
                    </button>
                  ))}

              {!isLoading && listings.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Inbox size={26} />
                  </span>
                  <strong>No listings nearby yet</strong>
                  <p>Try increasing distance or changing the category filter.</p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="detail-panel">
            {selectedListing ? (
              <>
                <div className="detail-head">
                  <span className={`badge ${selectedListing.type}`}>{categoryLabels[selectedListing.type]}</span>
                  <span className={`urgency ${selectedListing.urgency}`}>
                    {selectedListing.urgency === "immediate" || selectedListing.urgency === "today" ? (
                      <Zap size={11} />
                    ) : (
                      <span className="dot" />
                    )}
                    {urgencyLabel(selectedListing.urgency)}
                  </span>
                </div>
                <h2>{selectedListing.title}</h2>
                <p className="detail-price">
                  Rs {selectedListing.priceAmount}
                  <span className="unit"> /{priceUnits[selectedListing.priceUnit]}</span>
                </p>
                <p className="detail-copy">{selectedListing.description}</p>

                <div className="detail-grid">
                  <div>
                    <span>Distance</span>
                    <strong>{selectedListing.distanceKm} km</strong>
                  </div>
                  <div>
                    <span>Urgency</span>
                    <strong>{selectedListing.urgency.replace("_", " ")}</strong>
                  </div>
                </div>

                <div className="owner-box">
                  <div className="avatar">{selectedListing.owner.name.slice(0, 1)}</div>
                  <div>
                    <strong>{selectedListing.owner.name}</strong>
                    <span>
                      {verificationLabels[selectedListing.owner.verificationStatus]} ·{" "}
                      {selectedListing.owner.completedCount} completed · replies in{" "}
                      {selectedListing.owner.responseTimeMinutes} min
                    </span>
                  </div>
                  {isVerified(selectedListing.owner.verificationStatus) ? (
                    <BadgeCheck size={22} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </div>

                <div className="action-row">
                  <button className="primary-button" type="button" onClick={() => setActionStatus(`Call clicked for ${selectedListing.title}.`)}>
                    <Phone size={18} />
                    Call
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setActionStatus(`Chat opened for ${selectedListing.title}.`)}>
                    <MessageCircle size={18} />
                    Chat
                  </button>
                </div>
                <button className="danger-button full" type="button" onClick={() => void reportSelectedListing()}>
                  <Flag size={18} />
                  Report listing
                </button>
              </>
            ) : (
              <p>No listing selected.</p>
            )}

            <div className="quick-post">
              <h3>Post quick job</h3>
              <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Job title" />
              <input value={postPay} onChange={(event) => setPostPay(event.target.value)} placeholder="Pay per day" />
              <button className="primary-button full" type="button" onClick={() => void createQuickPost()}>
                <BriefcaseBusiness size={18} />
                Publish for review
              </button>

              {pendingListing ? (
                <div className="review-box">
                  <span>Latest post: {pendingListing.status}</span>
                  <strong>{pendingListing.title}</strong>
                  <button className="secondary-button full" type="button" onClick={() => void approvePendingListing()}>
                    Approve and show in feed
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
          </>
        ) : null}

        {activeView === "post" ? (
          <section className="module-panel">
            <div className="section-heading">
              <h2>Post opportunity</h2>
              <span>Create local earning posts</span>
            </div>
            <p className="module-copy">Create a quick job listing. It starts under review, then you can approve it locally to test the moderation flow.</p>
            <div className="post-form-grid">
              <label>
                Job title
                <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Helper needed today" />
              </label>
              <label>
                Pay per day
                <input value={postPay} onChange={(event) => setPostPay(event.target.value)} placeholder="600" />
              </label>
              <button className="primary-button full" type="button" onClick={() => void createQuickPost()}>
                <BriefcaseBusiness size={18} />
                Publish for review
              </button>
            </div>
            {pendingListing ? (
              <div className="review-box module-review">
                <span>Latest post: {pendingListing.status}</span>
                <strong>{pendingListing.title}</strong>
                <button className="secondary-button full" type="button" onClick={() => void approvePendingListing()}>
                  Approve and show in feed
                </button>
              </div>
            ) : null}
            <div className="status-box">{actionStatus}</div>
          </section>
        ) : null}

        {activeView === "chats" ? (
          <section className="module-panel">
            <div className="section-heading">
              <h2>Chats</h2>
              <span>Local demo module</span>
            </div>
            <div className="chat-list">
              <button className="chat-row" type="button" onClick={() => setActionStatus("Opened chat with Lakshmi Stores.")}>
                <div className="avatar">L</div>
                <div>
                  <strong>Lakshmi Stores</strong>
                  <span>Can you come today at 10 AM?</span>
                </div>
                <span className="chat-time">2 min</span>
              </button>
              <button className="chat-row" type="button" onClick={() => setActionStatus("Opened chat with Neha Designs.")}>
                <div className="avatar">N</div>
                <div>
                  <strong>Neha Designs</strong>
                  <span>Logo service details shared.</span>
                </div>
                <span className="chat-time">1 hr</span>
              </button>
            </div>
            <div className="status-box">{actionStatus}</div>
          </section>
        ) : null}

        {activeView === "profile" ? (
          <section className="module-panel">
            <div className="section-heading">
              <h2>Profile</h2>
              <span>Trust and earning identity</span>
            </div>
            <div className="profile-card">
              <div className="avatar large-avatar">{session.user.name.slice(0, 1)}</div>
              <div>
                <h3>{session.user.name}</h3>
                <p>{session.user.locality}, {session.user.city}</p>
                <div className="trust-row profile-trust">
                  <span><ShieldCheck size={15} /> {session.user.verificationStatus.replace("_", " ")}</span>
                  <span><Star size={15} /> {session.user.rating}</span>
                  <span>{session.user.completedCount} completed</span>
                </div>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat">
                <strong>{session.user.responseTimeMinutes} min</strong>
                <span>Avg response</span>
              </div>
              <div className="stat">
                <strong>{session.user.completedCount}</strong>
                <span>Completed works</span>
              </div>
              <div className="stat">
                <strong>{session.user.skills.length}</strong>
                <span>Skills added</span>
              </div>
            </div>

            <div className="progress-block">
              <div className="progress-top">
                Profile strength <span>80%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: "80%" }} />
              </div>
              <p className="progress-hint">Add 2 skills to improve your matches and get more responses.</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function formatPosted(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}
