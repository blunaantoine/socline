#!/bin/bash
# Script to start and keep the Next.js server running

LOG_FILE="/home/z/my-project/dev.log"
PID_FILE="/home/z/my-project/server.pid"

cd /home/z/my-project

# Kill existing server
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    kill $OLD_PID 2>/dev/null
    rm -f "$PID_FILE"
fi

pkill -f "next dev" 2>/dev/null
sleep 2

# Start server
echo "Starting Next.js server..." > "$LOG_FILE"
bun --bun next dev -p 3000 >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID
echo $SERVER_PID > "$PID_FILE"

echo "Server started with PID: $SERVER_PID"
