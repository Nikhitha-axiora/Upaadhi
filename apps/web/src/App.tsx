import {
  BadgeCheck,
  Bell,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Command as CommandIcon,
  Flag,
  Home,
  Inbox,
  Lock,
  LogOut,
  MapPin,
  MapPinned,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  Phone,
  Plus,
  SendHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  UserRound,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ApiResponse,
  FeedListing,
  KycLocation,
  KycStatus,
  Listing,
  ListingStatus,
  ListingType,
  UserProfile,
  VerificationRecord,
  VerificationSubmission
} from "@upaadhi/shared";
import { daysUntilExpiry, idTypeLabels } from "@upaadhi/shared";
import { VerificationModal, downscaleToDataUrl } from "./verification";
import { LocationPicker, type PlaceSelection } from "./location";
import {
  Avatar,
  CommandPalette,
  Counter,
  Modal,
  ToastViewport,
  toast,
  useCommandPalette,
  useLocalStorage,
  useTheme,
  type CommandItem
} from "./ui";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

type View = "feed" | "saved" | "post" | "chats" | "profile";
type SortKey = "best" | "near" | "new" | "rating";

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

const priceUnitOptions: Array<FeedListing["priceUnit"]> = ["hour", "day", "week", "month", "fixed"];
const urgencyOptions: Array<FeedListing["urgency"]> = ["immediate", "today", "this_week", "flexible"];
const postTypeOptions: ListingType[] = ["job", "service", "sell", "rent"];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "best", label: "Best match" },
  { value: "near", label: "Nearest first" },
  { value: "new", label: "Newest first" },
  { value: "rating", label: "Top rated" }
];

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

