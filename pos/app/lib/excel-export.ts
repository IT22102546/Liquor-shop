type LedgerRow = {
  typeLabel: string;
  refNo?: string | null;
  date: string;
  description?: string | null;
  chequeNo?: string | null;
  drAmount: number;
  crAmount: number;
  balance: number;
};

type LedgerResult = {
  account: { name: string; code: string; type: string };
  openingBalance: number;
  rows: LedgerRow[];
  totalDr: number;
  totalCr: number;
  closingBalance: number;
};

function fmt(v: number) {
  return v.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB");
}

function balanceSide(v: number): string {
  return v >= 0 ? `${fmt(v)} Dr` : `${fmt(Math.abs(v))} Cr`;
}

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

export function exportLedgerToExcel(data: LedgerResult, from: string, to: string): void {
  if (typeof window === "undefined") return;

  const { account, openingBalance, rows, totalDr, totalCr, closingBalance } = data;

  const lines: string[] = [
    csvRow([`General Ledger — ${account.name}`]),
    csvRow([`Account: ${account.code} (${account.type})`]),
    csvRow([`Period: ${from} to ${to}`]),
    "",
    csvRow(["Type", "Ref No", "Date", "Description", "Cheque No", "Dr (Rs.)", "Cr (Rs.)", "Balance (Rs.)"]),
    csvRow([
      "Opening Balance",
      "—",
      fmtDate(`${from}T00:00:00`),
      "—",
      "—",
      openingBalance >= 0 ? fmt(openingBalance) : "",
      openingBalance < 0 ? fmt(Math.abs(openingBalance)) : "",
      balanceSide(openingBalance),
    ]),
    ...rows.map((r) =>
      csvRow([
        r.typeLabel,
        r.refNo ?? "—",
        fmtDate(r.date),
        r.description ?? "—",
        r.chequeNo ?? "—",
        r.drAmount > 0 ? fmt(r.drAmount) : "",
        r.crAmount > 0 ? fmt(r.crAmount) : "",
        balanceSide(r.balance),
      ])
    ),
    csvRow(["TOTALS", "", "", "", "", fmt(totalDr), fmt(totalCr), balanceSide(closingBalance)]),
  ];

  // UTF-8 BOM ensures Excel opens with correct encoding
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Ledger-${account.code}-${from}-${to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
