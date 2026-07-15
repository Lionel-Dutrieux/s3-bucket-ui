import { describe, expect, it } from "vitest";
import {
  clampScale,
  INITIAL_ZOOM,
  pan,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomAt,
} from "./zoom";

describe("zoom", () => {
  it("clamps the scale to [min, max]", () => {
    expect(clampScale(0.1)).toBe(ZOOM_MIN);
    expect(clampScale(100)).toBe(ZOOM_MAX);
    expect(clampScale(2)).toBe(2);
  });

  it("zooming at the origin keeps the origin fixed", () => {
    const zoomed = zoomAt(INITIAL_ZOOM, 0, 0, 2);
    expect(zoomed).toEqual({ scale: 2, x: 0, y: 0 });
  });

  it("keeps the cursor point visually fixed while zooming", () => {
    // The image point under the cursor (screen coords c) is
    // p = (c - offset) / scale — it must not move after the zoom.
    const state = { scale: 2, x: 10, y: -20 };
    const cx = 100;
    const cy = 50;
    const before = {
      px: (cx - state.x) / state.scale,
      py: (cy - state.y) / state.scale,
    };
    const zoomed = zoomAt(state, cx, cy, 1.5);
    const after = {
      px: (cx - zoomed.x) / zoomed.scale,
      py: (cy - zoomed.y) / zoomed.scale,
    };
    expect(after.px).toBeCloseTo(before.px);
    expect(after.py).toBeCloseTo(before.py);
  });

  it("zooming out below 1 resets the offset", () => {
    const state = { scale: 1.2, x: 40, y: 40 };
    const zoomed = zoomAt(state, 0, 0, 0.5);
    expect(zoomed).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("pan shifts the offset, but is a no-op at scale 1", () => {
    expect(pan({ scale: 2, x: 0, y: 0 }, 5, -3)).toEqual({
      scale: 2,
      x: 5,
      y: -3,
    });
    expect(pan(INITIAL_ZOOM, 5, -3)).toBe(INITIAL_ZOOM);
  });
});
