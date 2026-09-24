import { z } from "zod";
export const schema = z.object({
  title: z.string().min(1).max(160),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  summary: z.string().min(1).max(320),
  body: z.string().min(1).max(100000),
});
