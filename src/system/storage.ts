type Area = 'local' | 'session';

// Resolved inside the try on every call: merely reading window.localStorage can throw (privacy modes, blocked site data).
function store(area: Area): Storage {
  return area === 'local' ? window.localStorage : window.sessionStorage;
}

export const safeStorage = {
  get<T>(area: Area, key: string, fallback: T): T {
    try {
      const raw = store(area).getItem(key);
      if (raw === null) return fallback;
      const parsed: T | null = JSON.parse(raw);
      return parsed === null ? fallback : parsed;
    } catch {
      return fallback;
    }
  },

  set(area: Area, key: string, value: unknown): void {
    try {
      store(area).setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full: the app keeps working without persistence.
    }
  },

  remove(area: Area, key: string): void {
    try {
      store(area).removeItem(key);
    } catch {
      // Storage unavailable: nothing to remove.
    }
  },
};

export const KEYS = {
  settings: 'bymaxos.settings',
  unlocked: 'bymaxos.unlocked',
  windows: 'bymaxos.windows',
  icons: 'bymaxos.icons',
  github: 'bymaxos.github',
} as const;
