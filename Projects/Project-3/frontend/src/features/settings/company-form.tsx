"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, inputStyles } from "@/components/ui/field";
import { type Country, INDUSTRIES } from "@/features/auth/geo";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";

const selectStyles = cn(inputStyles(), "pr-8");

/** The company's name, country, industry and the address invoices and account notices go to. Admins only. */
export function CompanyForm({
  name,
  country,
  industry,
  billingEmail,
  countries,
}: {
  name: string;
  country: string;
  industry: string;
  billingEmail: string;
  countries: Country[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name, country, industry, billingEmail });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setSaved(false);
    setProblem(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (form.name.trim() === "") {
      setProblem("Enter the company's name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billingEmail.trim())) {
      setProblem("Enter a complete billing email, like billing@acme.com.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setSaved(false);
    const result = await callApi("PATCH", "/companies/me", {
      name: form.name.trim(),
      country: form.country,
      industry: form.industry,
      billingEmail: form.billingEmail.trim(),
    });
    if (succeeded(result)) {
      setSaved(true);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <form
      className="leaf flex max-w-xl flex-col gap-5 p-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field label="Company name">
        {(control) => (
          <Input
            {...control}
            value={form.name}
            maxLength={120}
            autoComplete="organization"
            onChange={(event) => set("name", event.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country">
          {(control) => (
            <select
              {...control}
              className={selectStyles}
              value={form.country}
              onChange={(event) => set("country", event.target.value)}
            >
              {countries.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Industry">
          {(control) => (
            <select
              {...control}
              className={selectStyles}
              value={form.industry}
              onChange={(event) => set("industry", event.target.value)}
            >
              {INDUSTRIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field
        label="Billing email"
        hint="Where invoices and account notices go, including quota and payment emails."
      >
        {(control) => (
          <Input
            {...control}
            type="email"
            value={form.billingEmail}
            autoComplete="off"
            onChange={(event) => set("billingEmail", event.target.value)}
          />
        )}
      </Field>

      {problem ? (
        <p role="alert" className="font-medium text-hold">
          {problem}
        </p>
      ) : null}
      {saved ? (
        <output className="block font-medium text-pass">Saved.</output>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
