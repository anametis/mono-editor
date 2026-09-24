export const permissions = [
  "post:create",
  "post:review",
  "post:publish",
  "post:assign",
  "staff:manage",
  "interaction:moderate",
] as const;
export type Permission = (typeof permissions)[number];
export type Principal = { id: string; permissions: Permission[] };
export const roles = {
  creator: ["post:create"],
  reviewer: ["post:review"],
  publisher: ["post:review", "post:publish", "post:assign"],
  administrator: [...permissions],
} satisfies Record<string, Permission[]>;
