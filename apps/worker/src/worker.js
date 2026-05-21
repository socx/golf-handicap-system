const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || 30000);

function nowIso() {
  return new Date().toISOString();
}

console.log(`[ghs-worker] started at ${nowIso()} (interval ${intervalMs}ms)`);

const timer = setInterval(() => {
  console.log(`[ghs-worker] heartbeat ${nowIso()}`);
}, intervalMs);

function shutdown(signal) {
  console.log(`[ghs-worker] received ${signal}, shutting down`);
  clearInterval(timer);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));