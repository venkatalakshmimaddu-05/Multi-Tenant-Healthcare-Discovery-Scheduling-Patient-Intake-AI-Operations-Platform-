export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  operation?: string;
  actorId?: string;
  actorRole?: string;
  [key: string]: any;
}

export class Logger {
  private static PII_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{10,12}\b/g, // Raw long numbers/phone
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
  ];

  /**
   * Redacts sensitive Personally Identifiable Information (PII) for HIPAA compliance
   */
  private static sanitize(obj: any): any {
    if (typeof obj === "string") {
      let sanitized = obj;
      for (const pattern of this.PII_PATTERNS) {
        sanitized = sanitized.replace(pattern, "[REDACTED_PII]");
      }
      return sanitized;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    if (obj !== null && typeof obj === "object") {
      const sanitizedObj: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (["password", "token", "secret", "creditCard", "ssn"].includes(key.toLowerCase())) {
          sanitizedObj[key] = "[REDACTED_SECRET]";
        } else {
          sanitizedObj[key] = this.sanitize(value);
        }
      }
      return sanitizedObj;
    }

    return obj;
  }

  private static log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message: this.sanitize(message),
      correlationId: context?.correlationId || "system",
      tenantId: context?.tenantId || "global",
      operation: context?.operation || "general",
      metadata: context ? this.sanitize(context) : undefined,
    };

    const output = JSON.stringify(entry);

    if (level === "ERROR") {
      console.error(output);
    } else if (level === "WARN") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public static info(message: string, context?: LogContext) {
    this.log("INFO", message, context);
  }

  public static warn(message: string, context?: LogContext) {
    this.log("WARN", message, context);
  }

  public static error(message: string, context?: LogContext) {
    this.log("ERROR", message, context);
  }

  public static debug(message: string, context?: LogContext) {
    this.log("DEBUG", message, context);
  }
}
