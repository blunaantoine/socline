// ============================================================
// Socline — Alternative PM2 (si vous préférez PM2 à systemd)
// Usage : sudo npm i -g pm2 && pm2 start deploy/ecosystem.config.js
//         pm2 save && pm2 startup
// ============================================================
/* eslint-disable @typescript-eslint/no-require-imports */
// NOTE : le chemin de Bun est détecté automatiquement au chargement.

const { execSync } = require('node:child_process');

function whichOr(bin, fallback) {
  try {
    return execSync(`command -v ${bin}`, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const BUN_PATH = whichOr('bun', '/usr/local/bin/bun');
const NODE_PATH = whichOr('node', '/usr/bin/node');

module.exports = {
  apps: [
    {
      name: 'socline-web',
      cwd: '/opt/socline',
      script: '.next/standalone/server.js',
      interpreter: NODE_PATH,
      env: {
        NODE_ENV: 'production',
        PORT: 3000, // interne — nginx écoute 3002 et route vers ce port
        HOSTNAME: '127.0.0.1',
      },
      autorestart: true,
      max_memory_restart: '600M',
      time: true,
    },
    {
      name: 'socline-chat',
      cwd: '/opt/socline',
      script: 'mini-services/chat-service/index.ts',
      interpreter: BUN_PATH,
      env: { NODE_ENV: 'production' },
      autorestart: true,
      time: true,
    },
    {
      name: 'socline-washgo',
      cwd: '/opt/socline',
      script: 'mini-services/washgo-socket/index.ts',
      interpreter: BUN_PATH,
      env: { NODE_ENV: 'production' },
      autorestart: true,
      time: true,
    },
  ],
};
