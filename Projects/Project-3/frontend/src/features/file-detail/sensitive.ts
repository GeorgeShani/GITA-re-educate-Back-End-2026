/** What a column that looks like personal or secret data holds, in words a person would use. Matches the API's kinds. */
export const SENSITIVE_LABEL: Record<string, string> = {
  email: "email addresses",
  phone: "phone numbers",
  card_number: "payment card numbers",
  iban: "bank account numbers (IBAN)",
  ip_address: "IP addresses",
  secret: "secrets (keys or tokens)",
  birth_date: "dates of birth",
};

/** The kind in words; a kind a newer API invented is shown as it came, never hidden. */
export function sensitiveLabel(kind: string): string {
  return SENSITIVE_LABEL[kind] ?? kind.replaceAll("_", " ");
}
