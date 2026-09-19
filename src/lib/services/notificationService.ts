import { prisma } from "../prisma";
import { AuditService } from "./auditService";

export interface NotificationPayload {
  recipientType: "PATIENT" | "DOCTOR" | "HOSPITAL_ADMIN";
  recipientPhone?: string;
  recipientEmail?: string;
  subject: string;
  message: string;
  correlationId?: string;
}

export class NotificationService {
  private static twilioSid = process.env.TWILIO_ACCOUNT_SID;
  private static twilioToken = process.env.TWILIO_AUTH_TOKEN;
  private static twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  private static resendApiKey = process.env.RESEND_API_KEY;

  /**
   * Dispatches SMS and records notification history in database
   */
  public static async sendSms(payload: NotificationPayload): Promise<{ success: boolean; id: string }> {
    const contact = payload.recipientPhone || "+15551234567";
    let status = "SENT";

    // 1. If Twilio credentials are configured, execute live HTTP POST to Twilio Messages API
    if (this.twilioSid && this.twilioToken && this.twilioFrom && !contact.includes("5551234567")) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;
        const body = new URLSearchParams({
          From: this.twilioFrom,
          To: contact,
          Body: payload.message,
        });

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!res.ok) {
          console.warn(`[NotificationService] Twilio SMS failed with HTTP ${res.status}`);
          status = "FAILED";
        }
      } catch (err) {
        console.error(`[NotificationService] Error sending Twilio SMS: ${err}`);
        status = "FAILED";
      }
    } else {
      console.log(`[NotificationService: MOCK SMS] To: ${contact} | Message: "${payload.message}"`);
    }

    // 2. Persist notification audit record
    const notif = await prisma.notification.create({
      data: {
        correlationId: payload.correlationId,
        recipientType: payload.recipientType,
        recipientContact: contact,
        channel: "VOICE_SMS",
        subject: payload.subject,
        message: payload.message,
        status,
      },
    });

    if (payload.correlationId) {
      await AuditService.record({
        correlationId: payload.correlationId,
        actorRole: "SYSTEM",
        action: "SEND_SMS_NOTIFICATION",
        entityType: "WORKFLOW",
        entityId: notif.id,
        details: { to: contact, status },
      });
    }

    return { success: status === "SENT", id: notif.id };
  }

  /**
   * Dispatches Email notification and records history
   */
  public static async sendEmail(payload: NotificationPayload): Promise<{ success: boolean; id: string }> {
    const email = payload.recipientEmail || "patient@example.com";
    let status = "SENT";

    if (this.resendApiKey && !email.includes("example.com")) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AuraCare Health <notifications@auracare.com>",
            to: [email],
            subject: payload.subject,
            text: payload.message,
          }),
        });

        if (!res.ok) status = "FAILED";
      } catch (err) {
        status = "FAILED";
      }
    } else {
      console.log(`[NotificationService: MOCK EMAIL] To: ${email} | Subject: "${payload.subject}"`);
    }

    const notif = await prisma.notification.create({
      data: {
        correlationId: payload.correlationId,
        recipientType: payload.recipientType,
        recipientContact: email,
        channel: "EMAIL",
        subject: payload.subject,
        message: payload.message,
        status,
      },
    });

    return { success: status === "SENT", id: notif.id };
  }
}
