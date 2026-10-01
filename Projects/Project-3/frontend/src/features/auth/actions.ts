"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  apiClient,
  type Problem,
  toProblem,
  UNREACHABLE,
} from "@/lib/session/api";
import { safeNext } from "@/lib/session/session";
import { toTokens, writeSession } from "@/lib/session/tokens";
import type { FormState } from "./form-state";
import { toIndustry } from "./geo";

/** A text field of the submitted form, trimmed; empty when absent. Passwords are read with `raw` so they are never trimmed. */
function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function raw(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function refused(
  problem: Problem,
  values: Record<string, string>,
  extra: { needsActivation?: boolean } = {},
): FormState {
  return { status: "error", messages: problem.messages, values, ...extra };
}

/** Sign in with email and password, then go where the person was headed. */
export async function login(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = text(form, "email");
  const values = { email };
  try {
    const { data, error, response } = await apiClient().POST("/auth/login", {
      body: { email, password: raw(form, "password") },
    });
    const tokens = toTokens(data);
    if (!tokens) {
      const problem = toProblem(response, error);
      return refused(problem, values, {
        needsActivation:
          problem.status === 403 &&
          /not activated/i.test(problem.messages[0] ?? ""),
      });
    }
    writeSession(await cookies(), tokens);
  } catch {
    return refused(UNREACHABLE, values);
  }
  redirect(safeNext(text(form, "next")));
}

/** Create a company and its first admin. The account stays inactive until the emailed link is used. */
export async function registerCompany(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const companyName = text(form, "companyName");
  const email = text(form, "email");
  const country = text(form, "country");
  const industry = toIndustry(form.get("industry"));
  const values = {
    companyName,
    email,
    country,
    industry: industry ?? "",
  };
  if (!industry) {
    return {
      status: "error",
      messages: ["Choose the industry that fits your company best."],
      values,
    };
  }
  try {
    const { data, error, response } = await apiClient().POST(
      "/auth/register-company",
      {
        body: {
          companyName,
          email,
          password: raw(form, "password"),
          country,
          industry,
        },
      },
    );
    if (!data) return refused(toProblem(response, error), values);
  } catch {
    return refused(UNREACHABLE, values);
  }
  return { status: "sent", email };
}

/** Finish a company registration that began with Google: the profile comes from the signed token, the company from the form. */
export async function registerWithGoogle(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const companyName = text(form, "companyName");
  const country = text(form, "country");
  const email = text(form, "email");
  const industry = toIndustry(form.get("industry"));
  const values = { companyName, country, email, industry: industry ?? "" };
  if (!industry) {
    return {
      status: "error",
      messages: ["Choose the industry that fits your company best."],
      values,
    };
  }
  try {
    const { data, error, response } = await apiClient().POST(
      "/auth/oauth/register-company",
      {
        body: {
          companyName,
          country,
          industry,
          oauthRegistrationToken: text(form, "oauthRegistrationToken"),
          ...(email ? { email } : {}),
        },
      },
    );
    if (!data) return refused(toProblem(response, error), values);
    const tokens = toTokens(data.session);
    if (tokens) {
      writeSession(await cookies(), tokens);
    } else {
      return { status: "sent", email };
    }
  } catch {
    return refused(UNREACHABLE, values);
  }
  redirect("/dashboard");
}

/** Always the same answer, whether or not the address has an account: that is the API's promise too. */
export async function forgotPassword(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = text(form, "email");
  try {
    const { response, error } = await apiClient().POST(
      "/auth/password/forgot",
      {
        body: { email },
      },
    );
    if (!response.ok) return refused(toProblem(response, error), { email });
  } catch {
    return refused(UNREACHABLE, { email });
  }
  return { status: "sent", email };
}

export async function resendActivation(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = text(form, "email");
  try {
    const { response, error } = await apiClient().POST(
      "/auth/resend-activation",
      { body: { email } },
    );
    if (!response.ok) return refused(toProblem(response, error), { email });
  } catch {
    return refused(UNREACHABLE, { email });
  }
  return { status: "sent", email };
}

/** Set a new password from the emailed link, then sign in on the next page. */
export async function resetPassword(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const { response, error } = await apiClient().POST("/auth/password/reset", {
      body: {
        token: text(form, "token"),
        newPassword: raw(form, "password"),
      },
    });
    if (!response.ok) return refused(toProblem(response, error), {});
  } catch {
    return refused(UNREACHABLE, {});
  }
  redirect("/login?reset=1");
}

/** Accept an invitation: choose a password, and the person is signed in. */
export async function acceptInvite(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const { data, error, response } = await apiClient().POST(
      "/auth/accept-invite",
      {
        body: { token: text(form, "token"), password: raw(form, "password") },
      },
    );
    const tokens = toTokens(data);
    if (!tokens) return refused(toProblem(response, error), {});
    writeSession(await cookies(), tokens);
  } catch {
    return refused(UNREACHABLE, {});
  }
  redirect("/dashboard");
}