function formatPosted(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr ago`;
  return `${Math.round(minutes / (60 * 24))} d ago`;
}

interface Session {
  token: string;
  refreshToken?: string;
  user: UserProfile;
}

interface SessionView {
  id: string;
  device: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

interface SecurityEventView {
  id: string;
  type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  ip?: string;
  device?: string;
  at: string;
}

interface ChatMessage {
  id: number;
  from: "me" | "them";
  text: string;
  at: number;
}

interface ChatThread {
  id: string;
  name: string;
  context: string;
  messages: ChatMessage[];
}

const quickReplies = [
  "Yes, I'm available. When should I come?",
  "Please share the exact location.",
  "Sure — what time works for you?",
  "I can do this. Let's confirm the rate."
];

let chatSeq = 0;

export function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();

  const [activeView, setActiveView] = useState<View>("feed");
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem("upaadhi.session");
    return stored ? (JSON.parse(stored) as Session) : null;
  });

  // Auth
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [loginMethod, setLoginMethod] = useState<"otp" | "password">("otp");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+919876543210");
  const [otp, setOtp] = useState("");
  const [loginStatus, setLoginStatus] = useState("Log in with OTP or password, or create a new account.");
  const [otpRequested, setOtpRequested] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // Feed
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [activeCategory, setActiveCategory] = useState<ListingType | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("best");
  const [maxDistance, setMaxDistance] = useState(10);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Saved + chats persisted locally
  const [savedIds, setSavedIds] = useLocalStorage<string[]>("upaadhi.saved", []);
  const [threads, setThreads] = useLocalStorage<ChatThread[]>("upaadhi.threads", []);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [extraSkills, setExtraSkills] = useLocalStorage<string[]>("upaadhi.skills", []);
  const [skillDraft, setSkillDraft] = useState("");

  // Post form
  const [postType, setPostType] = useState<ListingType>("job");
  const [postTitle, setPostTitle] = useState("");
  const [postDesc, setPostDesc] = useState("");
  const [postPay, setPostPay] = useState("600");
  const [postUnit, setPostUnit] = useState<FeedListing["priceUnit"]>("day");
  const [postUrgency, setPostUrgency] = useState<FeedListing["urgency"]>("today");
  const [postLocality, setPostLocality] = useState("Ameerpet");
  const [pendingListing, setPendingListing] = useState<Listing | null>(null);

  const [notifOpen, setNotifOpen] = useState(false);

  // Verification (KYC) + location consent
  const [kyc, setKyc] = useState<VerificationRecord | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [geo, setGeo] = useState<KycLocation | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  // Profile photo, my posts, and global location picker
  const [avatarUrl, setAvatarUrl] = useLocalStorage<string | null>("upaadhi.avatar", null);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [place, setPlace] = useLocalStorage<PlaceSelection | null>("upaadhi.place", null);
  const [locationOpen, setLocationOpen] = useState(false);

  const kycVerified = kyc?.kycStatus === "verified";

  // Security UI (sessions + activity)
  const [securitySessions, setSecuritySessions] = useState<SessionView[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventView[]>([]);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  // Stable per-install device id — sent on every request for device tracking.
  const [deviceId] = useState(() => {
    let stored = localStorage.getItem("upaadhi.device");
    if (!stored) {
      stored = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dev_${Date.now()}`;
      localStorage.setItem("upaadhi.device", stored);
    }
    return stored;
  });

  const sessionRef = useRef<Session | null>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const persistSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) localStorage.setItem("upaadhi.session", JSON.stringify(next));
    else localStorage.removeItem("upaadhi.session");
  }, []);

  // Rotate the refresh token transparently when the short-lived access token expires.
  const refreshSession = useCallback(async () => {
    const refreshToken = sessionRef.current?.refreshToken;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ refreshToken })
      });
      const body = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
      if (!body.success) return false;
      const current = sessionRef.current;
      if (!current) return false;
      persistSession({ ...current, token: body.data.accessToken, refreshToken: body.data.refreshToken });
      return true;
    } catch {
      return false;
    }
  }, [deviceId, persistSession]);

  useEffect(() => {
    if (session) void loadFeed(activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, session]);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit, retry = true): Promise<T> => {
      const run = async () => {
        const headers: Record<string, string> = {
          ...((init?.headers as Record<string, string> | undefined) ?? {})
        };
        if (init?.body) headers["content-type"] = "application/json";
        headers["x-device-id"] = deviceId;
        const token = sessionRef.current?.token;
        if (token) headers.authorization = `Bearer ${token}`;
        const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
        return { response, body: (await response.json()) as ApiResponse<T> };
      };

      let { response, body } = await run();
      // Access token expired? Rotate the refresh token once and retry transparently.
      if (
        !body.success &&
        retry &&
        response.status === 401 &&
        sessionRef.current?.refreshToken &&
        !path.startsWith("/api/v1/auth/")
      ) {
        if (await refreshSession()) ({ response, body } = await run());
      }
      if (!body.success) throw new Error(body.error.message);
      return body.data;
    },
    [deviceId, refreshSession]
  );

  async function requestOtp() {
    try {
      const data = await api<{ devOtp?: string }>("/api/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      setOtp(data.devOtp ?? "");
      setOtpRequested(true);
      setLoginStatus(data.devOtp ? `Dev OTP autofilled: ${data.devOtp}` : "OTP sent to your phone.");
      toast.success("OTP generated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to request OTP.";
      setLoginStatus(message);
      toast.error(message);
    }
  }

  function applyAuth(
    data: { accessToken: string; refreshToken: string; newDevice?: boolean; user: UserProfile },
    greeting: string
  ) {
    persistSession({ token: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    setLoginStatus("Logged in.");
    setPassword("");
    setOtp("");
    toast.success(`${greeting}, ${data.user.name.split(" ")[0]}`);
    if (data.newDevice) toast.warning("New device sign-in detected on your account");
  }

  type AuthResponse = { accessToken: string; refreshToken: string; newDevice?: boolean; user: UserProfile };

  async function verifyOtp() {
    setAuthBusy(true);
    try {
      const data = await api<AuthResponse>("/api/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, otp })
      });
      applyAuth(data, "Welcome back");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify OTP.";
      setLoginStatus(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function loginWithPassword() {
    setAuthBusy(true);
    try {
      const data = await api<AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, password })
      });
      applyAuth(data, "Welcome back");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to log in.";
      setLoginStatus(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function register() {
    setAuthBusy(true);
    try {
      const data = await api<AuthResponse>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, phone, password })
      });
      applyAuth(data, "Welcome to Upaadhi");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account.";
      setLoginStatus(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    // Best-effort server-side session revocation, then clear local state.
    void api("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({}) }, false).catch(() => undefined);
    persistSession(null);
    setListings([]);
    setSelectedId(null);
    setPendingListing(null);
    setOtpRequested(false);
    setSecuritySessions([]);
    setSecurityEvents([]);
    setMyListings([]);
    setActiveView("feed");
    toast.info("Signed out");
  }

  const loadSecurity = useCallback(async () => {
    try {
      const [sessionList, events] = await Promise.all([
        api<SessionView[]>("/api/v1/auth/sessions"),
        api<SecurityEventView[]>("/api/v1/auth/security-events")
      ]);
      setSecuritySessions(sessionList);
      setSecurityEvents(events);
    } catch {
      /* non-fatal */
    }
  }, [api]);

  const loadMyListings = useCallback(async () => {
    try {
      setMyListings(await api<Listing[]>("/api/v1/me/listings"));
    } catch {
      /* non-fatal */
    }
  }, [api]);

  async function signOutOtherDevices() {
    try {
      const result = await api<{ revokedSessions: number }>("/api/v1/auth/logout-all", {
        method: "POST",
        body: JSON.stringify({})
      });
      toast.success(`Signed out of ${result.revokedSessions} other device(s)`);
      void loadSecurity();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out other devices.");
    }
  }

  async function loadFeed(category: ListingType | "all") {
    setIsLoading(true);
    const queryString = category === "all" ? "" : `?type=${category}`;
    try {
      const data = await api<{ listings: FeedListing[] }>(`/api/v1/feed${queryString}`);
      setListings(data.listings);
      setSelectedId((current) =>
        current && data.listings.some((item) => item.id === current) ? current : data.listings[0]?.id ?? null
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load feed.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!session) {
      setKyc(null);
      return;
    }
    void (async () => {
      try {
        setKyc(await api<VerificationRecord>("/api/v1/verifications/me"));
      } catch {
        /* non-fatal — banner will prompt verification */
      }
    })();
  }, [session, api]);

  useEffect(() => {
    if (session && activeView === "profile") {
      void loadSecurity();
      void loadMyListings();
    }
  }, [session, activeView, loadSecurity, loadMyListings]);

  async function submitVerification(payload: VerificationSubmission) {
    setVerifyBusy(true);
    try {
      const record = await api<VerificationRecord>("/api/v1/verifications", {
        method: "POST",
        body: JSON.stringify({ ...payload, location: geo })
      });
      setKyc(record);
      toast.success("Submitted — we're reviewing your documents");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit verification.");
      throw error;
    } finally {
      setVerifyBusy(false);
    }
  }

  async function approveVerificationDemo() {
    if (!session) return;
    setVerifyBusy(true);
    try {
      const record = await api<VerificationRecord>(`/api/v1/admin/verifications/${session.user.id}/approve`, {
        method: "POST"
      });
      setKyc(record);
      toast.success("Identity verified — calling and chat unlocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve verification.");
    } finally {
      setVerifyBusy(false);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported on this device.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
          accuracy: Math.round(position.coords.accuracy)
        });
        setGeoBusy(false);
        toast.success("Location added");
      },
      () => {
        setGeoBusy(false);
        toast.error("Location permission denied. It's required to post.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /** Gate an action behind verification; opens the wizard if not verified. */
  function ensureVerified(action: () => void) {
    if (kycVerified) {
      action();
      return;
    }
    setVerifyOpen(true);
    toast.warning("Verify your identity to call or chat");
  }

  async function uploadAvatar(file: File) {
    try {
      const dataUrl = await downscaleToDataUrl(file, 512, 0.82);
      setAvatarUrl(dataUrl);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Could not process that image.");
    }
  }

  // Persist a chosen place; if it carries a real GPS fix, satisfy posting's location requirement too.
  function selectPlace(selection: PlaceSelection) {
    setPlace(selection);
    if (selection.locality) setPostLocality(selection.locality);
    if (selection.accuracy !== undefined && (selection.lat !== 0 || selection.lng !== 0)) {
      setGeo({ lat: selection.lat, lng: selection.lng, accuracy: selection.accuracy });
    }
    toast.success("Location updated");
  }

  const visibleListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = activeView === "saved" ? listings.filter((item) => savedSet.has(item.id)) : listings;
    const filtered = base.filter((item) => {
      if (item.distanceKm > maxDistance) return false;
      if (verifiedOnly && !isVerified(item.owner.verificationStatus)) return false;
      if (!q) return true;
      return `${item.title} ${item.description} ${item.locality} ${item.owner.name}`.toLowerCase().includes(q);
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "near") return a.distanceKm - b.distanceKm;
      if (sort === "new") return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      if (sort === "rating") return b.owner.rating - a.owner.rating;
      return b.trustScore - a.trustScore || a.distanceKm - b.distanceKm;
    });
    return sorted;
  }, [activeView, listings, savedSet, query, maxDistance, verifiedOnly, sort]);

  const selectedListing = useMemo(
    () => visibleListings.find((item) => item.id === selectedId) ?? visibleListings[0] ?? null,
    [visibleListings, selectedId]
  );

  function toggleSaved(id: string) {
    setSavedIds((current) => {
      if (current.includes(id)) {
        toast.info("Removed from saved");
        return current.filter((item) => item !== id);
      }
      toast.success("Saved for later");
      return [...current, id];
    });
  }

  function openChat(listing: FeedListing) {
    const threadId = `thread_${listing.owner.id}`;
    setThreads((current) => {
      if (current.some((thread) => thread.id === threadId)) return current;
      const thread: ChatThread = {
        id: threadId,
        name: listing.owner.name,
        context: listing.title,
        messages: [
          {
            id: ++chatSeq,
            from: "them",
            text: `Hi! Thanks for your interest in "${listing.title}". How can I help?`,
            at: Date.now()
          }
        ]
      };
      return [thread, ...current];
    });
    setActiveThreadId(threadId);
    setActiveView("chats");
    toast.success(`Chat opened with ${listing.owner.name}`);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !activeThreadId) return;
    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId
          ? { ...thread, messages: [...thread.messages, { id: ++chatSeq, from: "me", text, at: Date.now() }] }
          : thread
      )
    );
    setDraft("");
    const reply = quickReplies[Math.floor(Math.random() * quickReplies.length)];
    window.setTimeout(() => {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThreadId
            ? { ...thread, messages: [...thread.messages, { id: ++chatSeq, from: "them", text: reply, at: Date.now() }] }
            : thread
        )
      );
    }, 1100);
  }

  async function createPost() {
    if (!kycVerified) {
      setVerifyOpen(true);
      toast.warning("Verify your identity before posting");
      return;
    }
    if (!geo) {
      toast.warning("Allow location access to post");
      requestLocation();
      return;
    }
    try {
      const listing = await api<Listing>("/api/v1/listings", {
        method: "POST",
        body: JSON.stringify({
          type: postType,
          title: postTitle || "Part-time helper needed today",
          description: postDesc || "Need help for local work. Call to confirm timing.",
          priceAmount: Number(postPay || 600),
          priceUnit: postUnit,
          locality: postLocality || place?.locality || "Ameerpet",
          city: place?.city || "Hyderabad",
          urgency: postUrgency,
          location: geo
        })
      });
      setPostTitle("");
      setPostDesc("");
      setPendingListing(listing);
      void loadMyListings();
      toast.success(`Created "${listing.title}" — pending review`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create listing.");
    }
  }

  async function approvePending() {
    if (!pendingListing) return;
    try {
      const listing = await api<Listing>(`/api/v1/admin/listings/${pendingListing.id}/approve`, { method: "POST" });
      setPendingListing(listing);
      toast.success(`Approved "${listing.title}" — now live in feed`);
      await loadFeed(activeCategory);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve listing.");
    }
  }

  async function reportListing(listing: FeedListing) {
    try {
      const report = await api<{ id: string; status: string }>("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id, reason: "user_test", details: "Reported from web app." })
      });
      toast.warning(`Report filed (${report.status})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to report listing.");
    }
  }

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    setExtraSkills((current) => (current.includes(value) ? current : [...current, value]));
    setSkillDraft("");
    toast.success("Skill added");
  }

  const allSkills = useMemo(
    () => [...(session?.user.skills ?? []), ...extraSkills],
    [session?.user.skills, extraSkills]
  );

  const profileStrength = useMemo(() => {
    if (!session) return 0;
    let score = 40;
    if (isVerified(session.user.verificationStatus)) score += 20;
    score += Math.min(25, allSkills.length * 5);
    if (session.user.completedCount > 10) score += 15;
    return Math.min(100, score);
  }, [session, allSkills.length]);

  const stats = useMemo(
    () => [
      { label: "Nearby listings", value: visibleListings.length, suffix: "" },
      { label: "Avg response", value: 12, suffix: " min" },
      { label: "Verified posts", value: 68, suffix: "%" }
    ],
    [visibleListings.length]
  );

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;

  const commands = useMemo<CommandItem[]>(() => {
    const nav = (view: View, label: string, icon: CommandItem["icon"]): CommandItem => ({
      id: `nav-${view}`,
      label,
      group: "Navigate",
      hint: "view",
      icon,
      run: () => setActiveView(view)
    });
    return [
      nav("feed", "Go to Feed", <Home size={16} />),
      nav("saved", "Go to Saved", <Bookmark size={16} />),
      nav("post", "Post an opportunity", <Plus size={16} />),
      nav("chats", "Open Chats", <MessageCircle size={16} />),
      nav("profile", "View Profile", <UserRound size={16} />),
      {
        id: "theme",
        label: theme === "light" ? "Switch to dark mode" : "Switch to light mode",
        group: "Preferences",
        icon: theme === "light" ? <Moon size={16} /> : <Sun size={16} />,
        run: toggleTheme
      },
      ...categories
        .filter((category) => category.value !== "all")
        .map<CommandItem>((category) => ({
          id: `filter-${category.value}`,
          label: `Filter: ${category.label}`,
          group: "Filter feed",
          icon: <SlidersHorizontal size={16} />,
          run: () => {
            setActiveView("feed");
            setActiveCategory(category.value);
          }
        })),
      {
        id: "logout",
        label: "Sign out",
        group: "Account",
        icon: <LogOut size={16} />,
        run: logout
      }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  if (!session) {
    return (
      <div className="login-page">
        <ToastViewport />
        <div className="login-aside">
          <div className="brand large">
            <div className="brand-mark">U</div>
            <div>
              <strong>Upaadhi</strong>
              <span>Find nearby work. Earn today.</span>
            </div>
          </div>
          <h2 className="login-tagline">
            One feed for jobs, services, selling &amp; rentals — <span className="accent">earn near you</span>.
          </h2>
          <ul className="login-points">
            <li>
              <ShieldCheck size={18} /> Verified, trust-scored neighbours
            </li>
            <li>
              <Zap size={18} /> Respond in minutes, not days
            </li>
            <li>
              <TrendingUp size={18} /> Build a reputation that earns more
            </li>
          </ul>
        </div>
        <div className="login-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={authTab === "login" ? "auth-tab active" : "auth-tab"}
              onClick={() => setAuthTab("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={authTab === "signup" ? "auth-tab active" : "auth-tab"}
              onClick={() => setAuthTab("signup")}
            >
              Create account
            </button>
          </div>

          {authTab === "login" ? (
            <>
              <h1>Welcome back</h1>
              <p>Log in to your account with an OTP or your password.</p>

              <div className="auth-method">
                <button
                  type="button"
                  className={loginMethod === "otp" ? "active" : ""}
                  onClick={() => setLoginMethod("otp")}
                >
                  OTP
                </button>
                <button
                  type="button"
                  className={loginMethod === "password" ? "active" : ""}
                  onClick={() => setLoginMethod("password")}
                >
                  Password
                </button>
              </div>

              <label>
                Mobile number
                <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
              </label>

              {loginMethod === "otp" ? (
                <>
                  <button className="secondary-button full" type="button" onClick={() => void requestOtp()} disabled={authBusy}>
                    {otpRequested ? "Resend OTP" : "Request OTP"}
                  </button>
                  <label>
                    OTP
                    <input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void verifyOtp();
                      }}
                    />
                  </label>
                  <button className="primary-button full" type="button" onClick={() => void verifyOtp()} disabled={authBusy || !otp}>
                    {authBusy ? "Please wait…" : "Log in"}
                  </button>
                </>
              ) : (
                <>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Your password"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void loginWithPassword();
                      }}
                    />
                  </label>
                  <button
                    className="primary-button full"
                    type="button"
                    onClick={() => void loginWithPassword()}
                    disabled={authBusy || !password}
                  >
                    {authBusy ? "Please wait…" : "Log in"}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h1>Create your account</h1>
              <p>Sign up with your name, mobile number and a password. You can also log in with an OTP later.</p>
              <label>
                Full name
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ravi Kumar" />
              </label>
              <label>
                Mobile number
                <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="+9198XXXXXXXX" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void register();
                  }}
                />
              </label>
              <button
                className="primary-button full"
                type="button"
                onClick={() => void register()}
                disabled={authBusy || !name || !password}
              >
                {authBusy ? "Creating…" : "Create account"}
              </button>
            </>
          )}

          <div className="status-box">{loginStatus}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ToastViewport />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <VerificationModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        kyc={kyc}
        busy={verifyBusy}
        onSubmit={submitVerification}
        onApproveDemo={approveVerificationDemo}
      />
      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} current={place} onSelect={selectPlace} />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">U</div>
          <div>
            <strong>Upaadhi</strong>
            <span>Earn nearby</span>
          </div>
        </div>

        <nav className="nav-list">
          <NavButton icon={<Home size={18} />} label="Feed" active={activeView === "feed"} onClick={() => setActiveView("feed")} />
          <NavButton
            icon={<Bookmark size={18} />}
            label="Saved"
            active={activeView === "saved"}
            badge={savedIds.length || undefined}
            onClick={() => setActiveView("saved")}
          />
          <NavButton icon={<Plus size={18} />} label="Post" active={activeView === "post"} onClick={() => setActiveView("post")} />
          <NavButton
            icon={<MessageCircle size={18} />}
            label="Chats"
            active={activeView === "chats"}
            badge={threads.length || undefined}
            onClick={() => setActiveView("chats")}
          />
          <NavButton icon={<UserRound size={18} />} label="Profile" active={activeView === "profile"} onClick={() => setActiveView("profile")} />
        </nav>

        <button className="cmdk-trigger" type="button" onClick={() => setPaletteOpen(true)}>
          <CommandIcon size={15} />
          Quick actions
          <kbd>⌘K</kbd>
        </button>

        <div className="profile-mini">
          <Avatar name={session.user.name} size={40} src={avatarUrl} />
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.locality}</span>
          </div>
          <button className="icon-button plain" type="button" onClick={logout} aria-label="Logout">
            <LogOut size={17} />
          </button>
        </div>

        <VerifyCard kycStatus={kyc?.kycStatus ?? "unverified"} onVerify={() => setVerifyOpen(true)} />

        <div className="safety-note">
          <ShieldCheck size={20} />
          <p>Never pay money to get a job. Report suspicious listings anytime.</p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <button className="location-button" type="button" onClick={() => setLocationOpen(true)}>
            <MapPin size={18} />
            {place?.label ?? "Set location"}
            <ChevronDown size={15} />
          </button>
          <div className="search-box">
            <SlidersHorizontal size={18} className="search-lead" />
            <input
              placeholder="Search work, services, products…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (activeView !== "feed" && activeView !== "saved") setActiveView("feed");
              }}
            />
            {query ? (
              <button className="search-clear" type="button" onClick={() => setQuery("")}>
                Clear
              </button>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button className="icon-button plain" type="button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="notif-wrap">
              <button className="icon-button" type="button" aria-label="Notifications" onClick={() => setNotifOpen((value) => !value)}>
                <Bell size={18} />
              </button>
              {notifOpen ? (
                <div className="notif-panel">
                  <div className="notif-head">Notifications</div>
                  {listings.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="notif-item"
                      onClick={() => {
                        setActiveView("feed");
                        setSelectedId(item.id);
                        setNotifOpen(false);
                      }}
                    >
                      <span className={`dot-type ${item.type}`} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>New {categoryLabels[item.type]} · {item.distanceKm} km away</span>
                      </div>
                    </button>
                  ))}
                  {listings.length === 0 ? <div className="notif-empty">You're all caught up.</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {activeView === "feed" || activeView === "saved" ? (
          <FeedView
            mode={activeView}
            stats={stats}
            isLoading={isLoading}
            listings={visibleListings}
            activeCategory={activeCategory}
            onCategory={(value) => setActiveCategory(value)}
            sort={sort}
            onSort={setSort}
            maxDistance={maxDistance}
            onDistance={setMaxDistance}
            verifiedOnly={verifiedOnly}
            onVerifiedOnly={setVerifiedOnly}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((value) => !value)}
            selectedListing={selectedListing}
            onSelect={(id) => setSelectedId(id)}
            savedSet={savedSet}
            onToggleSaved={toggleSaved}
            verified={kycVerified}
            onCall={(listing) => ensureVerified(() => toast.success(`Calling ${listing.owner.name}…`))}
            onChat={(listing) => ensureVerified(() => openChat(listing))}
            onReport={(listing) => void reportListing(listing)}
            onGoPost={() => setActiveView("post")}
            onVerify={() => setVerifyOpen(true)}
            kycStatus={kyc?.kycStatus ?? "unverified"}
          />
        ) : null}

        {activeView === "post" ? (
          <section className="module-panel">
            <div className="section-heading">
              <h2>Post opportunity</h2>
              <span>Create local earning posts</span>
            </div>
            <p className="module-copy">
              Posts start under review, then you can approve them locally to test the moderation flow.
            </p>

            <div className="post-checklist">
              <ChecklistItem
                done={kycVerified}
                icon={<ShieldCheck size={18} />}
                title="Verified identity"
                sub={kycVerified ? "Your government ID is on file." : "Required — verify once to post safely."}
                action={kycVerified ? undefined : { label: "Verify", onClick: () => setVerifyOpen(true) }}
              />
              <ChecklistItem
                done={Boolean(geo)}
                icon={<MapPinned size={18} />}
                title="Location access"
                sub={geo ? `Captured (${geo.lat}, ${geo.lng})` : "Allow location so buyers nearby can find your ad."}
                action={geo ? undefined : { label: geoBusy ? "Locating…" : "Allow", onClick: requestLocation }}
              />
            </div>

            <div className="post-form-grid">
              <div className="type-picker">
                {postTypeOptions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={postType === type ? "type-chip active" : "type-chip"}
                    onClick={() => setPostType(type)}
                  >
                    {categoryLabels[type]}
                  </button>
                ))}
              </div>
              <label>
                Title
                <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Helper needed today" />
              </label>
              <label>
                Description
                <textarea
                  value={postDesc}
                  onChange={(event) => setPostDesc(event.target.value)}
                  placeholder="Describe the work, timing, and any requirements…"
                  rows={3}
                />
              </label>
              <div className="form-row">
                <label>
                  Price (₹)
                  <input value={postPay} onChange={(event) => setPostPay(event.target.value)} placeholder="600" inputMode="numeric" />
                </label>
                <label>
                  Unit
                  <div className="select-wrap">
                    <select value={postUnit} onChange={(event) => setPostUnit(event.target.value as FeedListing["priceUnit"])}>
                      {priceUnitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          per {priceUnits[unit]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Urgency
                  <div className="select-wrap">
                    <select value={postUrgency} onChange={(event) => setPostUrgency(event.target.value as FeedListing["urgency"])}>
                      {urgencyOptions.map((value) => (
                        <option key={value} value={value}>
                          {urgencyLabel(value)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </label>
                <label>
                  Locality
                  <input value={postLocality} onChange={(event) => setPostLocality(event.target.value)} placeholder="Ameerpet" />
                </label>
              </div>
              <button className="primary-button full" type="button" onClick={() => void createPost()}>
                <BriefcaseBusiness size={18} />
                Publish for review
              </button>
            </div>
            {pendingListing ? (
              <div className="review-box module-review">
                <span>Latest post: {pendingListing.status}</span>
                <strong>{pendingListing.title}</strong>
                <button className="secondary-button full" type="button" onClick={() => void approvePending()}>
                  Approve and show in feed
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeView === "chats" ? (
          <section className="module-panel chats-panel">
            <div className="section-heading">
              <h2>Chats</h2>
              <span>{threads.length} conversation{threads.length === 1 ? "" : "s"}</span>
            </div>
            {threads.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <MessageCircle size={26} />
                </span>
                <strong>No conversations yet</strong>
                <p>Open a listing and tap Chat to start talking to a poster.</p>
              </div>
            ) : (
              <div className="chat-layout">
                <div className="chat-threads">
                  {threads.map((thread) => {
                    const last = thread.messages[thread.messages.length - 1];
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        className={thread.id === (activeThread?.id ?? "") ? "chat-row active" : "chat-row"}
                        onClick={() => setActiveThreadId(thread.id)}
                      >
                        <Avatar name={thread.name} size={42} />
                        <div className="chat-row-body">
                          <strong>{thread.name}</strong>
                          <span>{last?.text ?? thread.context}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="chat-window">
                  {activeThread ? (
                    <>
                      <div className="chat-window-head">
                        <Avatar name={activeThread.name} size={38} />
                        <div>
                          <strong>{activeThread.name}</strong>
                          <span>Re: {activeThread.context}</span>
                        </div>
                      </div>
                      <div className="chat-messages">
                        {activeThread.messages.map((message) => (
                          <div key={message.id} className={`bubble ${message.from}`}>
                            {message.text}
                          </div>
                        ))}
                      </div>
                      <div className="chat-compose">
                        <input
                          value={draft}
                          placeholder="Type a message…"
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") sendMessage();
                          }}
                        />
                        <button className="primary-button" type="button" onClick={sendMessage} aria-label="Send">
                          <SendHorizontal size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="chat-empty">Select a conversation</div>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {activeView === "profile" ? (
          <section className="module-panel">
            <div className="section-heading">
              <h2>Profile</h2>
              <span>Trust and earning identity</span>
            </div>
            <div className="profile-card">
              <div className="avatar-edit">
                <Avatar name={session.user.name} size={84} className="large-avatar" src={avatarUrl} />
                <label className="avatar-edit-btn" title="Change photo">
                  <Camera size={15} />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAvatar(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {avatarUrl ? (
                  <button
                    className="avatar-remove-btn"
                    type="button"
                    title="Remove photo"
                    onClick={() => {
                      setAvatarUrl(null);
                      toast.info("Profile photo removed");
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
              <div>
                <h3>{session.user.name}</h3>
                <p>
                  {session.user.locality}, {session.user.city}
                </p>
                <div className="trust-row profile-trust">
                  <span className="verified">
                    <BadgeCheck size={15} /> {verificationLabels[session.user.verificationStatus]}
                  </span>
                  <span className="rating">
                    <Star size={15} /> {session.user.rating}
                  </span>
                  <span>{session.user.completedCount} completed</span>
                </div>
              </div>
            </div>

            <div className="verify-profile">
              <div className={`verify-profile-state ${kyc?.kycStatus ?? "unverified"}`}>
                {kycVerified ? <BadgeCheck size={22} /> : kyc?.kycStatus === "under_review" ? <Clock size={22} /> : <ShieldCheck size={22} />}
                <div>
                  <strong>
                    {kycVerified
                      ? "Identity verified"
                      : kyc?.kycStatus === "under_review"
                        ? "Verification under review"
                        : "Identity not verified"}
                  </strong>
                  <span>
                    {kyc?.idType
                      ? `${idTypeLabels[kyc.idType]} · ${kyc.idNumberMasked}`
                      : "Verify once to unlock calling, chat and posting."}
                  </span>
                </div>
              </div>
              {!kycVerified ? (
                <button className="primary-button" type="button" onClick={() => setVerifyOpen(true)}>
                  {kyc?.kycStatus === "under_review" ? "View status" : "Verify identity"}
                </button>
              ) : null}
            </div>

            <MyPostsPanel listings={myListings} onPost={() => setActiveView("post")} />

            <div className="stats-row">
              <div className="stat">
                <strong>
                  <Counter value={session.user.responseTimeMinutes} suffix=" min" />
                </strong>
                <span>Avg response</span>
              </div>
              <div className="stat">
                <strong>
                  <Counter value={session.user.completedCount} />
                </strong>
                <span>Completed works</span>
              </div>
              <div className="stat">
                <strong>
                  <Counter value={allSkills.length} />
                </strong>
                <span>Skills</span>
              </div>
            </div>

            <div className="progress-block">
              <div className="progress-top">
                Profile strength <span>{profileStrength}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${profileStrength}%` }} />
              </div>
              <p className="progress-hint">
                {profileStrength >= 90 ? "Great profile — you'll get the best matches." : "Add skills and complete works to improve matches."}
              </p>
            </div>

            <div className="skills-block">
              <div className="section-heading">
                <h2 className="skills-title">Skills</h2>
                <span>Shown to people hiring nearby</span>
              </div>
              <div className="skill-tags">
                {allSkills.map((skill) => (
                  <span className="skill-tag" key={skill}>
                    {skill}
                  </span>
                ))}
                {allSkills.length === 0 ? <span className="skill-empty">No skills added yet.</span> : null}
              </div>
              <div className="skill-add">
                <input
                  value={skillDraft}
                  placeholder="Add a skill (e.g. plumbing)"
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSkill();
                  }}
                />
                <button className="secondary-button" type="button" onClick={addSkill}>
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            <SecurityPanel
              sessions={securitySessions}
              events={securityEvents}
              onSignOutOthers={signOutOtherDevices}
            />
          </section>
        ) : null}

        <nav className="bottom-nav">
          <BottomItem icon={<Home size={20} />} label="Feed" active={activeView === "feed"} onClick={() => setActiveView("feed")} />
          <BottomItem icon={<Bookmark size={20} />} label="Saved" active={activeView === "saved"} onClick={() => setActiveView("saved")} />
          <BottomItem icon={<Plus size={20} />} label="Post" active={activeView === "post"} onClick={() => setActiveView("post")} primary />
          <BottomItem icon={<MessageCircle size={20} />} label="Chats" active={activeView === "chats"} onClick={() => setActiveView("chats")} />
          <BottomItem icon={<UserRound size={20} />} label="You" active={activeView === "profile"} onClick={() => setActiveView("profile")} />
        </nav>
      </main>
    </div>
  );
}

