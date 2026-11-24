#!/usr/bin/env bash
set -eu
# HAMLET owns the Hub, machine runners, and per-session MCP registration.
exec node "$(dirname "$0")/../bin/hamlet.js" start
