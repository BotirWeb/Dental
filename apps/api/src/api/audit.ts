import { db } from "../db/client";
import { auditLog } from "../db/schema";

interface RecordAuditInput {
  clinicId: string;
  userId: string | null;
  entity: string;
  entityId: string;
  action: "create" | "update" | "delete";
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Qollanma bo'lim 9, qoida 9: "Har o'zgartirish audit_log ga tushadi — kim,
 * qachon, eski va yangi qiymat." Har bir yozuvni o'zgartiradigan route
 * (create/update/delete) shu funksiyani chaqirishi shart.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await db.insert(auditLog).values({
    clinicId: input.clinicId,
    userId: input.userId,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    oldValue: (input.oldValue as object | null) ?? null,
    newValue: (input.newValue as object | null) ?? null,
  });
}
