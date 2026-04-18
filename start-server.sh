#!/bin/bash
cd /home/z/my-project
while true; do
    echo "Starting Socline server..."
    bun run dev
    echo "Server stopped, restarting in 3 seconds..."
    sleep 3
done
