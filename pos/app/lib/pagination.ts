export function getPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const safePage = Math.min(Math.max(1, page), getPageCount(rows.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
