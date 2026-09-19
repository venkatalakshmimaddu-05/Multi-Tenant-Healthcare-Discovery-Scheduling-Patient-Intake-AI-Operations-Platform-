import { prisma } from "../prisma";
import { v4 as uuidv4 } from "uuid";

export interface AuditParams {
  correlationId: string;
  hospitalId?: string | null;
  actorRole: "PATIENT" | "DOCTOR" | "HOSPITAL_ADMIN" | "PLATFORM_ADMIN" | "AI_AGENT" | "SYSTEM";
  actorId?: string | null;
  action: string;
  entityType: "APPOINTMENT" | "PATIENT" | "DOCTOR" | "HOSPITAL" | "EHR_RECORD" | "QUESTIONNAIRE" | "WORKFLOW";
  entityId?: string | null;
  details?: Record<string, any>;
}

export class AuditService {
  public static generateCorrelationId(prefix = "corr"): string {
    return `${prefix}-${Date.now().toString(36)}-${uuidv4().substring(0, 8)}`;
  }

  public static async record(params: AuditParams): Promise<void> {
    try {
      // Privacy-aware sanitization: redact sensitive healthcare phrases or credit card/SSN patterns
      const sanitizedDetails = params.details ? this.sanitize(params.details) : {};

      await prisma.auditEvent.create({
        data: {
          correlationId: params.correlationId,
          hospitalId: params.hospitalId ?? null,
          actorRole: params.actorRole,
          actorId: params.actorId ?? null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          detailsJson: JSON.stringify(sanitizedDetails),
        },
      });
    } catch (err) {
      console.error("[AuditService] Failed to record audit event:", err);
    }
  }

  public static async getTrace(correlationId: string) {
    const auditEvents = await prisma.auditEvent.findMany({
      where: { correlationId },
      orderBy: { timestamp: "asc" },
    });

    const capabilityExecutions = await prisma.capabilityExecution.findMany({
      where: { correlationId },
      orderBy: { executedAt: "asc" },
    });

    const integrationOperations = await prisma.integrationOperation.findMany({
      where: { correlationId },
      orderBy: { timestamp: "asc" },
    });

    const notifications = await prisma.notification.findMany({
      where: { correlationId },
      orderBy: { sentAt: "asc" },
    });

    return {
      correlationId,
      auditEvents,
      capabilityExecutions,
      integrationOperations,
      notifications,
    };
  }

  private static sanitize(obj: Record<string, any>): Record<string, any> {
    const copy = { ...obj };
    const sensitiveKeys = ["password", "token", "ssn", "secret", "cardNumber"];
    for (const key of Object.keys(copy)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        copy[key] = "[REDACTED]";
      } else if (typeof copy[key] === "object" && copy[key] !== null) {
        copy[key] = this.sanitize(copy[key]);
      }
    }
    return copy;
  }
}
