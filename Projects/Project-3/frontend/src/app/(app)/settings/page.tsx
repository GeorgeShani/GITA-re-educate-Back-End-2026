import { redirect } from "next/navigation";

/** The Settings tabs are separate pages; the bare address opens the first. */
export default function Page() {
  redirect("/settings/profile");
}
