import { CASCADE, MIN_VISIBLE, TITLE_BAR_H } from './layout';
import type { AppId, Rect, Size, WindowSpec, WindowState, WMState } from './types';

export const emptyWM: WMState = {
  windows: [],
  focusedId: null,
  nextZ: 1,
  seq: 0,
  lastRectByApp: {},
};

// Size limits apply first (min, then max against the area), then the position limits.
export function clampRect(r: Rect, area: Rect, minSize?: Size): Rect {
  const minW = minSize ? Math.max(r.w, minSize.w) : r.w;
  const minH = minSize ? Math.max(r.h, minSize.h) : r.h;
  const w = Math.min(minW, area.w);
  const h = Math.min(minH, area.h);
  const x = Math.min(Math.max(r.x, area.x - (w - MIN_VISIBLE)), area.x + area.w - MIN_VISIBLE);
  // The title bar never goes above the work area, even when the area is shorter than the bar.
  const y = Math.min(Math.max(r.y, area.y), Math.max(area.y, area.y + area.h - TITLE_BAR_H));
  return { x, y, w, h };
}

function find(s: WMState, id: string): WindowState | undefined {
  return s.windows.find((w) => w.id === id);
}

function patch(s: WMState, id: string, fn: (w: WindowState) => WindowState): WMState {
  return { ...s, windows: s.windows.map((w) => (w.id === id ? fn(w) : w)) };
}

function topVisibleId(windows: WindowState[]): string | null {
  let best: WindowState | undefined;
  for (const w of windows) {
    if (w.mode !== 'minimized' && (!best || w.z > best.z)) best = w;
  }
  return best?.id ?? null;
}

// A minimized window that restores maximized must track the area too, or it returns at the old size.
function isMaximized(w: WindowState): boolean {
  return w.mode === 'maximized' || (w.mode === 'minimized' && w.restoreTo === 'maximized');
}

function lastRectOf(w: WindowState): Rect {
  return isMaximized(w) ? (w.prevRect ?? w.rect) : w.rect;
}

function removeWindows(s: WMState, gone: WindowState[]): WMState {
  const ids = new Set(gone.map((w) => w.id));
  const windows = s.windows.filter((w) => !ids.has(w.id));
  const lastRectByApp = { ...s.lastRectByApp };
  for (const w of gone) lastRectByApp[w.appId] = lastRectOf(w);
  const focusedId =
    s.focusedId !== null && ids.has(s.focusedId) ? topVisibleId(windows) : s.focusedId;
  return { ...s, windows, lastRectByApp, focusedId };
}

export function openWindow(
  s: WMState,
  spec: WindowSpec,
  area: Rect,
  props?: Record<string, unknown>,
): WMState {
  if (spec.singleInstance) {
    const existing = topWindowOfApp(s, spec.appId, true);
    if (existing) {
      const shown = restoreWindow(s, existing.id);
      return props
        ? patch(shown, existing.id, (w) => ({ ...w, props: { ...w.props, ...props } }))
        : shown;
    }
  }

  const { w, h } = spec.defaultSize;
  const previous = s.windows[s.windows.length - 1];
  const savedRect = s.lastRectByApp[spec.appId];
  const hasAppWindow = s.windows.some((win) => win.appId === spec.appId);

  let rect: Rect;
  if (!hasAppWindow && savedRect) {
    rect = savedRect;
  } else if (previous) {
    const x = previous.rect.x + CASCADE;
    const y = previous.rect.y + CASCADE;
    const overflows = x + w > area.x + area.w || y + h > area.y + area.h;
    rect = overflows
      ? { x: area.x + CASCADE, y: area.y + CASCADE, w, h }
      : { x, y, w, h };
  } else {
    rect = {
      x: area.x + Math.round((area.w - w) / 2),
      y: area.y + Math.round((area.h - h) / 2),
      w,
      h,
    };
  }

  const id = `w${s.seq + 1}`;
  const win: WindowState = {
    id,
    appId: spec.appId,
    title: spec.title,
    rect: clampRect(rect, area, spec.minSize),
    mode: 'normal',
    z: s.nextZ,
    props,
  };
  return {
    ...s,
    windows: [...s.windows, win],
    focusedId: id,
    nextZ: s.nextZ + 1,
    seq: s.seq + 1,
  };
}

export function focusWindow(s: WMState, id: string): WMState {
  const w = find(s, id);
  if (!w || w.mode === 'minimized' || s.focusedId === id) return s;
  return {
    ...patch(s, id, (win) => ({ ...win, z: s.nextZ })),
    focusedId: id,
    nextZ: s.nextZ + 1,
  };
}

export function closeWindow(s: WMState, id: string): WMState {
  const w = find(s, id);
  return w ? removeWindows(s, [w]) : s;
}

