import { redirect } from "next/navigation";

export default function LegacyLiquorStockRoute() {
  redirect("/dashboard/inventory");
}
