import crypto from "node:crypto";
import { isDatabaseConfigured, query } from "@upaadhi/db";
import { seedUsers, UserProfile, VerificationStatus } from "@upaadhi/shared";

interface UserRow {
  id: string;
  phone: string;
  name: string;
  locality: string;
  city: string;
  roles: string[];
  skills: string[];
  rating: string;
  completed_count: number;
  response_time_minutes: number;
  verification_status: VerificationStatus;
}

export interface IdentityRepository {
  listUsers(): Promise<UserProfile[]>;
  getUserById(id: string): Promise<UserProfile | undefined>;
  createOtpChallenge(phone: string, otpHash: string, expiresAt: Date): Promise<void>;
  verifyOtpChallenge(phone: string, otpHash: string): Promise<boolean>;
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    locality: row.locality,
    city: row.city,
    roles: row.roles,
    skills: row.skills,
    rating: Number(row.rating),
    completedCount: row.completed_count,
    responseTimeMinutes: row.response_time_minutes,
    verificationStatus: row.verification_status
  };
}

class MemoryIdentityRepository implements IdentityRepository {
  private otpChallenges: Array<{
    phone: string;
    otpHash: string;
    attempts: number;
    expiresAt: Date;
    consumedAt?: Date;
    createdAt: Date;
  }> = [];

  async listUsers() {
    return seedUsers;
  }

  async getUserById(id: string) {
    return seedUsers.find((item) => item.id === id);
  }

  async createOtpChallenge(phone: string, otpHash: string, expiresAt: Date) {
    this.otpChallenges.unshift({
      phone,
      otpHash,
      attempts: 0,
      expiresAt,
      createdAt: new Date()
    });
  }

  async verifyOtpChallenge(phone: string, otpHash: string) {
    const challenge = this.otpChallenges.find((item) => item.phone === phone && !item.consumedAt);

    if (!challenge || challenge.expiresAt.getTime() < Date.now() || challenge.attempts >= 5) {
      return false;
    }

    challenge.attempts += 1;

    if (challenge.otpHash !== otpHash) {
      return false;
    }

    challenge.consumedAt = new Date();
    return true;
  }
}

class PostgresIdentityRepository implements IdentityRepository {
  async listUsers() {
    const result = await query<UserRow>(`
      SELECT id, phone, name, locality, city, roles, skills, rating, completed_count, response_time_minutes, verification_status
      FROM identity.users
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapUser);
  }

  async getUserById(id: string) {
    const result = await query<UserRow>(
      `
        SELECT id, phone, name, locality, city, roles, skills, rating, completed_count, response_time_minutes, verification_status
        FROM identity.users
        WHERE id = $1 AND status = 'active'
      `,
      [id]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async createOtpChallenge(phone: string, otpHash: string, expiresAt: Date) {
    await query(
      `
        INSERT INTO identity.otp_challenges (id, phone, otp_hash, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
      [`otp_${crypto.randomUUID()}`, phone, otpHash, expiresAt]
    );
  }

  async verifyOtpChallenge(phone: string, otpHash: string) {
    const result = await query<{ id: string; otp_hash: string; attempts: number; expires_at: Date }>(
      `
        SELECT id, otp_hash, attempts, expires_at
        FROM identity.otp_challenges
        WHERE phone = $1 AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [phone]
    );

    const challenge = result.rows[0];
    if (!challenge || challenge.expires_at.getTime() < Date.now() || challenge.attempts >= 5) {
      return false;
    }

    await query("UPDATE identity.otp_challenges SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);

    if (challenge.otp_hash !== otpHash) {
      return false;
    }

    await query("UPDATE identity.otp_challenges SET consumed_at = now() WHERE id = $1", [challenge.id]);
    return true;
  }
}

export function createIdentityRepository(): IdentityRepository {
  return isDatabaseConfigured() ? new PostgresIdentityRepository() : new MemoryIdentityRepository();
}
