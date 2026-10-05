/** Rows rendered per page in long lists. */
export const ROW_PAGE = 150;

/**
 * How many rows of a group to render: `pages + 1` pages, extended so the selected item (when it is in the group)
 * is always rendered.
 */
export function rowLimit(
  group: { id: string }[],
  pages: number,
  selectedId: string | null,
  pageSize = ROW_PAGE,
): number {
  const limit = pageSize * (pages + 1);
  if (group.length <= limit || !selectedId) return limit;
  const selected = group.findIndex((item) => item.id === selectedId);
  return selected >= limit ? selected + 1 : limit;
}
