#!/bin/sh
# Two processes in one container: the Python background-removal model
# (tools/bg-server.py, localhost only) and the app itself. Node is exec'd
# last so it owns PID 1 and Cloud Run's health checks track it — the
# sidecar is lazy and idle until the first sticker request.
set -e

python3 /app/tools/bg-server.py &

exec node server.js
