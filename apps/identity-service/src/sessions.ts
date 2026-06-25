import crypto from "node:crypto";
import { deviceFingerprint, generateOpaqueToken, hashToken } from "@upaadhi/shared/auth";

/**
 * Session, device, and OTP-abuse security for the identity service.
 *
 * Implements the hidden authentication-lifecycle controls:
 *  - short-lived access tokens (issued elsewhere) + rotating refresh tokens
 *  - refresh-token reuse detection (stolen-token defence) -> family revocation
 *  - device tracking + new-device login alerts
 *  - logout / logout-from-all-devices
 *  - OTP request throttling + per-phone lockout (brute-force defence)
 *  - an append-only per-user security-event trail
 *
 * In-memory for local development; the same surface maps onto a sessions
 * table + Redis counters in production.
 */

export interface DeviceContext {
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}

export interface LoginResult {
  sessionId: string;
  refreshToken: string;
  isNewDevice: boolean;
}

export interface SessionView {
  id: string;
  device: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export type EventSeverity = "info" | "warning" | "critical";

export interface SecurityEventView {
  id: string;
  type: string;
  message: string;
  severity: EventSeverity;
  ip?: string;
  device?: string;
  at: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent?: string;
  ip?: string;
  refreshHash: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revokedAt?: number;
  usedRefreshHashes: Set<string>;
}

interface SecurityEventRecord extends SecurityEventView {
  userId: string;
}

const REFRESH_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30) * 1000;
const OTP_WINDOW_MS = Number(process.env.OTP_WINDOW_SECONDS ?? 900) * 1000;
const OTP_MAX_PER_WINDOW = Number(process.env.OTP_MAX_PER_WINDOW ?? 5);
const OTP_LOCK_AFTER_FAILURES = Number(process.env.OTP_LOCK_AFTER_FAILURES ?? 5);
const OTP_LOCK_MS = Number(process.env.OTP_LOCK_SECONDS ?? 900) * 1000;

export class SessionSecurity {
  private sessions = new Map<string, SessionRecord>();
  private knownFingerprints = new Map<string, Set<string>>();
  private events: SecurityEventRecord[] = [];
  private otpRequests = new Map<string, number[]>();
  private otpFailures = new Map<string, { count: number; lockedUntil?: number }>();

  /* ---- Login + sessions -------------------------------------------------- */

  recordLogin(userId: string, ctx: DeviceContext): LoginResult {
    const fingerprint = deviceFingerprint(ctx.deviceId, ctx.userAgent);
    const known = this.knownFingerprints.get(userId) ?? new Set<string>();
    const isNewDevice = known.size > 0 && !known.has(fingerprint);
    known.add(fingerprint);
    this.knownFingerprints.set(userId, known);

    const refreshToken = generateOpaqueToken();
    const now = Date.now();
    const session: SessionRecord = {
      id: `ses_${crypto.randomUUID()}`,
      userId,
      fingerprint,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
      refreshHash: hashToken(refreshToken),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: now + REFRESH_TTL_MS,
      usedRefreshHashes: new Set()
    };
    this.sessions.set(session.id, session);

    this.addEvent(userId, "login", "Signed in", "info", ctx.ip, fingerprint);
    if (isNewDevice) {
      this.addEvent(
        userId,
        "new_device_login",
        "New device or location signed in to your account",
        "warning",
        ctx.ip,
        fingerprint
      );
    }

    return { sessionId: session.id, refreshToken, isNewDevice };
  }

  /**
   * Rotate a refresh token. Detects reuse of an already-rotated token
   * (a hallmark of theft) and revokes the whole session in response.
   */
  rotate(refreshToken: string, ctx: DeviceContext): LoginResult {
    const presented = hashToken(refreshToken);

    // Reuse of a token we already rotated away -> stolen-token signal.
    for (const session of this.sessions.values()) {
      if (session.usedRefreshHashes.has(presented)) {
        if (!session.revokedAt) {
          session.revokedAt = Date.now();
          this.addEvent(
            session.userId,
            "refresh_reuse_detected",
            "Suspicious activity: a session token was replayed. The session was revoked.",
            "critical",
            ctx.ip,
            session.fingerprint
          );
        }
        throw new Error("REFRESH_REUSE_DETECTED");
      }
    }

    const session = [...this.sessions.values()].find((item) => item.refreshHash === presented);
    if (!session || session.revokedAt || session.expiresAt < Date.now()) {
      throw new Error("REFRESH_INVALID");
    }

    const nextToken = generateOpaqueToken();
    session.usedRefreshHashes.add(session.refreshHash);
    session.refreshHash = hashToken(nextToken);
    session.lastUsedAt = Date.now();
    if (ctx.ip) session.ip = ctx.ip;

    return { sessionId: session.id, refreshToken: nextToken, isNewDevice: false };
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  isActive(sessionId: string | undefined): boolean {
    if (!sessionId) return false;
    const session = this.sessions.get(sessionId);
    return Boolean(session && !session.revokedAt && session.expiresAt > Date.now());
  }

  revoke(userId: string, sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) return false;
    session.revokedAt = Date.now();
    this.addEvent(userId, "logout", "Signed out of a device", "info", session.ip, session.fingerprint);
    return true;
  }

