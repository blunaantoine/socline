#!/usr/bin/env bash
# ============================================================
# Socline — Déploiement VPS automatique (port public 3002)
# ============================================================
# Usage :
#   sudo bash deploy/deploy.sh               # installation complète (nginx sur 3002)
#   sudo bash deploy/deploy.sh --no-nginx    # sans nginx (Next.js direct sur 3002, temps réel dégradé)
#   sudo bash deploy/deploy.sh --update      # mise à jour : git pull + rebuild + restart
#   sudo bash deploy/deploy.sh --web-port 3100   # port interne personnalisé (défaut : 3000)
#
# Architecture (par défaut) :
#   Internet ──> nginx :3002 ──> Next.js :3000 (interne, 3100-3600 si occupé)
#                          ├──> chat-service :3003 (interne, ?XTransformPort=3003)
#                          └──> washgo-socket :3005 (interne, ?XTransformPort=3005)
#
set -euo pipefail

# ------------------------------------------------------------
# AUTO-RELANCE DEPUIS UNE COPIE STABLE :
# ce script fait un « git reset --hard » sur son PROPRE dépôt pendant son
# exécution. bash, qui a déjà lu le fichier en mémoire, continuerait alors
# avec l'ANCIENNE version (c'est exactement ce qui a rejoué une ancienne
# logique et causé un 502 : nouveau port nginx, ancien processus jamais
# redémarré). On copie donc le script HORS du dépôt et on exécute la copie.
# ------------------------------------------------------------
if [[ "${SOCLINE_DEPLOY_RUNNING:-}" != "1" ]]; then
  CP_DEST="/tmp/.socline-deploy-$$.sh"
  cp "$0" "${CP_DEST}"
  export SOCLINE_DEPLOY_RUNNING=1
  exec bash "${CP_DEST}" "$@"
fi

APP_DIR="${APP_DIR:-/opt/socline}"
REPO_URL="${REPO_URL:-https://github.com/blunaantoine/socline.git}"
PUBLIC_PORT=3002          # port public demandé
WEB_PORT="${WEB_PORT:-3000}"  # port interne Next.js (derrière nginx)
RUN_USER=socline          # utilisateur système dédié
NODE_MAJOR=22

NO_NGINX=false
UPDATE_ONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-nginx) NO_NGINX=true ;;
    --update)   UPDATE_ONLY=true ;;
    --web-port)
      [[ -n "${2:-}" && "${2}" =~ ^[0-9]+$ ]] || { echo "--web-port exige un numéro de port (ex : --web-port 3100)"; exit 1; }
      WEB_PORT="$2"; shift ;;
    *) echo "Option inconnue : $1 (attendu : --no-nginx | --update | --web-port N)"; exit 1 ;;
  esac
  shift
done

c_info()  { echo -e "\033[1;36m[SOCLINE]\033[0m $*"; }
c_ok()    { echo -e "\033[1;32m[OK]\033[0m $*"; }
c_warn()  { echo -e "\033[1;33m[!]\033[0m $*"; }
c_fail()  { echo -e "\033[1;31m[ERREUR]\033[0m $*"; exit 1; }

[[ $EUID -eq 0 ]] || c_fail "Ce script doit être lancé en root : sudo bash deploy/deploy.sh"

# ------------------------------------------------------------
# 1. Dépendances système (git, curl, node, bun, nginx)
# ------------------------------------------------------------
c_info "1/8 — Vérification des dépendances…"

if ! command -v git &>/dev/null || ! command -v curl &>/dev/null; then
  apt-get update -y && apt-get install -y git curl ca-certificates
fi

if ! command -v node &>/dev/null; then
  c_info "Installation de Node.js ${NODE_MAJOR}…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
c_ok "Node $(node --version)"

if ! command -v bun &>/dev/null; then
  c_info "Installation de Bun (requis pour les services socket)…"
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
  chmod +x /usr/local/bin/bun 2>/dev/null || true
fi
c_ok "Bun $(bun --version)"

NODE_PATH="$(command -v node)"
BUN_PATH="$(command -v bun)"

# « bunx » est parfois absent de l'installation officielle de Bun :
# on crée le lien manquant pour que `bunx …` fonctionne aussi en interactif
if ! command -v bunx &>/dev/null; then
  ln -sf "${BUN_PATH}" "$(dirname "${BUN_PATH}")/bunx"
fi

