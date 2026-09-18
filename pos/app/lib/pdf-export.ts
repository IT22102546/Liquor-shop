type PdfColumn<T> = {
  header: string;
  value: (row: T, index: number) => string | number | null | undefined;
};

type PdfExportOptions<T> = {
  fileName: string;
  title: string;
  subtitle?: string;
  columns: PdfColumn<T>[];
  rows: T[];
};

type PrimitiveCell = string | number | null | undefined;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCell(value: PrimitiveCell) {
  if (value == null) return "-";
  return String(value);
}

function safeCellValue<T>(column: PdfColumn<T>, row: T, rowIndex: number): PrimitiveCell {
  try {
    return column.value(row, rowIndex);
  } catch {
    return "-";
  }
}

export function exportTableToPdf<T>(options: PdfExportOptions<T>) {
  if (typeof window === "undefined") return;

  const { title, subtitle, rows, columns, fileName } = options;
  const reportGeneratedAt = new Date().toLocaleString();

  const headerHtml = columns
    .map((column) => `<th>${escapeHtml(column.header)}</th>`)
    .join("");

  const bodyHtml = rows
    .map((row, rowIndex) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(formatCell(safeCellValue(column, row, rowIndex)))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(fileName)}</title>
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #1f2937;
      }
      .wrap {
        width: 100%;
      }
      h1 {
        margin: 0;
        font-size: 20px;
        color: #111827;
      }
      .subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: #4b5563;
      }
      .meta {
        margin-top: 6px;
        margin-bottom: 12px;
        font-size: 11px;
        color: #6b7280;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
      }
      thead th {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        padding: 6px 8px;
        font-size: 11px;
        text-align: left;
        white-space: nowrap;
      }
      tbody td {
        border: 1px solid #e5e7eb;
        padding: 6px 8px;
        font-size: 10px;
        vertical-align: top;
        word-break: break-word;
      }
      tbody tr:nth-child(even) td {
        background: #fafafa;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
      <div class="meta">Generated: ${escapeHtml(reportGeneratedAt)} | Rows: ${rows.length}</div>
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  </body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      window.alert("Failed to open print view. Please try again.");
      return;
    }

    const runPrint = () => {
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    };

    // Ensure the iframe document has painted before printing.
    frameWindow.requestAnimationFrame(() => {
      window.setTimeout(runPrint, 120);
    });
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
}

/**
 * Export invoice HTML to a downloadable PDF via browser's print-to-file capability.
 * Uses iframe + srcdoc to isolate the invoice from page chrome.
 */
export function exportInvoiceToPdf(invoiceHtml: string, invoiceNumber: string) {
  if (typeof window === "undefined") return;

  const generatedAt = new Date().toLocaleString();

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${invoiceNumber}</title>
    <style>
      @page { 
        size: A4 portrait; 
        margin: 10mm;
        /* Suppress browser headers/footers */
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #111;
        background: #fff;
      }
      @media print {
        body {
          background: #fff;
          margin: 0;
          padding: 0;
        }
        .invoice-container {
          box-shadow: none;
          border: none;
          margin: 0;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      ${invoiceHtml}
    </div>
  </body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      window.alert("Failed to prepare invoice for download. Please try again.");
      return;
    }

    const runPrint = () => {
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    };

    frameWindow.requestAnimationFrame(() => {
      window.setTimeout(runPrint, 120);
    });
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
}
