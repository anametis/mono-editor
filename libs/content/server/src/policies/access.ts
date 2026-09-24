import { ForbiddenException } from "@nestjs/common";
import type { Principal, Permission } from "@kara/permissions";
export function requirePermission(actor: Principal, permission: Permission) {
  if (!actor.permissions.includes(permission)) throw new ForbiddenException();
}
export function requireEditor(
  actor: Principal,
  post: { ownerId: string; assignedToId: string | null },
) {
  requirePermission(actor, "post:create");
  if (post.ownerId !== actor.id && post.assignedToId !== actor.id)
    throw new ForbiddenException();
}
