import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query } from "@upaadhi/db";
import { ReportPayload } from "@upaadhi/shared";

export interface ReportRecord extends ReportPayload {
  id: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
}

interface ReportRow {
  id: string;
  listing_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string;
  status: ReportRecord["status"];
  created_at: Date;
}

export interface TrustRepository {
  listReports(): Promise<ReportRecord[]>;
  createReport(input: ReportPayload): Promise<ReportRecord>;
}

function mapReport(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    listingId: row.listing_id ?? undefined,
    reportedUserId: row.reported_user_id ?? undefined,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at.toISOString()
  };
}

class MemoryTrustRepository implements TrustRepository {
  private reports: ReportRecord[] = [];

  async listReports() {
    return this.reports;
  }

  async createReport(input: ReportPayload) {
    const report: ReportRecord = {
      ...input,
      id: `rep_${randomUUID()}`,
      status: "open",
      createdAt: new Date().toISOString()
    };
    this.reports.unshift(report);
    return report;
  }
}

class PostgresTrustRepository implements TrustRepository {
  async listReports() {
    const result = await query<ReportRow>(`
      SELECT id, listing_id, reported_user_id, reason, details, status, created_at
      FROM trust.reports
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapReport);
  }

  async createReport(input: ReportPayload) {
    const result = await query<ReportRow>(
      `
        INSERT INTO trust.reports (id, listing_id, reported_user_id, reason, details)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, listing_id, reported_user_id, reason, details, status, created_at
      `,
      [`rep_${randomUUID()}`, input.listingId ?? null, input.reportedUserId ?? null, input.reason, input.details ?? ""]
    );
    return mapReport(result.rows[0]);
  }
}

export function createTrustRepository(): TrustRepository {
  return isDatabaseConfigured() ? new PostgresTrustRepository() : new MemoryTrustRepository();
}

