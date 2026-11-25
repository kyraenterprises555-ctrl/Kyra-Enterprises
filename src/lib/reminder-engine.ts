import nodemailer from "nodemailer";
import { IReminderProviderConfig } from "@/models/BusinessSettings";
import {
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_REMINDER_TEMPLATE,
  ReminderTemplateContext,
  renderReminderTemplate,
} from "./reminder-templates";

export { renderReminderTemplate, type ReminderTemplateContext };

export function buildReminderContent(
  subjectTpl: string | undefined,
  bodyTpl: string | undefined,
  ctx: ReminderTemplateContext
): { subject: string; body: string } {
  return {
    subject: renderReminderTemplate(subjectTpl || DEFAULT_REMINDER_SUBJECT, ctx),
    body: renderReminderTemplate(bodyTpl || DEFAULT_REMINDER_TEMPLATE, ctx),
  };
}

export interface ChannelDispatchResult {
  status: "sent" | "failed" | "provider_not_configured";
  providerResponse?: string;
  errorMessage?: string;
}

export async function dispatchReminderChannel(params: {
  channel: "email" | "whatsapp" | "sms" | "in_app";
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  body: string;
  context: ReminderTemplateContext;
  providers?: IReminderProviderConfig;
}): Promise<ChannelDispatchResult> {
  const providers = params.providers || {};

  if (params.channel === "in_app") {
    return {
      status: "sent",
      providerResponse: "Recorded in Kyra Enterprises in-app notification center",
    };
  }

  if (params.channel === "email") {
    const host = providers.smtpHost || process.env.SMTP_HOST || "";
    const user = providers.smtpUser || process.env.SMTP_USER || "";
    const pass = providers.smtpPass || process.env.SMTP_PASS || "";
    const port = Number(providers.smtpPort || process.env.SMTP_PORT || 587);
    const from = providers.smtpFrom || process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      return {
        status: "provider_not_configured",
        errorMessage:
          "SMTP email provider is not configured. Configure SMTP credentials in Payment Reminder Settings.",
      };
    }

    if (!params.recipientEmail) {
      return {
        status: "failed",
        errorMessage: "Customer does not have an email address on record.",
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: Boolean(providers.smtpSecure || port === 465),
        auth: { user, pass },
      });
      const info = await transporter.sendMail({
        from: `"Kyra Enterprises" <${from}>`,
        to: params.recipientEmail,
        subject: params.subject,
        text: params.body,
      });
      return {
        status: "sent",
        providerResponse: `MessageId: ${info.messageId}`,
      };
    } catch (err: unknown) {
      return {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "SMTP delivery error",
      };
    }
  }

  if (params.channel === "whatsapp") {
    const phoneId = providers.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    const token = providers.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
    const templateName =
      providers.whatsappTemplateName || process.env.WHATSAPP_TEMPLATE_NAME || "";
    const baseApi =
      providers.whatsappApiUrl || "https://graph.facebook.com/v20.0";

    if (!phoneId || !token || !templateName) {
      return {
        status: "provider_not_configured",
        errorMessage:
          "WhatsApp Cloud API credentials or approved template name not configured.",
      };
    }

    const cleanPhone = (params.recipientPhone || "").replace(/[^0-9]/g, "");
    if (!cleanPhone) {
      return {
        status: "failed",
        errorMessage: "Customer phone number is missing or invalid for WhatsApp.",
      };
    }

    try {
      const endpoint = `${baseApi.replace(/\/$/, "")}/${phoneId}/messages`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: params.context.customerName },
                  { type: "text", text: params.context.invoiceNumber },
                  { type: "text", text: `₹${params.context.invoiceAmount}` },
                  { type: "text", text: `₹${params.context.amountPaid}` },
                  { type: "text", text: `₹${params.context.remainingBalance}` },
                ],
              },
            ],
          },
        }),
      });

      const resBody = await response.text();
      if (!response.ok) {
        return {
          status: "failed",
          errorMessage: `WhatsApp API ${response.status}: ${resBody.slice(0, 200)}`,
        };
      }
      return {
        status: "sent",
        providerResponse: resBody.slice(0, 250),
      };
    } catch (err: unknown) {
      return {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "WhatsApp request failed",
      };
    }
  }

  if (params.channel === "sms") {
    const smsUrl = providers.smsApiUrl || process.env.SMS_API_URL || "";
    const smsKey = providers.smsApiKey || process.env.SMS_API_KEY || "";

    if (!smsUrl || !smsKey) {
      return {
        status: "provider_not_configured",
        errorMessage: "SMS gateway provider URL and API key are not configured.",
      };
    }

    const cleanPhone = (params.recipientPhone || "").replace(/[^0-9+]/g, "");
    if (!cleanPhone) {
      return {
        status: "failed",
        errorMessage: "Customer phone number is missing for SMS delivery.",
      };
    }

    try {
      const response = await fetch(smsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${smsKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: cleanPhone,
          sender: providers.smsSenderId || "KYRAEN",
          message: params.body,
        }),
      });
      const resBody = await response.text();
      if (!response.ok) {
        return {
          status: "failed",
          errorMessage: `SMS Gateway ${response.status}: ${resBody.slice(0, 200)}`,
        };
      }
      return {
        status: "sent",
        providerResponse: resBody.slice(0, 250),
      };
    } catch (err: unknown) {
      return {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "SMS delivery error",
      };
    }
  }

  return {
    status: "provider_not_configured",
    errorMessage: `Unsupported channel: ${params.channel}`,
  };
}

/**
 * Computes a deterministic period key for an invoice reminder cycle so duplicate
 * reminders within the same 3-day or 4-day window are strictly prevented.
 */
export function computeReminderPeriodKey(
  invoiceCreatedOrStartDate: Date | string,
  intervalDays: number,
  now: Date = new Date()
): string {
  const startMs = new Date(invoiceCreatedOrStartDate).getTime();
  const intervalMs = Math.max(1, intervalDays) * 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, now.getTime() - startMs);
  const bucketIndex = Math.floor(elapsed / intervalMs);
  return `cycle_${intervalDays}d_${bucketIndex}`;
}
