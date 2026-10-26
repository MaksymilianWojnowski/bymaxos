import type { Rect } from './types';

export const MENU_BAR_H = 24;
export const TITLE_BAR_H = 28;
export const DOCK_RESERVE = 84;
export const CASCADE = 24;
export const MIN_VISIBLE = 80;

export function getWorkArea(vw: number, vh: number): Rect {
  return { x: 0, y: MENU_BAR_H, w: vw, h: Math.max(0, vh - MENU_BAR_H - DOCK_RESERVE) };
}
