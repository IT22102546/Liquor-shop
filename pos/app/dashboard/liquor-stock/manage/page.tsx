import { redirect } from "next/navigation";

export default function LegacyProductSetupRoute() {
  redirect("/dashboard/inventory/manage");
}