  revokeAll(userId: string, exceptSessionId?: string): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt && session.id !== exceptSessionId) {
        session.revokedAt = Date.now();
        count += 1;
      }
    }
    if (count > 0) {
      this.addEvent(userId, "logout_all", `Signed out of ${count} device(s)`, "warning");
    }
    return count;
  }

  listSessions(userId: string, currentSessionId?: string): SessionView[] {
    return [...this.sessions.values()]
      .filter((session) => session.userId === userId && !session.revokedAt && session.expiresAt > Date.now())
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .map((session) => ({
        id: session.id,
        device: session.fingerprint,
        userAgent: session.userAgent,
        ip: session.ip,
        createdAt: new Date(session.createdAt).toISOString(),
        lastUsedAt: new Date(session.lastUsedAt).toISOString(),
        current: session.id === currentSessionId
      }));
  }

  /* ---- Security events --------------------------------------------------- */

  addEvent(
    userId: string,
    type: string,
    message: string,
    severity: EventSeverity,
    ip?: string,
    device?: string
  ): void {
    this.events.unshift({
      id: `evt_${crypto.randomUUID()}`,
      userId,
      type,
      message,
      severity,
      ip,
      device,
      at: new Date().toISOString()
    });
    if (this.events.length > 1000) this.events.length = 1000;
  }

  listSecurityEvents(userId: string, limit = 50): SecurityEventView[] {
    return this.events
      .filter((event) => event.userId === userId)
      .slice(0, limit)
      .map(({ userId: _omit, ...view }) => view);
  }

  /* ---- OTP brute-force defence ------------------------------------------- */

  /** Sliding-window throttle on OTP requests, keyed per phone. */
  canRequestOtp(phone: string): { allowed: boolean; retryAfterSeconds?: number } {
    const lock = this.otpFailures.get(phone);
    if (lock?.lockedUntil && lock.lockedUntil > Date.now()) {
      return { allowed: false, retryAfterSeconds: Math.ceil((lock.lockedUntil - Date.now()) / 1000) };
    }
    const now = Date.now();
    const recent = (this.otpRequests.get(phone) ?? []).filter((ts) => now - ts < OTP_WINDOW_MS);
    if (recent.length >= OTP_MAX_PER_WINDOW) {
      const retryAfter = Math.ceil((recent[0] + OTP_WINDOW_MS - now) / 1000);
      return { allowed: false, retryAfterSeconds: retryAfter };
    }
    return { allowed: true };
  }

  recordOtpRequest(phone: string): void {
    const now = Date.now();
    const recent = (this.otpRequests.get(phone) ?? []).filter((ts) => now - ts < OTP_WINDOW_MS);
    recent.push(now);
    this.otpRequests.set(phone, recent);
  }

  recordOtpFailure(phone: string, ip?: string): void {
    const entry = this.otpFailures.get(phone) ?? { count: 0 };
    entry.count += 1;
    if (entry.count >= OTP_LOCK_AFTER_FAILURES) {
      entry.lockedUntil = Date.now() + OTP_LOCK_MS;
      entry.count = 0;
    }
    this.otpFailures.set(phone, entry);
  }

  clearOtpFailures(phone: string): void {
    this.otpFailures.delete(phone);
  }

  isPhoneLocked(phone: string): boolean {
    const lock = this.otpFailures.get(phone);
    return Boolean(lock?.lockedUntil && lock.lockedUntil > Date.now());
  }
}

export function createSessionSecurity(): SessionSecurity {
  return new SessionSecurity();
}
