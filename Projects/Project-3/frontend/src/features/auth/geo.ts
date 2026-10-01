/** ISO 3166-1 alpha-2 codes. The names come from the platform (`Intl.DisplayNames`), so none is typed here twice. */
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

export interface Country {
  code: string;
  name: string;
}

/** Every country, sorted by its English name. */
export function countries(): Country[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort(
    (a, b) => a.name.localeCompare(b.name, "en"),
  );
}

/** What the API accepts for `industry`, with the words a person would use. */
export const INDUSTRIES = [
  { value: "finance", label: "Finance" },
  { value: "e-commerce", label: "E-commerce" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "logistics", label: "Logistics" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "media", label: "Media" },
  { value: "real-estate", label: "Real estate" },
  { value: "technology", label: "Technology" },
  { value: "other", label: "Other" },
] as const;

export type Industry = (typeof INDUSTRIES)[number]["value"];

export function toIndustry(value: unknown): Industry | null {
  return INDUSTRIES.find((industry) => industry.value === value)?.value ?? null;
}
