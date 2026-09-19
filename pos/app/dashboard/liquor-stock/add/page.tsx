import { redirect } from "next/navigation";

export default function LegacyAddProductRoute() {
  redirect("/dashboard/inventory/manage");
}
