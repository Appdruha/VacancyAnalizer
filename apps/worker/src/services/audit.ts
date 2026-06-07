import { env } from "@edagent/config";
import { database } from "@edagent/database";

export async function createSystemAuditEntry(
  action: string,
  entityType: string,
  entityId: string
): Promise<void> {
  const adminUser = await database.findUserByEmail(env.ADMIN_EMAIL).catch(() => null);
  if (!adminUser) {
    return;
  }

  await database
    .createAuditLog({
      actorUserId: adminUser.id,
      action,
      entityType,
      entityId
    })
    .catch(() => undefined);
}
