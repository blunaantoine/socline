# 🚀 Socline — Installation sur votre serveur VPS (port 3002)

Ce guide explique comment installer **Socline** sur un VPS (Ubuntu / Debian) avec
l'application accessible sur **http://IP_DU_SERVEUR:3002**.

---

## 🗺️ Architecture sur le VPS

| Service | Port | Rôle | Accès |
|---|---|---|---|
| **nginx** | **3002** | Entrée publique (app + temps réel routé) | 🌐 Public |
| Next.js (web) | 3000 | Application (interne) | 🔒 Local |
| chat-service | 3003 | Notifications + chat temps réel (socket.io) | 🔒 Local |
| washgo-socket | 3005 | Suivi du laveur en temps réel (socket.io) | 🔒 Local |

Le routage temps réel est géré par nginx exactement comme le gateway de
développement : les requêtes `?XTransformPort=3003` partent vers :3003,
`?XTransformPort=3005` vers :3005, tout le reste vers l'application.
**Aucune modification de code n'est nécessaire.**

---

## ⚡ Installation express (recommandée)

Connectez-vous en root sur votre VPS puis lancez **une seule commande** :

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/blunaantoine/socline/main/deploy/deploy.sh)"
```

Ou si vous avez déjà le dépôt :

```bash
git clone https://github.com/blunaantoine/socline.git /opt/socline
cd /opt/socline
sudo bash deploy/deploy.sh
```

Le script fait **tout automatiquement** :

1. ✅ Installe Node.js 22, Bun et nginx s'ils manquent
2. ✅ Clone le code dans `/opt/socline`
3. ✅ Génère un fichier `.env` avec des **secrets aléatoires sécurisés**
4. ✅ Installe les dépendances (app + 2 services socket)
5. ✅ Crée la base SQLite (`db/custom.db`) avec le schéma Prisma
6. ✅ Compile l'application en production
7. ✅ Installe 3 **services systemd** (redémarrage automatique au boot du serveur)
8. ✅ Configure **nginx sur le port 3002** + ouvre le pare-feu (UFW)
9. ✅ Crée les comptes de démonstration (seed)

À la fin, l'app est disponible sur : **http://VOTRE_IP:3002** 🎉

### Options du script

```bash
sudo bash deploy/deploy.sh --update      # mettre à jour (git pull + rebuild + restart)
sudo bash deploy/deploy.sh --no-nginx    # sans nginx : Next.js direct sur 3002
                                         # (⚠️ temps réel dégradé en polling)
```

---

## 🛠️ Installation manuelle (pas à pas)

Si vous préférez comprendre et contrôler chaque étape :

### 1. Dépendances

```bash
sudo apt update && sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
```

### 2. Code + configuration

```bash
sudo git clone https://github.com/blunaantoine/socline.git /opt/socline
cd /opt/socline
sudo cp .env.example .env
sudo nano .env    # ← renseigner DATABASE_URL et les secrets (voir plus bas)
```

**Contenu minimal du `.env` :**

```env
DATABASE_URL="file:/opt/socline/db/custom.db"
JWT_SECRET="un-secret-long-et-aléatoire"
JWT_REFRESH_SECRET="un-autre-secret-long-et-aléatoire"
INTERNAL_SOCKET_SECRET="encore-un-secret"
SMS_DEMO_FALLBACK="true"
OTP_CHANNEL=sms
```

> 💡 Génerez des secrets avec : `openssl rand -hex 32`
> Pour l'envoi réel des OTP par SMS, renseignez `SMS_PROVIDER=africastalking`,
> `SMS_USERNAME`, `SMS_API_KEY`, `SMS_SENDER_ID` (voir `.env.example`).

### 3. Dépendances + base de données + build

```bash
bun install
(cd mini-services/chat-service && bun install)
(cd mini-services/washgo-socket && bun install)
bun x prisma db push
bun run build
cp .env .next/standalone/.env
```

### 4. Services systemd

```bash
sudo useradd -m socline
sudo chown -R socline:socline /opt/socline

# Remplacer les placeholders puis copier les unités :
for f in socline-web socline-chat socline-washgo; do
  sudo sed -e "s|__APP_DIR__|/opt/socline|g" \
           -e "s|__NODE_PATH__|$(command -v node)|g" \
           -e "s|__BUN_PATH__|$(command -v bun)|g" \
           -e "s|__WEB_PORT__|3000|g" \
           deploy/$f.service > /etc/systemd/system/$f.service
