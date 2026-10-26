export type AppId = string;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export type WindowMode = 'normal' | 'minimized' | 'maximized';

export interface WindowState {
  id: string;
  appId: AppId;
  title: string;
  rect: Rect;
  mode: WindowMode;
  prevRect?: Rect;
  restoreTo?: 'normal' | 'maximized';
  z: number;
  props?: Record<string, unknown>;
}

export interface WMState {
  windows: WindowState[];
  focusedId: string | null;
  nextZ: number;
  seq: number;
  lastRectByApp: Record<AppId, Rect>;
}

export interface WindowSpec {
  appId: AppId;
  title: string;
  defaultSize: Size;
  minSize: Size;
  singleInstance: boolean;
}
