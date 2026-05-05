#!/usr/bin/env bash
# Start the PeakPick ML backend server.
set -euo pipefail

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Start uvicorn on port 7878
echo "Starting PeakPick ML backend on 0.0.0.0:7878..."
exec uvicorn peakpick_ml.server:app --host 0.0.0.0 --port 7878