/* ---- Feed view ----------------------------------------------------------- */

interface FeedViewProps {
  mode: "feed" | "saved";
  stats: Array<{ label: string; value: number; suffix: string }>;
  isLoading: boolean;
  listings: FeedListing[];
  activeCategory: ListingType | "all";
  onCategory: (value: ListingType | "all") => void;
  sort: SortKey;
  onSort: (value: SortKey) => void;
  maxDistance: number;
  onDistance: (value: number) => void;
  verifiedOnly: boolean;
  onVerifiedOnly: (value: boolean) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  selectedListing: FeedListing | null;
  onSelect: (id: string) => void;
  savedSet: Set<string>;
  onToggleSaved: (id: string) => void;
  verified: boolean;
  onCall: (listing: FeedListing) => void;
  onChat: (listing: FeedListing) => void;
  onReport: (listing: FeedListing) => void;
  onGoPost: () => void;
  onVerify: () => void;
  kycStatus: KycStatus;
}

function FeedView(props: FeedViewProps) {
  const { mode, selectedListing } = props;

  return (
    <>
      {mode === "feed" ? (
        <section className="hero-band">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} />
              One feed · Everything earnable
            </p>
            <h1>
              Find local work, services, selling and rent — and <span className="accent">earn today</span>, near you.
            </h1>
          </div>
          <button className="primary-button" type="button" onClick={props.onGoPost}>
            <Plus size={18} />
            Post in 30 sec
          </button>
        </section>
      ) : (
        <section className="hero-band saved-hero">
          <div>
            <p className="eyebrow">
              <Bookmark size={14} />
              Saved opportunities
            </p>
            <h1>
              Your shortlist, <span className="accent">ready when you are</span>.
            </h1>
          </div>
        </section>
      )}

      {!props.verified ? (
        <VerifyBanner kycStatus={props.kycStatus} onVerify={props.onVerify} />
      ) : null}

      {mode === "feed" ? (
        <section className="stats-row">
          {props.stats.map((item) => (
            <div className="stat" key={item.label}>
              <strong>
                <Counter value={item.value} suffix={item.suffix} />
              </strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="filter-row">
        {categories.map((item) => (
          <button
            className={props.activeCategory === item.value ? "chip active" : "chip"}
            key={item.value}
            type="button"
            onClick={() => props.onCategory(item.value)}
          >
            {item.label}
          </button>
        ))}
        <button className={props.showFilters ? "chip muted active" : "chip muted"} type="button" onClick={props.onToggleFilters}>
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      {props.showFilters ? (
        <div className="filter-drawer">
          <label className="filter-field">
            Sort by
            <div className="select-wrap">
              <select value={props.sort} onChange={(event) => props.onSort(event.target.value as SortKey)}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </label>
          <label className="filter-field">
            Max distance: <strong>{props.maxDistance} km</strong>
            <input
              type="range"
              min={1}
              max={10}
              value={props.maxDistance}
              onChange={(event) => props.onDistance(Number(event.target.value))}
            />
          </label>
          <label className="filter-toggle">
            <input type="checkbox" checked={props.verifiedOnly} onChange={(event) => props.onVerifiedOnly(event.target.checked)} />
            <span>Verified posters only</span>
          </label>
        </div>
      ) : null}

      <section className="workspace">
        <div className="feed-column">
          <div className="section-heading">
            <h2>{mode === "saved" ? "Saved" : "Nearby feed"}</h2>
            <span>{props.isLoading ? "Loading…" : `${props.listings.length} active`}</span>
          </div>

          <div className="listing-list">
            {props.isLoading && props.listings.length === 0
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
              : props.listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedListing?.id === listing.id}
                    saved={props.savedSet.has(listing.id)}
                    onSelect={() => props.onSelect(listing.id)}
                    onToggleSaved={() => props.onToggleSaved(listing.id)}
                  />
                ))}

            {!props.isLoading && props.listings.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  {mode === "saved" ? <Bookmark size={26} /> : <Inbox size={26} />}
                </span>
                <strong>{mode === "saved" ? "Nothing saved yet" : "No listings match"}</strong>
                <p>{mode === "saved" ? "Tap the bookmark on any listing to save it here." : "Try widening distance or clearing filters."}</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="detail-panel">
          {selectedListing ? (
            <DetailPanel
              listing={selectedListing}
              saved={props.savedSet.has(selectedListing.id)}
              verified={props.verified}
              onToggleSaved={() => props.onToggleSaved(selectedListing.id)}
              onCall={() => props.onCall(selectedListing)}
              onChat={() => props.onChat(selectedListing)}
              onReport={() => props.onReport(selectedListing)}
            />
          ) : (
            <p className="detail-empty">Select a listing to see details.</p>
          )}
        </aside>
      </section>
    </>
  );
}

/* ---- Listing card -------------------------------------------------------- */

function ListingCard({
  listing,
  selected,
  saved,
  onSelect,
  onToggleSaved
}: {
  listing: FeedListing;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onToggleSaved: () => void;
}) {
  const urgent = listing.urgency === "immediate" || listing.urgency === "today";
  return (
    <div className={selected ? "listing-card selected" : "listing-card"} onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="card-top">
        <span className="card-badges">
          <span className={`badge ${listing.type}`}>{categoryLabels[listing.type]}</span>
          <span className={`urgency ${listing.urgency}`}>
            {urgent ? <Zap size={11} /> : <span className="dot" />}
            {urgencyLabel(listing.urgency)}
          </span>
        </span>
        <span className="card-top-right">
          {formatPosted(listing.postedAt)}
          <button
            type="button"
            className={saved ? "save-btn saved" : "save-btn"}
            aria-label={saved ? "Remove from saved" : "Save listing"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSaved();
            }}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        </span>
      </div>
      <h3>{listing.title}</h3>
      <p className="price">
        ₹{listing.priceAmount}
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
    </div>
  );
}

/* ---- Detail panel -------------------------------------------------------- */

function DetailPanel({
  listing,
  saved,
  verified,
  onToggleSaved,
  onCall,
  onChat,
  onReport
}: {
  listing: FeedListing;
  saved: boolean;
  verified: boolean;
  onToggleSaved: () => void;
  onCall: () => void;
  onChat: () => void;
  onReport: () => void;
}) {
  const urgent = listing.urgency === "immediate" || listing.urgency === "today";
  return (
    <>
      <div className="detail-head">
        <span className={`badge ${listing.type}`}>{categoryLabels[listing.type]}</span>
        <span className={`urgency ${listing.urgency}`}>
          {urgent ? <Zap size={11} /> : <span className="dot" />}
          {urgencyLabel(listing.urgency)}
        </span>
        <button
          type="button"
          className={saved ? "save-btn saved detail-save" : "save-btn detail-save"}
          aria-label={saved ? "Remove from saved" : "Save listing"}
          onClick={onToggleSaved}
        >
          {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>
      <h2>{listing.title}</h2>
      <p className="detail-price">
        ₹{listing.priceAmount}
        <span className="unit"> /{priceUnits[listing.priceUnit]}</span>
      </p>
      <p className="detail-copy">{listing.description}</p>

      <div className="detail-grid">
        <div>
          <span>Distance</span>
          <strong>{listing.distanceKm} km</strong>
        </div>
        <div>
          <span>Urgency</span>
          <strong>{urgencyLabel(listing.urgency)}</strong>
        </div>
        <div>
          <span>Trust score</span>
          <strong>{listing.trustScore}</strong>
        </div>
        <div>
          <span>Posted</span>
          <strong>{formatPosted(listing.postedAt)}</strong>
        </div>
      </div>

      <div className="owner-box">
        <Avatar name={listing.owner.name} size={44} />
        <div>
          <strong>{listing.owner.name}</strong>
          <span>
            {verificationLabels[listing.owner.verificationStatus]} · {listing.owner.completedCount} completed · replies in{" "}
            {listing.owner.responseTimeMinutes} min
          </span>
        </div>
        {isVerified(listing.owner.verificationStatus) ? <BadgeCheck size={22} /> : <CheckCircle2 size={20} />}
      </div>

      <div className="action-row">
        <button className="primary-button" type="button" onClick={onCall}>
          {verified ? <Phone size={18} /> : <Lock size={16} />}
          Call
        </button>
        <button className="secondary-button" type="button" onClick={onChat}>
          {verified ? <MessageCircle size={18} /> : <Lock size={16} />}
          Chat
        </button>
      </div>
      {!verified ? (
        <p className="detail-locked">
          <ShieldCheck size={14} /> Verify your identity to unlock calling and chat.
        </p>
      ) : null}
      <button className="danger-button full" type="button" onClick={onReport}>
        <Flag size={18} />
        Report listing
      </button>
    </>
  );
}

/* ---- Verification banner + sidebar card ---------------------------------- */

const kycCopy: Record<KycStatus, { title: string; sub: string; cta: string }> = {
  unverified: {
    title: "Verify your identity",
    sub: "A quick, one-time check unlocks calling, chat and posting — and keeps everyone safe.",
    cta: "Verify now"
  },
  rejected: {
    title: "Verification needs another try",
    sub: "Your last submission couldn't be confirmed. Re-submit a clearer ID and selfie.",
    cta: "Try again"
  },
  under_review: {
    title: "Verification under review",
    sub: "We're checking your documents. We'll unlock everything as soon as you're approved.",
    cta: "View status"
  },
  verified: { title: "Verified", sub: "Your identity is confirmed.", cta: "View" }
};

function VerifyBanner({ kycStatus, onVerify }: { kycStatus: KycStatus; onVerify: () => void }) {
  const copy = kycCopy[kycStatus];
  return (
    <section className={`verify-banner ${kycStatus}`}>
      <span className="verify-banner-icon">
        {kycStatus === "under_review" ? <Clock size={22} /> : <ShieldCheck size={22} />}
      </span>
      <div className="verify-banner-text">
        <strong>{copy.title}</strong>
        <span>{copy.sub}</span>
      </div>
      <button className="primary-button" type="button" onClick={onVerify}>
        {copy.cta}
      </button>
    </section>
  );
}

function ChecklistItem({
  done,
  icon,
  title,
  sub,
  action
}: {
  done: boolean;
  icon: ReactNode;
  title: string;
  sub: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={done ? "checklist-item done" : "checklist-item"}>
      <span className="checklist-icon">{done ? <CheckCircle2 size={18} /> : icon}</span>
      <div className="checklist-text">
        <strong>{title}</strong>
        <span>{sub}</span>
      </div>
      {action ? (
        <button className="secondary-button" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : (
        <span className="checklist-ok">{done ? "Ready" : ""}</span>
      )}
    </div>
  );
}

function VerifyCard({ kycStatus, onVerify }: { kycStatus: KycStatus; onVerify: () => void }) {
  const verified = kycStatus === "verified";
  return (
    <button className={`verify-card ${kycStatus}`} type="button" onClick={onVerify}>
      <span className="verify-card-icon">
        {verified ? <BadgeCheck size={18} /> : kycStatus === "under_review" ? <Clock size={18} /> : <ShieldCheck size={18} />}
      </span>
      <span className="verify-card-text">
        <strong>
          {verified ? "Verified" : kycStatus === "under_review" ? "Under review" : "Not verified"}
        </strong>
        <span>{verified ? "Identity confirmed" : kycStatus === "under_review" ? "We're checking your ID" : "Tap to verify your ID"}</span>
      </span>
    </button>
  );
}

/* ---- My posts ------------------------------------------------------------ */

const statusLabels: Record<ListingStatus, string> = {
  active: "Live",
  pending_review: "Under review",
  expired: "Expired",
  rejected: "Rejected",
  closed: "Closed"
};

function expiryLabel(listing: Listing): string {
  const status = listing.status;
  if (status === "expired") return "Expired";
  if (status === "pending_review") return "Awaiting approval";
  if (status === "rejected") return "Not approved";
  if (status === "closed") return "Closed";
  const days = daysUntilExpiry(listing);
  if (days <= 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function MyPostsPanel({ listings, onPost }: { listings: Listing[]; onPost: () => void }) {
  return (
    <div className="myposts-block">
      <div className="section-heading">
        <h2 className="skills-title">My posts</h2>
        <span>{listings.length} total</span>
      </div>

      {listings.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <BriefcaseBusiness size={24} />
          </span>
          <strong>No posts yet</strong>
          <p>Create your first listing — it stays live for {15} days.</p>
          <button className="primary-button" type="button" onClick={onPost}>
            <Plus size={16} /> Post now
          </button>
        </div>
      ) : (
        <div className="myposts-list">
          {listings.map((listing) => (
            <div className={`mypost-row ${listing.status}`} key={listing.id}>
              <span className={`badge ${listing.type}`}>{categoryLabels[listing.type]}</span>
              <div className="mypost-body">
                <strong>{listing.title}</strong>
                <span>
                  ₹{listing.priceAmount}
                  <span className="unit"> /{priceUnits[listing.priceUnit]}</span> · {listing.locality}
                </span>
              </div>
              <div className="mypost-meta">
                <span className={`mypost-status ${listing.status}`}>{statusLabels[listing.status]}</span>
                <span className="mypost-expiry">{expiryLabel(listing)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Security panel (active sessions + activity) ------------------------- */

function shortUserAgent(userAgent?: string): string {
  if (!userAgent) return "Unknown device";
  const browser = /edg/i.test(userAgent)
    ? "Edge"
    : /chrome|crios/i.test(userAgent)
      ? "Chrome"
      : /firefox/i.test(userAgent)
        ? "Firefox"
        : /safari/i.test(userAgent)
          ? "Safari"
          : "Browser";
  const os = /android/i.test(userAgent)
    ? "Android"
    : /iphone|ipad|ios/i.test(userAgent)
      ? "iOS"
      : /mac/i.test(userAgent)
        ? "macOS"
        : /windows/i.test(userAgent)
          ? "Windows"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Device";
  return `${browser} on ${os}`;
}

function SecurityPanel({
  sessions,
  events,
  onSignOutOthers
}: {
  sessions: SessionView[];
  events: SecurityEventView[];
  onSignOutOthers: () => void;
}) {
  return (
    <div className="security-block">
      <div className="section-heading">
        <h2 className="skills-title">Security &amp; sessions</h2>
        <span>Protecting your account</span>
      </div>

      <div className="security-sessions">
        {sessions.length === 0 ? (
          <p className="skill-empty">No active sessions found.</p>
        ) : (
          sessions.map((item) => (
            <div className="security-row" key={item.id}>
              <span className="security-icon">
                <MonitorSmartphone size={18} />
              </span>
              <div className="security-row-body">
                <strong>
                  {shortUserAgent(item.userAgent)}
                  {item.current ? <span className="security-current">This device</span> : null}
                </strong>
                <span>
                  {item.ip ?? "unknown IP"} · active {formatPosted(item.lastUsedAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {sessions.length > 1 ? (
        <button className="secondary-button security-signout" type="button" onClick={onSignOutOthers}>
          <LogOut size={16} /> Sign out of all other devices
        </button>
      ) : null}

      <h3 className="security-sub">Recent security activity</h3>
      <div className="security-events">
        {events.length === 0 ? (
          <p className="skill-empty">No recent activity.</p>
        ) : (
          events.slice(0, 8).map((event) => (
            <div className={`security-event ${event.severity}`} key={event.id}>
              <span className="security-event-dot" />
              <div>
                <strong>{event.message}</strong>
                <span>
                  {formatPosted(event.at)}
                  {event.ip ? ` · ${event.ip}` : ""}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---- Small nav helpers --------------------------------------------------- */

function NavButton({
  icon,
  label,
  active,
  badge,
  onClick
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {icon} {label}
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

function BottomItem({
  icon,
  label,
  active,
  onClick,
  primary
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={`${primary ? "bottom-item primary" : "bottom-item"}${active ? " active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
