import { countries } from "@/features/auth/geo";
import { CompanyForm } from "@/features/settings/company-form";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Company settings" };

export default async function Page() {
  const { user, company } = await requireSession();
  return (
    <section aria-labelledby="company-heading" className="flex flex-col gap-4">
      <h2 id="company-heading" className="text-2xl font-semibold">
        Company
      </h2>
      {user.role === "admin" ? (
        <CompanyForm
          name={company.name}
          country={company.country}
          industry={company.industry}
          billingEmail={company.billingEmail}
          countries={countries()}
        />
      ) : (
        <div className="leaf flex max-w-xl flex-col gap-2 p-5">
          <p className="font-semibold">Admins only</p>
          <p className="text-text-muted">
            Your company&apos;s details are kept by its admins. Ask one of them
            if something needs to change.
          </p>
        </div>
      )}
    </section>
  );
}
