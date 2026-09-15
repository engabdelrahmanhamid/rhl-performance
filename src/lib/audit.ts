/**
 * خدمة سجل العمليات (Audit Log) — §5.10/§28 من المتطلبات، مع طبقة تنقية إلزامية
 * قبل الحفظ (§21 من المراجعة المعمارية): لا تُخزَّن كلمات المرور أو الرموز أو الأسرار مطلقًا،
 * حتى لو مُرِّرت بالخطأ ضمن beforeData/afterData.
 */

import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "ARCHIVE"
  | "RESTORE"
  | "IMPORT_EMPLOYEES"
  | "CREATE_CYCLE"
  | "OPEN_CYCLE"
  | "CLOSE_CYCLE"
  | "DELETE_CYCLE"
  | "CHANGE_TARGET"
  | "CHANGE_ASSIGNMENT"
  | "CHANGE_EVALUATOR_WEIGHT"
  | "EVALUATION_SAVE"
  | "EVALUATION_SUBMIT"
  | "EVALUATION_REOPEN"
  | "ATTACHMENT_UPLOAD"
  | "REPORT_EXPORT"
  | "GRANT_PERMISSION"
  | "REVOKE_PERMISSION"
  | "RESET_PASSWORD";

export interface WriteAuditLogInput {
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
}

const SENSITIVE_KEYS = new Set([
  "passwordhash",
  "password",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
  "sessiontoken",
  "nextauth_secret",
]);

/** يحذف أي حقل حساس بشكل عميق ومتكرر (Deep) قبل أي تخزين في Audit Log. */
function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) return value.map(sanitize);

  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue; // حذف كامل - لا حتى نسخة مُقنَّعة
      result[key] = sanitize(val);
    }
    return result;
  }

  return value;
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  const beforeData = input.beforeData ? sanitize(JSON.parse(JSON.stringify(input.beforeData))) : undefined;
  const afterData = input.afterData ? sanitize(JSON.parse(JSON.stringify(input.afterData))) : undefined;

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress ?? null,
      beforeData: beforeData as never,
      afterData: afterData as never,
      reason: input.reason ?? null,
    },
  });
}
