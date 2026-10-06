import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CompareTeaser } from "@/components/marketing/compare-teaser";
import { DevelopersBand } from "@/components/marketing/developers-band";
import { Exhibit } from "@/components/marketing/exhibit";
import { PersonalData } from "@/components/marketing/exhibits/personal-data";
import { FlowStrip } from "@/components/marketing/flow-strip";
import { Hero } from "@/components/marketing/hero";
import { SecurityFacts } from "@/components/marketing/security-facts";

/** The story in a minute: the promise, the path a file takes, one proof, then where it fits. Every capability in full is /features. */
export default function Page() {
  return (
    <>
      <Hero />

      <FlowStrip />

      <Exhibit
        id="personal-data"
        hue="sienna"
        title="Find the personal data before it spreads."
        visual={<PersonalData />}
      >
        <p>
          Every report says which columns look like email addresses, phone
          numbers, card numbers, IBANs, IP addresses, birth dates or secret
          keys. It is found by patterns and checksums, so it is{" "}
          <strong>never an AI guessing</strong>, and a value is never shown. If
          a file like that is open to the whole company, the people who can fix
          it are told.
        </p>
        <Link
          href="/features"
          className="link-draw mt-6 inline-flex items-center gap-2 text-base font-medium"
        >
          Everything Gridline does
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Exhibit>

      <DevelopersBand />
      <CompareTeaser />
      <SecurityFacts />
    </>
  );
}
