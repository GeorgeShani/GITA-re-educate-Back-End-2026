"use server";

import { cookies } from "next/headers";
import type { FormState } from "@/features/auth/form-state";
import { apiClient, toProblem, UNREACHABLE } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";
import { toTokens, writeSession } from "@/lib/session/tokens";

function raw(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Change the signed-in person's password. The API signs every other session out and answers with a NEW one for this
 * browser, so it cannot go through the browser's door to the API (which never hands out tokens): it is done here, and the
 * new tokens are written to this browser's cookies. Passwords are never echoed back into the form.
 */
export async function changePassword(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const current = raw(form, "currentPassword");
  const next = raw(form, "newPassword");
  if (next !== raw(form, "confirmPassword")) {
    return {
      status: "error",
      messages: ["The two new passwords are not the same. Type it again."],
      values: {},
    };
  }
  const session = await requireSession();
  try {
    const { data, error, response } = await apiClient(
      session.accessToken,
    ).PATCH("/auth/password", {
      body: { currentPassword: current, newPassword: next },
    });
    const tokens = toTokens(data);
    if (!tokens) {
      return {
        status: "error",
        messages: toProblem(response, error).messages,
        values: {},
      };
    }
    writeSession(await cookies(), tokens);
  } catch {
    return { status: "error", messages: UNREACHABLE.messages, values: {} };
  }
  return {
    status: "saved",
    message:
      "Your password was changed. You stay signed in here; every other device was signed out.",
  };
}
