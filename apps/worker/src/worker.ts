import type { WorkerHeartbeatEvent } from '@ghs/types';

const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || 30000);

function nowIso(): string {
  return new Date().toISOString();
}

function buildEvent(event: WorkerHeartbeatEvent['event'], signal?: NodeJS.Signals): WorkerHeartbeatEvent {
  return {
    service: 'ghs-worker',
    event,
    timestamp: nowIso(),
    intervalMs,
    signal,
  };
}

console.log(`[ghs-worker] ${JSON.stringify(buildEvent('started'))}`);

const timer = setInterval(() => {
  console.log(`[ghs-worker] ${JSON.stringify(buildEvent('heartbeat'))}`);
}, intervalMs);

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[ghs-worker] ${JSON.stringify(buildEvent('shutdown', signal))}`);
  clearInterval(timer);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
