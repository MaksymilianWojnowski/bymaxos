export type Appearance = 'light' | 'dark' | 'auto';
export type Accent = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'graphite';
export const ACCENTS: Accent[] = ['blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'graphite'];

export interface Settings {
  appearance: Appearance;
  accent: Accent;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  wallpaperId: string;
  dockMagnification: boolean;
  dockSize: number; // px, 40–72
}

export function defaultSettings(env: { prefersReducedMotion: boolean }): Settings {
  return {
    appearance: 'auto',
    accent: 'blue',
    reduceMotion: env.prefersReducedMotion,
    reduceTransparency: false,
    wallpaperId: 'default',
    dockMagnification: true,
    dockSize: 52,
  };
}

export function applyAppearance(
  s: Settings,
  prefersDark: boolean,
  root: HTMLElement = document.documentElement,
): void {
  const dark = s.appearance === 'dark' || (s.appearance === 'auto' && prefersDark);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = s.accent;
  root.classList.toggle('reduce-motion', s.reduceMotion);
  root.classList.toggle('reduce-transparency', s.reduceTransparency);
}
