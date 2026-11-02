export type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export interface FocusItem {
  id: string;
  row: number;
  col: number;
}

export function moveFocus(items: FocusItem[], currentId: string, direction: Direction): string {
  const current = items.find((item) => item.id === currentId) ?? items[0];
  if (!current) return currentId;
  if (direction === 'ArrowLeft' || direction === 'ArrowRight') {
    const delta = direction === 'ArrowRight' ? 1 : -1;
    const sameRow = items.filter((item) => item.row === current.row).sort((a, b) => a.col - b.col);
    const index = sameRow.findIndex((item) => item.id === current.id);
    return sameRow[index + delta]?.id ?? current.id;
  }
  const delta = direction === 'ArrowDown' ? 1 : -1;
  const rows = [...new Set(items.map((item) => item.row))].sort((a, b) => a - b);
  const nextRow = rows[rows.indexOf(current.row) + delta];
  if (nextRow === undefined) return current.id;
  const candidates = items
    .filter((item) => item.row === nextRow)
    .sort((a, b) => Math.abs(a.col - current.col) - Math.abs(b.col - current.col) || a.col - b.col);
  return candidates[0]?.id ?? current.id;
}

export function restoreFocus(previousId: string | null, items: FocusItem[]): string {
  if (previousId && items.some((item) => item.id === previousId)) return previousId;
  return items[0]?.id ?? '';
}
