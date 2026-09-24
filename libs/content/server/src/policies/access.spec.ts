import { requireEditor, requirePermission } from "./access";
import type { Principal } from "@kara/permissions";
const creator: Principal = { id: "creator", permissions: ["post:create"] };
test("permissions do not override ownership and assignment", () => {
  expect(() =>
    requireEditor(creator, { ownerId: "other", assignedToId: null }),
  ).toThrow();
  expect(() =>
    requireEditor(creator, { ownerId: "other", assignedToId: "creator" }),
  ).not.toThrow();
  expect(() => requirePermission(creator, "post:publish")).toThrow();
});
