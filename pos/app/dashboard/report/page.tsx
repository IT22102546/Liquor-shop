import { redirect } from "next/navigation";

// The old report page showed fixed sample figures. The dashboard's "Report" button now prints a
// real sales report for any date range.
export default function LegacyReportRoute() {
  redirect("/dashboard");
}
