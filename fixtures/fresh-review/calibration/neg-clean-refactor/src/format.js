const UNITS = [
  { limit: 1024, divisor: 1, suffix: 'B', digits: 0 },
  { limit: 1024 * 1024, divisor: 1024, suffix: 'KB', digits: 1 },
  { limit: Infinity, divisor: 1024 * 1024, suffix: 'MB', digits: 1 },
];

function pickUnit(bytes) {
  return UNITS.find((unit) => bytes < unit.limit);
}

export function formatBytes(bytes) {
  const { divisor, suffix, digits } = pickUnit(bytes);
  return `${(bytes / divisor).toFixed(digits)} ${suffix}`;
}
