import { env } from "@edagent/config";
import type {
  EmailDiagnostics,
  EmailProvider,
  EmailProviderErrorCode,
  EmailSendInput,
  EmailSendResult
} from "./types.js";

export class EmailProviderError extends Error {
  readonly code: EmailProviderErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly details?: string;

  constructor(input: {
    message: string;
    code: EmailProviderErrorCode;
    status?: number | null;
    retryable: boolean;
    details?: string;
  }) {
    super(input.message);
    this.name = "EmailProviderError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.retryable = input.retryable;
    if (input.details !== undefined) {
      this.details = input.details;
    }
  }
}

export class DisabledEmailProvider implements EmailProvider {
  readonly name = "disabled-email";

  async sendMessage(): Promise<EmailSendResult> {
    throw new EmailProviderError({
      message: "EMAIL_PROVIDER is disabled. Use EMAIL_PROVIDER=simulated for demo mode or configure Mailgun for live delivery.",
      code: "invalid_configuration",
      retryable: false
    });
  }
}

export class SimulatedEmailProvider implements EmailProvider {
  readonly name = "simulated-email";

  async sendMessage(input: EmailSendInput): Promise<EmailSendResult> {
    const deliveredAt = new Date().toISOString();
    const providerMessageId = `simulated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(
      JSON.stringify({
        scope: "email.provider",
        provider: this.name,
        status: "accepted",
        mode: "simulated",
        to: input.to,
        subject: input.subject,
        providerMessageId
      })
    );

    return {
      provider: this.name,
      providerMessageId,
      accepted: true,
      deliveredAt
    };
  }
}

function classifyEmailStatus(status: number): Pick<EmailProviderError, "code" | "retryable"> {
  switch (status) {
    case 401:
      return { code: "unauthorized", retryable: false };
    case 403:
      return { code: "forbidden", retryable: false };
    case 429:
      return { code: "rate_limited", retryable: true };
    default:
      if (status >= 500) {
        return { code: "upstream_error", retryable: true };
      }
      return { code: "unknown", retryable: false };
  }
}

export class MailgunEmailProvider implements EmailProvider {
  readonly name = "mailgun";

  async sendMessage(input: EmailSendInput): Promise<EmailSendResult> {
    if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
      throw new EmailProviderError({
        message: "MAILGUN_API_KEY or MAILGUN_DOMAIN is not configured.",
        code: "invalid_configuration",
        retryable: false
      });
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, env.EMAIL_PROVIDER_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const body = new URLSearchParams();
      body.set("from", env.EMAIL_FROM);
      body.set("to", input.to);
      body.set("subject", input.subject);
      body.set("text", input.body);
      if (input.replyTo) {
        body.set("h:Reply-To", input.replyTo);
      }

      const response = await fetch(`${env.MAILGUN_API_BASE_URL}/${env.MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: body.toString(),
        signal: controller.signal
      });

      if (!response.ok) {
        const details = (await response.text().catch(() => "")).slice(0, 320);
        const classification = classifyEmailStatus(response.status);
        console.log(
          JSON.stringify({
            scope: "email.provider",
            provider: this.name,
            status: "error",
            to: input.to,
            subject: input.subject,
            durationMs: Date.now() - startedAt,
            httpStatus: response.status,
            errorCode: classification.code,
            retryable: classification.retryable
          })
        );
        throw new EmailProviderError({
          message: `Mailgun request failed with status ${response.status}.`,
          code: classification.code,
          status: response.status,
          retryable: classification.retryable,
          details
        });
      }

      const payload = (await response.json().catch(() => null)) as { id?: string } | null;
      const providerMessageId =
        payload?.id ??
        response.headers.get("x-message-id") ??
        `mailgun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const deliveredAt = new Date().toISOString();

      console.log(
        JSON.stringify({
          scope: "email.provider",
          provider: this.name,
          status: "accepted",
          to: input.to,
          subject: input.subject,
          durationMs: Date.now() - startedAt,
          providerMessageId
        })
      );

      return {
        provider: this.name,
        providerMessageId,
        accepted: true,
        deliveredAt
      };
    } catch (error: unknown) {
      if (error instanceof EmailProviderError) {
        throw error;
      }

      const aborted = error instanceof Error && error.name === "AbortError";
      throw new EmailProviderError(
        error instanceof Error
          ? {
              message: aborted
                ? `Email provider request timed out after ${env.EMAIL_PROVIDER_TIMEOUT_MS}ms.`
                : "Email provider request failed due to network error.",
              code: aborted ? "timeout" : "network_error",
              retryable: true,
              details: error.message
            }
          : {
              message: aborted
                ? `Email provider request timed out after ${env.EMAIL_PROVIDER_TIMEOUT_MS}ms.`
                : "Email provider request failed due to network error.",
              code: aborted ? "timeout" : "network_error",
              retryable: true
            }
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export function getEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === "simulated") {
    return new SimulatedEmailProvider();
  }

  if (env.EMAIL_PROVIDER === "mailgun") {
    return new MailgunEmailProvider();
  }

  return new DisabledEmailProvider();
}

export function getEmailDiagnostics(): EmailDiagnostics {
  const simulatedEnabled = env.EMAIL_PROVIDER === "simulated";
  const disabledEnabled = env.EMAIL_PROVIDER === "disabled";
  const mailgunEnabled = env.EMAIL_PROVIDER === "mailgun";

  return {
    configuredProvider: env.EMAIL_PROVIDER,
    fromEmail: env.EMAIL_FROM,
    simulatedConfigured: true,
    mailgunConfigured: Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN),
    timeoutMs: env.EMAIL_PROVIDER_TIMEOUT_MS,
    providers: [
      {
        name: "simulated",
        enabled: simulatedEnabled,
        ready: true,
        notes: [
          "Recommended demo mode: outreach messages are accepted inside the platform without external email delivery."
        ]
      },
      {
        name: "disabled",
        enabled: disabledEnabled,
        ready: false,
        notes: ["Outreach delivery is turned off completely."]
      },
      {
        name: "mailgun",
        enabled: mailgunEnabled,
        ready: Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN),
        notes:
          env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN
            ? ["Mailgun API key and domain are present."]
            : ["Missing MAILGUN_API_KEY or MAILGUN_DOMAIN, live email delivery is not available."]
      }
    ]
  };
}
