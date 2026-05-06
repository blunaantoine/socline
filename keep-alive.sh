#!/bin/bash
# Script keep-alive pour maintenir le serveur actif

while true; do
    # Vérifier si le serveur tourne
    if ! pgrep -f "next dev" > /dev/null; then
        echo "[$(date)] Serveur arrêté, redémarrage..." >> /home/z/my-project/keep-alive.log
        cd /home/z/my-project
        bun --bun next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
        sleep 3
    fi
    sleep 2
done
