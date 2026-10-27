import type { Rect } from './types';

// Grid of near-square cells; each window scales down (never up) to fit its cell and is centred in it.
export function missionLayout(
  items: { id: string; w: number; h: number }[],
  area: Rect,
  gap = 32,
): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  const n = items.length;
  if (n === 0) return out;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = (area.w - gap * (cols + 1)) / cols;
  const cellH = (area.h - gap * (rows + 1)) / rows;
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const scale = Math.max(0, Math.min(1, cellW / item.w, cellH / item.h));
    const w = item.w * scale;
    const h = item.h * scale;
    const cellX = area.x + gap + col * (cellW + gap);
    const cellY = area.y + gap + row * (cellH + gap);
    out[item.id] = {
      x: cellX + (cellW - w) / 2,
      y: cellY + (cellH - h) / 2,
      w,
      h,
    };
  });
  return out;
}