# ------------------------------------------------------------
# 2. Utilisateur système dédié
# ------------------------------------------------------------
c_info "2/8 — Utilisateur système « ${RUN_USER} »…"
if ! id -u "${RUN_USER}" &>/dev/null; then
  useradd -m -s /bin/bash "${RUN_USER}"
  c_ok "Utilisateur créé"
else
  c_ok "Utilisateur déjà présent"
fi

# ------------------------------------------------------------
# 3. Code source (clone ou mise à jour)
# ------------------------------------------------------------
c_info "3/8 — Récupération du code source…"
if [[ -d "${APP_DIR}/.git" ]]; then
  cd "${APP_DIR}"
  git config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true
  git fetch origin
  git reset --hard origin/main
else
  rm -rf "${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
  git config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true
fi
cd "${APP_DIR}"
# Si cette mise à jour a apporté une NOUVELLE version du script de
# déploiement, on relance la version à jour (on tourne sur une copie
# stable hors du dépôt : re-exec sans risque d'être remplacé en cours
# d'exécution — le git reset est déjà fait, le fichier ne bougera plus).
DEPLOY_SRC="${APP_DIR}/deploy/deploy.sh"
if [[ -f "${DEPLOY_SRC}" && "$(readlink -f "$0")" != "$(readlink -f "${DEPLOY_SRC}")" ]] \
   && ! cmp -s "$0" "${DEPLOY_SRC}"; then
  c_info "Nouvelle version du script de déploiement détectée — relance automatique…"
  exec bash "${DEPLOY_SRC}" "$@"
fi
c_ok "Code à jour dans ${APP_DIR}"

# ------------------------------------------------------------
# 4. Fichier .env (généré au premier lancement, conservé ensuite)
# ------------------------------------------------------------
c_info "4/8 — Configuration .env…"
if [[ -f "${APP_DIR}/.env" ]]; then
  c_ok ".env existant conservé (secrets intacts)"
else
  JWT_SECRET="$(openssl rand -hex 32)"
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
  INTERNAL_SOCKET_SECRET="$(openssl rand -hex 32)"
  cat > "${APP_DIR}/.env" <<EOF
# Socline — configuration production VPS (générée par deploy.sh)
DATABASE_URL="file:${APP_DIR}/db/custom.db"

# Secrets générés automatiquement — gardez ce fichier secret
JWT_SECRET="${JWT_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
INTERNAL_SOCKET_SECRET="${INTERNAL_SOCKET_SECRET}"

# --- SMS / OTP (Africa's Talking) : renseignez pour l'envoi réel ---
# SMS_PROVIDER=africastalking
# SMS_USERNAME=votre_username
# SMS_API_KEY=votre_cle_api
# SMS_SENDER_ID=SOCLINE
# En démo (sans provider), le code OTP est affiché dans l'app :
SMS_DEMO_FALLBACK="true"
OTP_CHANNEL=sms
EOF
  c_ok ".env généré avec des secrets aléatoires"
  c_warn "Pensez à renseigner les clés SMS dans ${APP_DIR}/.env (SMS_PROVIDER…) pour l'envoi réel des OTP."
fi

# ------------------------------------------------------------
# 5. Installation des dépendances + base de données + build
# ------------------------------------------------------------
c_info "5/8 — Installation des dépendances (bun install)…"
bun install

c_info "Installation des dépendances des services socket…"
(cd mini-services/chat-service && bun install)
(cd mini-services/washgo-socket && bun install)
c_ok "Dépendances installées"

c_info "Mise à jour du schéma de base de données (SQLite)…"
# le dossier db/ est ignoré par git : le créer AVANT le push Prisma (sinon SQLite échoue)
mkdir -p "${APP_DIR}/db"
# « bun x » est utilisé plutôt que « bunx » : fonctionne même quand le binaire bunx est absent
bun x prisma db push
c_ok "Base de données prête : ${APP_DIR}/db/custom.db"

c_info "6/8 — Build de production Next.js…"
if [[ "${NO_NGINX}" == "true" ]]; then
  # Sans reverse proxy, le temps réel socket.io ne peut pas être routé :
  # on construit l'app en mode polling (fallback déjà prévu dans le code).
  NEXT_PUBLIC_ENABLE_SOCKET=false bun run build
  WEB_PORT="${PUBLIC_PORT}"   # Next écoute directement le port public
else
  bun run build
fi

# Le serveur standalone Next charge aussi le .env de son propre dossier
cp "${APP_DIR}/.env" "${APP_DIR}/.next/standalone/.env"
c_ok "Build terminé"

