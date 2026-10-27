// Weeks start on Sunday; every row has 7 cells and null pads the first and last rows.
export function monthGrid(year: number, month: number): (number | null)[][] {
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(new Date(year, month, 1).getDay()).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  while (cells.length % 7) cells.push(null)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}
