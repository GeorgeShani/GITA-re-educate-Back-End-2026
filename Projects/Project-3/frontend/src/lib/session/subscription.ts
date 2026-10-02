import "server-only";
import { cache } from "react";
import { apiClient } from "./api";

/**
 * The company's plan and usage. The frame and the page both want it, and every API call counts against the company's
 * requests-per-minute (30 on Free), so within one render it is asked once and shared.
 */
export const getSubscription = cache((accessToken: string) =>
  apiClient(accessToken).GET("/subscriptions/me"),
);
