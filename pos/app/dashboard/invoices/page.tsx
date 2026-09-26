import { redirect } from "next/navigation";

// Liquor-shop sales have no down payments or open invoices; every sale is a paid bill.
export default function LegacyInvoicesRoute() {
  redirect("/dashboard/sales");
}
