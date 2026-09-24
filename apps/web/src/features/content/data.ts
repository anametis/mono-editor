import "server-only";
import { apiClient } from "@kara/api-client";
export const publicApi = () =>
  apiClient(process.env.API_INTERNAL_URL ?? "http://localhost:4000");
