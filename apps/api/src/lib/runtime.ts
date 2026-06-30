const startedAtMs = Date.now();

export function getApiStartedAtMs(): number {
  return startedAtMs;
}

export function getApiUptimeSeconds(): number {
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}
