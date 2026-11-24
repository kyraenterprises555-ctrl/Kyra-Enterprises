import { DataService } from "./db-store";

export interface LogAuditParams {
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  performedBy?: {
    userId?: string;
    userName?: string;
    role?: string;
  };
  ipAddress?: string;
}

export async function recordAuditLog(params: LogAuditParams): Promise<void> {
  try {
    await DataService.createAuditLog({
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details || {},
      performedBy: {
        userId: params.performedBy?.userId || "system",
        userName: params.performedBy?.userName || "System",
        role: params.performedBy?.role || "system",
      },
      ipAddress: params.ipAddress || "",
    });
  } catch {
    // Graceful silent fallback
  }
}
