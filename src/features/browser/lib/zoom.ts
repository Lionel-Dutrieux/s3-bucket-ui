// Pure zoom/pan math for the image viewer. State is a CSS transform:
// translate(x, y) scale(scale), with (x, y) in screen pixels relative to the
// centered, fit-to-container image.

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
export const INITIAL_ZOOM: ZoomState = { scale: 1, x: 0, y: 0 };

export function clampScale(scale: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
}

/**
 * Multiplies the scale by `factor`, keeping the point under the cursor
 * (cx, cy — screen coords in the same space as x/y) visually fixed.
 * Landing back on scale 1 recenters — a fully zoomed-out image is never
 * left panned off-center.
 */
export function zoomAt(
  state: ZoomState,
  cx: number,
  cy: number,
  factor: number,
): ZoomState {
  const scale = clampScale(state.scale * factor);
  if (scale === ZOOM_MIN) return INITIAL_ZOOM;
  const ratio = scale / state.scale;
  return {
    scale,
    x: cx - (cx - state.x) * ratio,
    y: cy - (cy - state.y) * ratio,
  };
}

/** Drag by (dx, dy). At scale 1 there is nothing to pan. */
export function pan(state: ZoomState, dx: number, dy: number): ZoomState {
  if (state.scale === ZOOM_MIN) return state;
  return { ...state, x: state.x + dx, y: state.y + dy };
}
