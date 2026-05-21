#!/usr/bin/env bash
set -euo pipefail

# Stop local bootstrap servers by port.
for port in 3005 5175; do
  pids=$(lsof -ti tcp:"$port" || true)
  if [[ -n "${pids}" ]]; then
    echo "Stopping processes on port ${port}: ${pids}"
    kill ${pids} || true
  fi
done

echo "Done."