export function closeApp(s: WMState, appId: AppId): WMState {
  const gone = s.windows.filter((w) => w.appId === appId);
  return gone.length > 0 ? removeWindows(s, gone) : s;
}

export function minimizeWindow(s: WMState, id: string): WMState {
  const w = find(s, id);
  if (!w || w.mode === 'minimized') return s;
  const hidden = patch(s, id, (win) => ({
    ...win,
    mode: 'minimized',
    restoreTo: win.mode === 'maximized' ? 'maximized' : 'normal',
  }));
  return s.focusedId === id ? { ...hidden, focusedId: topVisibleId(hidden.windows) } : hidden;
}

export function restoreWindow(s: WMState, id: string): WMState {
  const w = find(s, id);
  if (!w) return s;
  const shown =
    w.mode === 'minimized'
      ? patch(s, id, (win) => ({ ...win, mode: win.restoreTo ?? 'normal', restoreTo: undefined }))
      : s;
  return focusWindow(shown, id);
}

export function toggleMaximize(s: WMState, id: string, area: Rect): WMState {
  const w = find(s, id);
  if (!w || w.mode === 'minimized') return s;
  if (w.mode === 'maximized') {
    return patch(s, id, (win) => ({
      ...win,
      rect: win.prevRect ?? win.rect,
      prevRect: undefined,
      mode: 'normal',
    }));
  }
  return patch(s, id, (win) => ({ ...win, prevRect: win.rect, rect: area, mode: 'maximized' }));
}

// Only normal windows take manual placement; maximized and minimized windows ignore it.
export function moveWindow(s: WMState, id: string, x: number, y: number, area: Rect): WMState {
  const w = find(s, id);
  if (!w || w.mode !== 'normal') return s;
  return patch(s, id, (win) => ({
    ...win,
    rect: clampRect({ x, y, w: win.rect.w, h: win.rect.h }, area),
  }));
}

export function setWindowRect(
  s: WMState,
  id: string,
  rect: Rect,
  minSize: Size,
  area: Rect,
): WMState {
  const w = find(s, id);
  if (!w || w.mode !== 'normal') return s;
  return patch(s, id, (win) => ({ ...win, rect: clampRect(rect, area, minSize) }));
}

export function setWindowTitle(s: WMState, id: string, title: string): WMState {
  return find(s, id) ? patch(s, id, (win) => ({ ...win, title })) : s;
}

export function clampAll(s: WMState, area: Rect): WMState {
  return {
    ...s,
    windows: s.windows.map((w) => ({
      ...w,
      rect: isMaximized(w) ? area : clampRect(w.rect, area),
      prevRect: w.prevRect && clampRect(w.prevRect, area),
    })),
  };
}

export function activeAppId(s: WMState): AppId {
  const focused = s.focusedId === null ? undefined : find(s, s.focusedId);
  return focused?.appId ?? 'finder';
}

// Visible windows of the app move above every other window; the rest keep their relative order.
export function raiseAppWindows(s: WMState, appId: AppId): WMState {
  const byZ = (a: WindowState, b: WindowState) => a.z - b.z;
  const raised = s.windows
    .filter((w) => w.appId === appId && w.mode !== 'minimized')
    .sort(byZ);
  const raisedIds = new Set(raised.map((w) => w.id));
  const order = [...s.windows.filter((w) => !raisedIds.has(w.id)).sort(byZ), ...raised];
  const zById = new Map(order.map((w, i) => [w.id, i + 1]));
  return {
    ...s,
    windows: s.windows.map((w) => ({ ...w, z: zById.get(w.id) ?? w.z })),
    nextZ: order.length + 1,
  };
}

export function topWindowOfApp(
  s: WMState,
  appId: AppId,
  includeMinimized = false,
): WindowState | undefined {
  let best: WindowState | undefined;
  for (const w of s.windows) {
    const eligible = w.appId === appId && (includeMinimized || w.mode !== 'minimized');
    if (eligible && (!best || w.z > best.z)) best = w;
  }
  return best;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isRect(v: unknown): v is Rect {
  if (!isPlainObject(v)) return false;
  const finite = ['x', 'y', 'w', 'h'].every(
    (k) => typeof v[k] === 'number' && Number.isFinite(v[k]),
  );
  return finite && (v.w as number) > 0 && (v.h as number) > 0;
}

// Object.fromEntries defines own properties, so a stored "__proto__" key stays inert.
export function hydrate(saved: unknown, area: Rect): Pick<WMState, 'lastRectByApp'> {
  if (!isPlainObject(saved)) return { lastRectByApp: {} };
  const entries: [AppId, Rect][] = [];
  for (const [appId, value] of Object.entries(saved)) {
    if (isRect(value)) entries.push([appId, clampRect(value, area)]);
  }
  return { lastRectByApp: Object.fromEntries(entries) };
}