# ------------------------------------------------------------
# Contrôle : le port interne doit être LIBRE — d'autres applications
# peuvent déjà tourner sur ce VPS (ex : quelque chose sur 3000).
# IMPORTANT : on ARRÊTE d'abord les services Socline. Sans cela,
# l'ancienne instance de l'app (encore active sur l'ancien port)
# était comptée comme « autre application » → bascule de port
# inutile → nginx resynchronisé vers le nouveau port alors que
# l'ancien processus tournait toujours → HTTP 502.
# Le port PUBLIC (3002) reste inchangé dans tous les cas.
# ------------------------------------------------------------
systemctl stop socline-web socline-chat socline-washgo 2>/dev/null || true

port_busy() { ss -tlnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${1}$"; }

if port_busy "${WEB_PORT}"; then
  c_warn "Le port interne ${WEB_PORT} est utilisé par une autre application du VPS."
  # 1) Stabilité : réutiliser le port interne déjà configuré dans l'unit
  #    systemd (s'il est libre) plutôt que changer de port à chaque déploiement.
  UNIT_PORT=""
  if [[ -f /etc/systemd/system/socline-web.service ]]; then
    UNIT_PORT="$(grep -oPm1 '^Environment=PORT=\K[0-9]+' /etc/systemd/system/socline-web.service || true)"
  fi
  if [[ -n "${UNIT_PORT}" && "${UNIT_PORT}" != "${WEB_PORT}" && "${UNIT_PORT}" != "${PUBLIC_PORT}" ]] \
     && ! port_busy "${UNIT_PORT}"; then
    WEB_PORT="${UNIT_PORT}"
    c_warn "Port interne conservé : ${WEB_PORT} (déjà configuré dans l'unit systemd et libre)"
  else
    # 2) Sinon : premier port libre parmi 3100-3600
    for P in 3100 3200 3300 3400 3500 3600; do
      if ! port_busy "${P}"; then
        WEB_PORT="${P}"
        c_warn "Port interne basculé automatiquement sur ${WEB_PORT} (le port public reste ${PUBLIC_PORT})"
        break
      fi
    done
  fi
  if port_busy "${WEB_PORT}"; then
    echo "ERREUR : aucun port interne libre trouvé (3100-3600). Libérez un port ou relancez avec : --web-port N" >&2
    exit 1
  fi
fi

# Garde-fou : avec nginx, le port interne ne peut pas être le port public
if [[ "${NO_NGINX}" == "false" && "${WEB_PORT}" == "${PUBLIC_PORT}" ]]; then
  echo "ERREUR : le port interne ${WEB_PORT} est réservé à nginx (port public). Relancez avec : --web-port N" >&2
  exit 1
fi

# ------------------------------------------------------------
# 7. Services systemd (3 processus redémarrés au boot)
# ------------------------------------------------------------
c_info "7/8 — Installation des services systemd…"

install_unit() {
  local src="$1" dst="/etc/systemd/system/$1"
  sed -e "s|__APP_DIR__|${APP_DIR}|g" \
      -e "s|__NODE_PATH__|${NODE_PATH}|g" \
      -e "s|__BUN_PATH__|${BUN_PATH}|g" \
      -e "s|__WEB_PORT__|${WEB_PORT}|g" \
      "deploy/$src" > "$dst"
}
install_unit socline-web.service
install_unit socline-chat.service
install_unit socline-washgo.service

chown -R "${RUN_USER}:${RUN_USER}" "${APP_DIR}"
chmod 600 "${APP_DIR}/.env"

systemctl daemon-reload
systemctl enable socline-web socline-chat socline-washgo >/dev/null 2>&1 || true
# RESTART (et pas seulement start) : « enable --now » est un NO-OP quand le
# service tourne déjà → l'ancien processus continuait d'écouter sur l'ancien
# port avec l'ANCIEN code (502 + routes PayDunya absentes). « restart »
# applique à coup sûr le nouvel environnement (PORT) et le nouveau build.
systemctl restart socline-web socline-chat socline-washgo
sleep 3
systemctl is-active --quiet socline-web      && c_ok "socline-web actif"      || c_fail "socline-web inactif — voir : journalctl -u socline-web -n 30"
systemctl is-active --quiet socline-chat     && c_ok "socline-chat actif"     || c_warn "socline-chat inactif — journalctl -u socline-chat -n 30"
systemctl is-active --quiet socline-washgo   && c_ok "socline-washgo actif"   || c_warn "socline-washgo inactif — journalctl -u socline-washgo -n 30"

# ------------------------------------------------------------
# 8. Reverse proxy nginx (port public 3002) + pare-feu
# ------------------------------------------------------------
if [[ "${NO_NGINX}" == "false" ]]; then
  c_info "8/8 — Configuration nginx (port public ${PUBLIC_PORT})…"
  if ! command -v nginx &>/dev/null; then
    apt-get install -y nginx
  fi

  NGINX_CONF="/etc/nginx/conf.d/socline.conf"
  DOMAIN="${SOCLINE_DOMAIN:-socline.oquitogo.com}"
  CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

  if [[ -f "${NGINX_CONF}" ]] && grep -q "ssl_certificate" "${NGINX_CONF}"; then
    # HTTPS déjà configuré par certbot lors d'une installation précédente :
    # on ne régénère PAS la conf (ça écraserait le certificat SSL), on se
    # contente de resynchroniser le port interne s'il a changé.
    c_ok "Configuration HTTPS (certbot) existante conservée"
    OLD_PORT="$(grep -oPm1 'default\s+127\.0\.0\.1:\K[0-9]+' "${NGINX_CONF}" || true)"
    if [[ -n "${OLD_PORT}" && "${OLD_PORT}" != "${WEB_PORT}" ]]; then
      sed -i "s|127.0.0.1:${OLD_PORT}|127.0.0.1:${WEB_PORT}|g" "${NGINX_CONF}"
      c_ok "Port interne nginx resynchronisé (${OLD_PORT} → ${WEB_PORT})"
    fi
  else
    sed -e "s|__PUBLIC_PORT__|${PUBLIC_PORT}|g" \
        -e "s|__WEB_PORT__|${WEB_PORT}|g" \
        deploy/nginx-socline.conf > "${NGINX_CONF}"
  fi

  # --- Restauration automatique HTTPS --------------------------------------
  # Le certificat Let's Encrypt existe sur le disque mais la conf nginx ne le
  # référence plus (ex. conf régénérée lors d'une mise à jour) : on réinjecte
  # le bloc 443 + les redirections HTTP → HTTPS. Sans cela, le domaine sert
  # l'application par défaut de nginx (une AUTRE application du VPS) !
  # (on cherche le certificat de NOTRE domaine dans toutes les confs nginx
  # actives : le bloc 443 peut avoir été restauré manuellement dans un autre
  # fichier que socline.conf — éviter d'injecter un doublon)
  if [[ -f "${CERT_DIR}/fullchain.pem" ]] && ! grep -qs "ssl_certificate.*${DOMAIN}" /etc/nginx/conf.d/*.conf /etc/nginx/sites-enabled/* 2>/dev/null; then
    c_warn "Certificat ${DOMAIN} présent mais absent de nginx → restauration du bloc HTTPS"
    cat >> "${NGINX_CONF}" <<NGINX_SSL

# ------------------------------------------------------------
# Bloc HTTPS restauré automatiquement par deploy.sh
# (certificat Let's Encrypt détecté dans ${CERT_DIR})
# ------------------------------------------------------------
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 25M;

    location / {
        proxy_pass http://\$socline_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade    \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_read_timeout    300s;
        proxy_send_timeout    300s;
        proxy_connect_timeout 30s;
        proxy_buffering off;
    }
}

# Redirection HTTP (port 80) du domaine vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# Redirection du port public du domaine vers HTTPS
server {
    listen ${PUBLIC_PORT};
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}
NGINX_SSL
    c_ok "Bloc HTTPS restauré pour ${DOMAIN}"
  fi

  # Supprimer le site par défaut s'il écoute aussi sur notre port
  if grep -q "listen ${PUBLIC_PORT}" /etc/nginx/sites-enabled/default 2>/dev/null; then
    rm -f /etc/nginx/sites-enabled/default
  fi
  nginx -t && systemctl reload nginx
  c_ok "nginx actif sur le port ${PUBLIC_PORT}"
  LISTEN_PORT="${PUBLIC_PORT}"
else
  c_warn "Mode sans nginx : accès direct http://IP:${PUBLIC_PORT} (temps réel en mode polling)"
  LISTEN_PORT="${PUBLIC_PORT}"
fi

# Pare-feu
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "22/tcp"  >/dev/null
  ufw allow "${LISTEN_PORT}/tcp" >/dev/null
  c_ok "UFW : port ${LISTEN_PORT} ouvert (SSH conservé)"
fi

# ------------------------------------------------------------
# Vérification finale : l'app en INTERNE d'abord (port ${WEB_PORT}),
# puis via nginx (port public) — distingue « l'app ne démarre pas »
# de « nginx ne relaie pas ».
# ------------------------------------------------------------
INTERNAL_CODE="000"
for _attempt in 1 2 3 4; do
  sleep 3
  INTERNAL_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}/" || true)"
  [[ "${INTERNAL_CODE}" == "200" ]] && break
  c_warn "L'app ne répond pas encore en interne (tentative ${_attempt}/4, HTTP ${INTERNAL_CODE:-000}) — nouvel essai…"
done

if [[ "${INTERNAL_CODE}" == "200" ]]; then
  c_ok "Application démarrée (interne 127.0.0.1:${WEB_PORT})"
  if [[ "${NO_NGINX}" == "false" ]]; then
    PUBLIC_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PUBLIC_PORT}/" || true)"
    if [[ "${PUBLIC_CODE}" == "200" ]]; then
      c_ok "nginx relaie l'application (HTTP 200 via le port ${PUBLIC_PORT})"
    else
      c_warn "nginx répond ${PUBLIC_CODE:-000} via le port ${PUBLIC_PORT} alors que l'app tourne — vérifier : nginx -t && systemctl reload nginx"
    fi
  fi
  # Seed des comptes de démonstration (idempotent)
  curl -s -X POST "http://127.0.0.1:${WEB_PORT}/api/seed" >/dev/null 2>&1 \
    && c_ok "Comptes de démonstration prêts (PIN : 1234)" || true
else
  c_warn "L'app ne démarre PAS sur le port interne ${WEB_PORT} — extrait des logs socline-web :"
  journalctl -u socline-web -n 30 --no-pager 2>/dev/null | tail -n 30 || true
  c_warn "Diagnostic complet : journalctl -u socline-web -f"
fi

# Vérification HTTPS du domaine (certificat restauré/conservé)
if [[ "${NO_NGINX}" == "false" && -f "${CERT_DIR:-/etc/letsencrypt/live/socline.oquitogo.com}/fullchain.pem" ]]; then
  HTTPS_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --resolve socline.oquitogo.com:443:127.0.0.1 "https://socline.oquitogo.com/" || true)"
  if [[ "${HTTPS_CODE}" == "200" ]]; then
    c_ok "HTTPS opérationnel : https://socline.oquitogo.com"
  else
    c_warn "HTTPS répond ${HTTPS_CODE:-000} sur le domaine — vérifier : nginx -t && journalctl -u nginx -n 20"
  fi
fi

IP_ADDR="$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

echo ""
echo -e "\033[1;32m============================================================"
echo "  ✅ Socline est installée sur votre VPS !"
echo -e "============================================================\033[0m"
echo ""
# Affiche l'URL HTTPS du domaine si le certificat certbot est en place
NGINX_CONF="/etc/nginx/conf.d/socline.conf"
if [[ -f "${NGINX_CONF}" ]] && grep -q "ssl_certificate" "${NGINX_CONF}"; then
  # Prendre le premier server_name réel (ignorer le joker « _ » du template)
  PUBLIC_DOMAIN="$(grep -oP 'server_name\s+\K[^; ]+' "${NGINX_CONF}" 2>/dev/null | grep -v '^_$' | head -n1 || true)"
  [[ -n "${PUBLIC_DOMAIN}" ]] || PUBLIC_DOMAIN="socline.oquitogo.com"
  echo "  🌐 Application   : https://${PUBLIC_DOMAIN}  (aussi : http://${IP_ADDR}:${PUBLIC_PORT})"
else
  echo "  🌐 Application   : http://${IP_ADDR}:${PUBLIC_PORT}"
fi
echo "  📱 Comptes démo  : admin 71998155 · client 90123456 · laveur 90234567 (PIN 1234)"
echo ""
echo "  Ports internes   : Next.js ${WEB_PORT} · chat 3003 · washgo 3005 (locaux uniquement)"
echo "  Logs             : journalctl -u socline-web -f   (ou socline-chat / socline-washgo)"
echo "  Redémarrer       : systemctl restart socline-web socline-chat socline-washgo"
echo "  Mettre à jour    : cd ${APP_DIR} && sudo bash deploy/deploy.sh --update"
echo ""
