import { expect, test } from "vitest";
import { schema } from "./draft-schema";
test("draft form rejects invalid slugs and oversized summaries", () => {
  const draft = {
    slug: "valid-story",
    title: "A story",
    summary: "Summary",
    body: "Body",
  };
  expect(schema.safeParse(draft).success).toBe(true);
  expect(schema.safeParse({ ...draft, slug: "../private" }).success).toBe(
    false,
  );
  expect(schema.safeParse({ ...draft, summary: "x".repeat(321) }).success).toBe(
    false,
  );
});
