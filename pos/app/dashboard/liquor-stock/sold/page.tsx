import { redirect } from "next/navigation";

export default function LegacySoldProductsRoute() {
  redirect("/dashboard/inventory/sold");
}
