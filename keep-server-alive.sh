#!/bin/bash
while true; do
    if ! pgrep -f "next dev" > /dev/null; then
        cd /home/z/my-project
        bun --bun next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
        sleep 5
    fi
    sleep 3
done
