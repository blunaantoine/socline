#!/bin/bash
# =====================================================================
#  nginx-watchdog — auto-réparation de nginx
#  Installé suite à l'incident du 11/10/2026 (certificat maison-khan
#  manquant -> nginx -t en échec -> TOUTES les apps du VPS tombées).
#
#  Rôle (cron toutes les minutes) :
#    - si nginx tourne          : ne rien faire
#    - si nginx est tombé       : tester la config ;
#        * config valide  -> redémarrer nginx
#        * config cassée  -> mettre le fichier fautif en quarantaine
#                            (/etc/nginx/quarantine) puis retester
#                            (10 fichiers max par passage)
#
#  Pause volontaire (maintenance) : sudo touch /etc/nginx/watchdog-pause
#  Réactiver                    : sudo rm /etc/nginx/watchdog-pause
#  Journal : /var/log/nginx-watchdog.log
# =====================================================================
LOG=/var/log/nginx-watchdog.log
Q=/etc/nginx/quarantine
stamp() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# Pause volontaire : on n'intervient pas
[ -f /etc/nginx/watchdog-pause ] && exit 0

# nginx tourne ? rien à faire
if systemctl is-active --quiet nginx; then
  exit 0
fi

stamp "ALERTE : nginx est tombé - tentative de réparation automatique"
mkdir -p "$Q"

for i in 1 2 3 4 5 6 7 8 9 10; do
  # Config valide -> simple redémarrage
  if /usr/sbin/nginx -t >/dev/null 2>&1; then
    stamp "Config valide - redémarrage de nginx (après $i test(s))"
    systemctl restart nginx
    if systemctl is-active --quiet nginx; then
      stamp "SUCCÈS : nginx est de nouveau en ligne"
    else
      stamp "ÉCHEC : config valide mais nginx ne démarre pas (voir journalctl -u nginx)"
    fi
    exit 0
  fi

  ERR=$(/usr/sbin/nginx -t 2>&1)

  # Cas 1 : erreur de syntaxe/directive -> le fichier fautif est cité
  #   ex: nginx: [emerg] unknown directive "x" in /etc/nginx/sites-enabled/foo:3
  BAD=$(echo "$ERR" | grep -oE '/etc/nginx/sites-enabled/[^ :"]+' | head -n1)

  # Cas 2 : certificat manquant -> retrouver la config qui le référence
  #   ex: nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/..."
  if [ -z "$BAD" ] && echo "$ERR" | grep -q 'cannot load certificate'; then
    CERT=$(echo "$ERR" | grep -oE '/etc/letsencrypt/live/[^/"]+/' | head -n1)
    if [ -n "$CERT" ]; then
      BAD=$(grep -rl "$CERT" /etc/nginx/sites-enabled/ 2>/dev/null | head -n1)
    fi
  fi

  # Sécurité : ne jamais toucher nginx.conf ni un chemin non identifié
  if [ -z "$BAD" ] || [ "$BAD" = "/etc/nginx/nginx.conf" ]; then
    stamp "Fichier fautif non identifié - intervention manuelle requise. Erreur: $(echo "$ERR" | head -n2 | tr '\n' ' ')"
    exit 1
  fi

  if mv "$BAD" "$Q/" 2>/dev/null; then
    stamp "Mis en quarantaine : $BAD"
  else
    stamp "Échec de mise en quarantaine : $BAD - intervention manuelle requise"
    exit 1
  fi
done

stamp "Trop de fichiers fautifs (10) - intervention manuelle requise"
