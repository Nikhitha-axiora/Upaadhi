import {
  KycStatus,
  VerificationFile,
  VerificationRecord,
  VerificationSubmission,
  toVerificationRecord
} from "@upaadhi/shared";

/**
 * Stores each user's verification documents in their application data.
 * Raw selfie/ID images and the full ID number never leave this store —
 * the service only ever returns the sanitized {@link VerificationRecord}.
 *
 * Backed by an in-memory map for local development. A production deployment
 * would persist {@link VerificationFile} to encrypted object storage + a row
 * in `identity.verifications`; the public surface stays identical.
 */
export interface VerificationStore {
  get(userId: string): VerificationFile | undefined;
  getRecord(userId: string): VerificationRecord;
  submit(
    userId: string,
    submission: VerificationSubmission,
    ipAddress: string | undefined
  ): VerificationRecord;
  setStatus(userId: string, status: KycStatus, rejectionReason?: string): VerificationRecord | undefined;
  listPending(): VerificationRecord[];
}

function emptyRecord(userId: string): VerificationRecord {
  return { userId, kycStatus: "unverified", hasSelfie: false, hasIdPhoto: false };
}

class MemoryVerificationStore implements VerificationStore {
  private files = new Map<string, VerificationFile>();

  get(userId: string) {
    return this.files.get(userId);
  }

  getRecord(userId: string) {
    const file = this.files.get(userId);
    return file ? toVerificationRecord(file) : emptyRecord(userId);
  }

  submit(userId: string, submission: VerificationSubmission, ipAddress: string | undefined) {
    const file: VerificationFile = {
      ...submission,
      userId,
      kycStatus: "under_review",
      ipAddress,
      submittedAt: new Date().toISOString(),
      reviewedAt: undefined,
      rejectionReason: undefined
    };
    this.files.set(userId, file);
    return toVerificationRecord(file);
  }

  setStatus(userId: string, status: KycStatus, rejectionReason?: string) {
    const file = this.files.get(userId);
    if (!file) return undefined;
    const next: VerificationFile = {
      ...file,
      kycStatus: status,
      reviewedAt: new Date().toISOString(),
      rejectionReason: status === "rejected" ? rejectionReason ?? "Documents unclear." : undefined
    };
    this.files.set(userId, next);
    return toVerificationRecord(next);
  }

  listPending() {
    return [...this.files.values()]
      .filter((file) => file.kycStatus === "under_review")
      .map(toVerificationRecord);
  }
}

export function createVerificationStore(): VerificationStore {
  return new MemoryVerificationStore();
}
