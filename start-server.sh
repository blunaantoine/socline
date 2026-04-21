#!/bin/bash
# Script de démarrage persistant pour Socline
# Usage: ./start-server.sh

cd /home/z/my-project
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Démarrage du serveur Socline..." >> dev.log
nohup node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 &
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Serveur démarré sur le port 3000" >> dev.log
