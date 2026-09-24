const MAX_WINDOW_MS = 12 * 60 * 60 * 1000;

export function clampWindow(startMs, endMs) {
  const span = endMs - startMs;
  return span > MAX_WINDOW_MS ? endMs - MAX_WINDOW_MS : startMs;
}
