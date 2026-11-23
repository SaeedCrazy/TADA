import type { Db } from '../../db.js';
import { Prisma } from '../../db.js';

export interface AuditEntry {
  staffId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: unknown;
  ip?: string | null;
}

/** Append-only record of who changed what. Never blocks the action it describes. */
export async function audit(db: Db, e: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        staffId: e.staffId,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        data: e.data === undefined ? Prisma.JsonNull : (e.data as Prisma.InputJsonValue),
        ip: e.ip ?? null,
      },
    });
  } catch {
    // auditing must not break the request
  }
}
