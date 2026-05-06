#!/bin/bash
# Script pour démarrer et maintenir le serveur de développement
cd /home/z/my-project

# Tuer les anciens processus
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun" 2>/dev/null || true
sleep 2

# Démarrer le serveur avec bun --hot pour auto-restart
echo "Démarrage du serveur Next.js..." > /home/z/my-project/dev.log
exec bun --bun next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
