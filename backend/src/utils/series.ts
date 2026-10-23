/** Fills missing days (UTC) so charts always get a continuous series. */
export function fillDays(data: { d: string; n: number }[], days = 30): { date: string; count: number }[] {
  const map = new Map(data.map((r) => [r.d, Number(r.n)]));
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = dt.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

/** Neutralises spreadsheet formula injection and quotes a CSV cell. */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
