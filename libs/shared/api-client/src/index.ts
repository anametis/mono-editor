import createClient from "openapi-fetch";
import type { paths } from "./schema";
export function apiClient(baseUrl = "") {
  return createClient<paths>({ baseUrl, credentials: "same-origin" });
}
export type { components, paths } from "./schema";
