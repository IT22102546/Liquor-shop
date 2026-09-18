"use client";

import { getPageCount } from "../lib/pagination";
export { getPageCount, paginateRows } from "../lib/pagination";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export default function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const pageCount = getPageCount(total, pageSize);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--panel-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-soft)", fontSize: "0.85rem" }}>
        Rows per page
        <select
          className="bm-select"
          style={{ width: "auto", padding: "0.3rem 0.55rem" }}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
        <span style={{ color: "var(--text-soft)" }}>{from}–{to} of {total}</span>
        <button type="button" className="btn-outline" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>‹ Prev</button>
        <span style={{ color: "var(--text-soft)" }}>Page {safePage} of {pageCount}</span>
        <button type="button" className="btn-outline" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>Next ›</button>
      </div>
    </div>
  );
}
