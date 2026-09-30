import {
  GitCompareArrows,
  ListChecks,
  Lock,
  ScanSearch,
  ScrollText,
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
    href: "/features#rules",
    label: "Your own rules",
    text: "Required columns, empty-cell limits, types, unique values.",
    icon: ListChecks,
  },
  {
    href: "/features#versions",
    label: "Versions",
    text: "Each upload becomes the next version, compared for you.",
    icon: GitCompareArrows,
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

/** The API reference is served by the API itself (Caddy routes /reference there), so it is a plain link, not a Next route. */
export const API_REFERENCE_HREF = "/reference";

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
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
