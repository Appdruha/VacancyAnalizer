import type { EntityId, ISODateTime } from "./common.js";

export type UserRole = "admin" | "operator" | "manager";

export type User = {
  id: EntityId;
  email: string;
  fullName: string;
  role: UserRole;
};

export type SystemSetting = {
  key: string;
  value: string;
  updatedAt: ISODateTime;
};

export type AuditLog = {
  id: EntityId;
  actorUserId: EntityId;
  action: string;
  entityType: string;
  entityId: EntityId;
  createdAt: ISODateTime;
};

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type BackgroundJob = {
  id: EntityId;
  queue: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, string | number | boolean | null>;
  lastError?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
