#!/usr/bin/env bash
# ============================================================
# Socline — Déploiement VPS automatique (port public 3002)
# ============================================================
# Usage :
#   sudo bash deploy/deploy.sh               # installation complète (nginx sur 3002)
#   sudo bash deploy/deploy.sh --no-nginx    # sans nginx (Next.js direct sur 3002, temps réel dégradé)
#   sudo bash deploy/deploy.sh --update      # mise à jour : git pull + rebuild + restart
#
# Architecture (par défaut) :
#   Internet ──> nginx :3002 ──> Next.js :3000 (interne)
#                          ├──> chat-service :3003 (interne, ?XTransformPort=3003)
#                          └──> washgo-socket :3005 (interne, ?XTransformPort=3005)
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/socline}"
REPO_URL="${REPO_URL:-https://github.com/blunaantoine/socline.git}"
PUBLIC_PORT=3002          # port public demandé
WEB_PORT=3000             # port interne Next.js (derrière nginx)
RUN_USER=socline          # utilisateur système dédié
NODE_MAJOR=22

NO_NGINX=false
UPDATE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --no-nginx) NO_NGINX=true ;;
    --update)   UPDATE_ONLY=true ;;
    *) echo "Option inconnue : $arg (attendu : --no-nginx | --update)"; exit 1 ;;
  esac
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
systemctl enable --now socline-web socline-chat socline-washgo
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
  sed -e "s|__PUBLIC_PORT__|${PUBLIC_PORT}|g" \
      -e "s|__WEB_PORT__|${WEB_PORT}|g" \
      deploy/nginx-socline.conf > /etc/nginx/conf.d/socline.conf
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
# Vérification finale + compte de démonstration
# ------------------------------------------------------------
sleep 2
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LISTEN_PORT}/" || true)"
if [[ "${HTTP_CODE}" == "200" ]]; then
  c_ok "L'application répond (HTTP ${HTTP_CODE})"
  # Seed des comptes de démonstration (idempotent)
  curl -s -X POST "http://127.0.0.1:${LISTEN_PORT}/api/seed" >/dev/null 2>&1 \
    && c_ok "Comptes de démonstration prêts (PIN : 1234)" || true
else
  c_warn "L'app répond avec HTTP ${HTTP_CODE} — vérifiez : journalctl -u socline-web -n 50"
fi

IP_ADDR="$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

echo ""
echo -e "\033[1;32m============================================================"
echo "  ✅ Socline est installée sur votre VPS !"
echo -e "============================================================\033[0m"
echo ""
echo "  🌐 Application   : http://${IP_ADDR}:${PUBLIC_PORT}"
echo "  📱 Comptes démo  : admin 71998155 · client 90123456 · laveur 90234567 (PIN 1234)"
echo ""
echo "  Ports internes   : Next.js ${WEB_PORT} · chat 3003 · washgo 3005 (locaux uniquement)"
echo "  Logs             : journalctl -u socline-web -f   (ou socline-chat / socline-washgo)"
echo "  Redémarrer       : systemctl restart socline-web socline-chat socline-washgo"
echo "  Mettre à jour    : cd ${APP_DIR} && sudo bash deploy/deploy.sh --update"
echo ""
