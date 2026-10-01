"use server";

import { redirect } from "next/navigation";
import { isRecord } from "@/lib/guards";
import { apiClient, toProblem, UNREACHABLE } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export type ChoosePlanState =
  | { status: "idle" }
  | { status: "error"; messages: string[] };

function toPlan(
  value: FormDataEntryValue | null,
): "free" | "basic" | "premium" | null {
  return value === "free" || value === "basic" || value === "premium"
    ? value
    : null;
}

/**
 * Pick the company's first plan. Free is active at once. A paid plan answers with a hosted checkout address (the card is
 * never entered on this site) and becomes the plan only when the payment provider confirms it; with payments switched off
 * (development) a paid plan activates at once like Free.
 */
export async function choosePlan(
  _previous: ChoosePlanState,
  form: FormData,
): Promise<ChoosePlanState> {
  const plan = toPlan(form.get("plan"));
  if (!plan) {
    return { status: "error", messages: ["Choose one of the plans."] };
  }
  const session = await requireSession();

  let checkout: string | null = null;
  try {
    const { data, error, response } = await apiClient(session.accessToken).POST(
      "/subscriptions/me",
      { body: { plan } },
    );
    if (!data) {
      const problem = toProblem(response, error);
      return { status: "error", messages: problem.messages };
    }
    // A pending change carries the hosted checkout address; the typed schema says object, the wire says string.
    const body: unknown = data;
    if (isRecord(body) && body.state === "pending") {
      const url: unknown = body.checkoutUrl;
      checkout = typeof url === "string" ? url : null;
    }
  } catch {
    return { status: "error", messages: UNREACHABLE.messages };
  }
  redirect(checkout ?? "/dashboard");
}
