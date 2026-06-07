import type {
  Company,
  CommunicationPackage,
  KnowledgeDocument,
  MessageEventType,
  MessageKind,
  ProjectRole
} from "@edagent/domain";

export function withOptional<T extends object, K extends string, V>(
  object: T,
  key: K,
  value: V | undefined
): T & Partial<Record<K, V>> {
  if (value === undefined) {
    return object;
  }

  return {
    ...object,
    [key]: value
  };
}

export function jsonRecord(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
    }
  }

  return result;
}

export function toCompanySize(value: "startup" | "smb" | "mid_market" | "enterprise"): Company["size"] {
  return value === "mid_market" ? "mid-market" : value;
}

export function toMessageKind(value: "outreach_email" | "follow_up_email"): MessageKind {
  return value === "follow_up_email" ? "follow-up-email" : "outreach-email";
}

export function fromMessageKind(value: MessageKind): "outreach_email" | "follow_up_email" {
  return value === "follow-up-email" ? "follow_up_email" : "outreach_email";
}

export function toMessageEventType(
  value: "queued" | "sent" | "delivered" | "replied" | "failed" | "follow_up_scheduled" | "escalated"
): MessageEventType {
  return value === "follow_up_scheduled" ? "follow-up-scheduled" : value;
}

export function fromMessageEventType(
  value: MessageEventType
): "queued" | "sent" | "delivered" | "replied" | "failed" | "follow_up_scheduled" | "escalated" {
  return value === "follow-up-scheduled" ? "follow_up_scheduled" : value;
}

export function jsonRoles(input: unknown): ProjectRole[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const title = typeof (item as { title?: unknown }).title === "string" ? (item as { title: string }).title : null;
    const summary =
      typeof (item as { summary?: unknown }).summary === "string" ? (item as { summary: string }).summary : null;

    if (!title || !summary) {
      return [];
    }

    return [{ title, summary }];
  });
}

export function toCommunicationPackageKind(value: "one_pager" | "faq"): CommunicationPackage["kind"] {
  return value === "one_pager" ? "one-pager" : "faq";
}

export function fromCommunicationPackageKind(value: CommunicationPackage["kind"]): "one_pager" | "faq" {
  return value === "one-pager" ? "one_pager" : "faq";
}

export function toKnowledgeDocumentKind(
  value: "company_profile" | "vacancy" | "communication_package" | "project_brief" | "memory_event" | "reply"
): KnowledgeDocument["kind"] {
  return value;
}

export function fromKnowledgeDocumentKind(
  value: KnowledgeDocument["kind"]
): "company_profile" | "vacancy" | "communication_package" | "project_brief" | "memory_event" | "reply" {
  return value;
}

export function jsonStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is string => typeof item === "string");
}

export function jsonNumberArray(input: unknown): number[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}
