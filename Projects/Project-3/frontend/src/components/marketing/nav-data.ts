import {
  Eraser,
  GitCompareArrows,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  Rows3,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  Webhook,
} from "lucide-react";

/** What Gridline does, stated as the product does it. Every line is a real capability of the API. */
export const PRODUCT_LINKS = [
  {
    href: "/features#quality",
    label: "Checked on arrival",
    text: "A quality report and score for every upload, in seconds.",
    icon: ScanSearch,
  },
  {
    href: "/features#personal-data",
    label: "Personal-data scan",
    text: "Emails, cards, IBANs and keys found by checksum, never by AI.",
    icon: ShieldAlert,
  },
  {
    href: "/features#rules",
    label: "Your own rules",
    text: "Required columns, empty-cell limits, types, unique values.",
    icon: ListChecks,
  },
  {
    href: "/features#clean",
    label: "Clean",
    text: "Fix what the report found as the next version. Your upload is kept.",
    icon: Eraser,
  },
  {
    href: "/features#versions",
    label: "Versions",
    text: "Each upload becomes the next version, compared for you.",
    icon: GitCompareArrows,
  },
  {
    href: "/features#changes",
    label: "Row changes",
    text: "Which rows were added, removed and changed between versions.",
    icon: Rows3,
  },
  {
    href: "/features#ask",
    label: "Explore and ask",
    text: "Group and total every row, or ask a question in words.",
    icon: MessageCircleQuestion,
  },
  {
    href: "/features#access",
    label: "Access per person",
    text: "Company-wide or named colleagues. Everyone else sees nothing.",
    icon: Lock,
  },
  {
    href: "/features#audit",
    label: "Audit log",
    text: "Every change recorded, and the record cannot be edited.",
    icon: ScrollText,
  },
  {
    href: "/features#developers",
    label: "API and webhooks",
    text: "Scoped keys, signed webhooks, live updates, GraphQL.",
    icon: Webhook,
  },
] as const;

export const MAIN_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/security", label: "Security" },
  { href: "/docs", label: "Docs" },
] as const;

/**
 * The API reference lives in the BACKEND (Scalar, generated from the code), so this is a plain link, never a Next route.
 * Behind Caddy it is the same-origin path `/reference`; in local development the Next app has no such route, so
 * `NEXT_PUBLIC_API_REFERENCE_URL` points at the API's own origin.
 */
export const API_REFERENCE_HREF =
  process.env.NEXT_PUBLIC_API_REFERENCE_URL || "/reference";

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/features#personal-data", label: "Personal-data scan" },
      { href: "/features#clean", label: "Clean" },
      { href: "/features#changes", label: "Row changes" },
      { href: "/features#ask", label: "Explore and ask" },
      { href: "/pricing", label: "Pricing" },
      { href: "/compare", label: "Compare" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    title: "Compared with",
    links: [
      { href: "/compare#spreadsheets", label: "Spreadsheet tools" },
      { href: "/compare#databases", label: "Airtable and Smartsheet" },
      { href: "/compare#quality-tools", label: "Data-quality tools" },
      { href: "/compare#storage", label: "Box and Dropbox" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Guides" },
      { href: API_REFERENCE_HREF, label: "API reference", plain: true },
      { href: "/docs/authentication", label: "Authentication" },
      { href: "/docs/webhooks", label: "Webhooks" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create a company" },
      { href: "/forgot-password", label: "Reset a password" },
    ],
  },
] as const;
