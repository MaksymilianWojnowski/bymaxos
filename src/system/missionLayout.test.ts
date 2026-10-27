import { describe, expect, it } from 'vitest';
import { missionLayout } from './missionLayout';

const area = { x: 0, y: 0, w: 1200, h: 800 };

describe('missionLayout', () => {
  it('centres a single window at scale 1 when it fits', () => {
    expect(missionLayout([{ id: 'a', w: 800, h: 600 }], area)).toEqual({
      a: { x: 200, y: 100, w: 800, h: 600 },
    });
  });

  it('fits four windows into a 2x2 grid', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, w: 1000, h: 800 }));
    const rects = missionLayout(items, area);
    expect(rects.a).toEqual({ x: 88, y: 32, w: 440, h: 352 });
    expect(rects.b.x).toBe(672);
    expect(rects.c.y).toBe(416);
  });

  it('never scales up', () => {
    const rects = missionLayout([{ id: 'a', w: 300, h: 200 }], area);
    expect(rects.a.w).toBe(300);
    expect(rects.a.h).toBe(200);
  });

  it('returns an empty map for no windows', () => {
    expect(missionLayout([], area)).toEqual({});
  });

  it('respects area offsets', () => {
    const base = missionLayout([{ id: 'a', w: 800, h: 600 }], area);
    const shifted = missionLayout([{ id: 'a', w: 800, h: 600 }], { ...area, y: 24 });
    expect(shifted.a.y).toBe(base.a.y + 24);
  });
});
