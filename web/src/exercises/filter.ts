/** Items whose name contains `query` (trimmed, case-insensitive). A blank query keeps everything. */
export function filterByName<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  return q ? items.filter((i) => i.name.toLocaleLowerCase().includes(q)) : [...items];
}