done

sudo systemctl daemon-reload
sudo systemctl enable --now socline-web socline-chat socline-washgo
```

### 5. Reverse proxy nginx (port 3002)

```bash
sudo sed -e "s|__PUBLIC_PORT__|3002|g" -e "s|__WEB_PORT__|3000|g" \
  deploy/nginx-socline.conf | sudo tee /etc/nginx/conf.d/socline.conf > /dev/null
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 3002/tcp   # si UFW est actif
```

### 6. Comptes de démonstration

```bash
curl -X POST http://127.0.0.1:3002/api/seed
```

| Rôle | Téléphone | PIN |
|---|---|---|
| Admin | `71998155` | `1234` |
| Client | `90123456` | `1234` |
| Laveur | `90234567` | `1234` |

> ⚠️ Changez ces PIN avant une mise en production réelle.

---

## 🔧 Opérations courantes

```bash
# Voir les logs en direct
journalctl -u socline-web -f
journalctl -u socline-chat -f
journalctl -u socline-washgo -f

# Redémarrer tous les services
sudo systemctl restart socline-web socline-chat socline-washgo

# État des services
systemctl status socline-web socline-chat socline-washgo

# Mettre à jour l'application après un nouveau commit sur GitHub
cd /opt/socline && sudo bash deploy/deploy.sh --update

# Sauvegarder la base de données
cp /opt/socline/db/custom.db ~/socline-backup-$(date +%F).db
```

---

## 🌍 Optionnel : nom de domaine + HTTPS

Si vous pointez un domaine (ex. `socline.mondomaine.com`) vers l'IP du VPS :

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo sed -i 's/listen 3002;/listen 3002;\n    server_name socline.mondomaine.com;/' /etc/nginx/conf.d/socline.conf
sudo certbot --nginx -d socline.mondomaine.com
```

Certbot reconfigurera nginx pour le HTTPS automatique (renouvellement inclus).

> 💡 Avec un domaine, vous pouvez aussi passer le port public à 80 (standard web)
> en remplaçant `listen 3002;` par `listen 80;` dans
> `/etc/nginx/conf.d/socline.conf`.

---

## 🩺 Dépannage

| Problème | Solution |
|---|---|
| La page ne charge pas | `journalctl -u socline-web -n 50` puis `systemctl status socline-web` |
| Port 3002 déjà utilisé | `ss -tlnp \| grep 3002` → identifier/couper le process, ou changer `listen` dans la conf nginx |
| Chat / suivi laveur figé | `journalctl -u socline-chat -n 30` et `-u socline-washgo -n 30` |
| Le temps réel ne marche pas | Vérifier que nginx tourne : `systemctl status nginx` — sans nginx les sockets ne sont pas routés |
| Erreur base de données | `cd /opt/socline && bun x prisma db push` puis `systemctl restart socline-web` |
| OTP non reçus | Renseigner les clés Africa's Talking dans `/opt/socline/.env` puis redémarrer |
| .env modifié | `sudo systemctl restart socline-web socline-chat socline-washgo` (recharge le fichier) |

---

## 🔄 Alternative PM2 (au lieu de systemd)

```bash
sudo npm i -g pm2
cd /opt/socline
sudo pm2 start deploy/ecosystem.config.js
sudo pm2 save && sudo pm2 startup
```

Les commandes deviennent : `pm2 logs`, `pm2 restart socline-web`, etc.
La configuration nginx reste identique.

---

## 📌 Rappels importants

- Le fichier `.env` du VPS contient vos secrets : **ne le versionnez jamais** (il est
  déjà ignoré par `.gitignore`).
- La base SQLite est dans `/opt/socline/db/custom.db` — pensez à la sauvegarder
  régulièrement (`cron` + `cp` suffisent pour démarrer).
- Le script `deploy.sh --update` est **sans danger** : il ne touche jamais au
  `.env` ni à la base de données.
- Les ports 3000 / 3003 / 3005 n'ont **pas besoin** d'être ouverts dans le
  pare-feu : tout transite par le port 3002 (nginx route en interne).
