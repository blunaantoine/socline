import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Env loading
// Bun only auto-loads .env from the CWD. To be robust no matter where the
// service is started from, load the project root .env explicitly — without
// overriding variables that are already set.
// ---------------------------------------------------------------------------
function loadRootEnv(): void {
  try {
    const envPath = resolve(import.meta.dir, '../../.env');
    const content = readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    console.log('[Chat] Warning: root .env not found, relying on already-set env vars');
  }
}
loadRootEnv();

const PORT = 3003;
// Secrets partagés avec l'application Next (src/lib/auth.ts, src/lib/realtime.ts).
// MÊME valeur de repli que l'app web : sans cela, tout .env qui ne contient pas
// ces clés (ex. .env anciens ou réduits) rejetait CHAQUE handshake socket
// (« unauthorized ») → messagerie, suivi et position laveur morts côté client.
const JWT_SECRET = process.env.JWT_SECRET || 'socline-jwt-secret-change-in-production';
const INTERNAL_SOCKET_SECRET = process.env.INTERNAL_SOCKET_SECRET || 'socline-internal-socket-secret';

if (!process.env.JWT_SECRET || !process.env.INTERNAL_SOCKET_SECRET) {
  console.log('[Chat] Warning: JWT_SECRET / INTERNAL_SOCKET_SECRET absents du .env — valeur de repli partagée avec l\'app web utilisée (déploiement : lancez deploy.sh pour générer des secrets aléatoires).');
}

// ---------------------------------------------------------------------------
// HTTP server + secured internal emit endpoint (server-to-server)
// The request listener is registered BEFORE attaching socket.io below:
// engine.io keeps the listeners that exist at attach time and forwards to
// them every request that is NOT for /socket.io/. That is how /internal/emit
// coexists with the websocket server on the same port.
// ---------------------------------------------------------------------------
async function readBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        rejectPromise(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectPromise);
  });
}

const httpServer = createServer();

httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  const sendJson = (status: number, body: unknown) => {
    try {
      if (!res.writableEnded) {
        if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      }
    } catch {
      // socket already gone — nothing to do
    }
  };

  try {
    const url = (req.url || '').split('?')[0];

    // Engine.io serves /socket.io/* itself; never touch those requests.
    if (url.startsWith('/socket.io')) return;

    // Only POST /internal/emit exists.
    if (url !== '/internal/emit' || req.method !== 'POST') {
      return sendJson(404, { error: 'not found' });
    }

    // Server-to-server shared secret.
    const secret = req.headers['x-internal-secret'];
    if (!INTERNAL_SOCKET_SECRET || secret !== INTERNAL_SOCKET_SECRET) {
      return sendJson(403, { error: 'forbidden' });
    }

    // Body: { rooms: string[], event: string, data: unknown }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      return sendJson(400, { error: 'invalid body' });
    }
    const body = (parsed ?? {}) as { rooms?: unknown; event?: unknown; data?: unknown };
    const rooms = Array.isArray(body.rooms) ? body.rooms : null;
    if (!rooms || rooms.some((r) => typeof r !== 'string') || typeof body.event !== 'string' || body.event.length === 0) {
      return sendJson(400, { error: 'invalid body' });
    }

    // Never log the payload contents (private messages / locations).
    for (const room of rooms as string[]) {
      io.to(room).emit(body.event, body.data);
    }
    console.log(`[Chat] Internal emit: event=${body.event} rooms=${rooms.length}`);
    return sendJson(200, { ok: true });
  } catch {
    console.log('[Chat] Internal endpoint error');
    return sendJson(500, { error: 'internal error' });
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store connected users
const connectedUsers = new Map<string, string>(); // userId -> socketId

// ---------------------------------------------------------------------------
// Handshake authentication
// The client must present the same HS256 JWT used for the web session
// (socline_token cookie / zustand auth store: payload = { userId }).
// Identity is established ONCE here and never trusted from event payloads.
// ---------------------------------------------------------------------------
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log('[Chat] Handshake rejected: missing token');
    return next(new Error('unauthorized'));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: string };
    if (!payload?.userId) {
      console.log('[Chat] Handshake rejected: invalid token payload');
      return next(new Error('unauthorized'));
    }
    socket.data.userId = payload.userId;
    next();
  } catch {
    console.log('[Chat] Handshake rejected: invalid token');
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  // Authenticated identity from the JWT (set in the handshake middleware).
  const userId = socket.data.userId as string;
  console.log(`[Chat] Client connected: ${socket.id}`);

  // User joins — identity forced from the JWT, any payload userId is ignored.
  socket.on('join', () => {
    connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    console.log(`[Chat] User ${userId} joined with socket ${socket.id}`);

    // Notify user is online
    socket.emit('connected', { userId, status: 'online' });
  });

  // Join a conversation room (order-based)
  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`[Chat] Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`[Chat] Socket ${socket.id} left conversation ${conversationId}`);
  });

  // Send message — senderId forced from the JWT, data.senderId is ignored.
  socket.on('send-message', (data: {
    conversationId: string;
    receiverId: string;
    type: 'TEXT' | 'IMAGE' | 'LOCATION' | 'QUICK_MESSAGE' | 'SYSTEM';
    content: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    quickType?: string;
  }) => {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: data.conversationId,
      senderId: userId,
      receiverId: data.receiverId,
      type: data.type,
      content: data.content,
      imageUrl: data.imageUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      quickType: data.quickType,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Emit to conversation room
    io.to(`conversation:${data.conversationId}`).emit('new-message', message);

    // Also emit to receiver's personal room for notifications
    io.to(`user:${data.receiverId}`).emit('message-notification', {
      conversationId: data.conversationId,
      message,
    });

    console.log(`[Chat] Message sent in conversation ${data.conversationId}`);
  });

  // Typing indicator — identity forced from the JWT.
  socket.on('typing', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId,
    });
  });

  // Stop typing — identity forced from the JWT.
  socket.on('stop-typing', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('user-stop-typing', {
      userId,
    });
  });

  // Mark messages as read — identity forced from the JWT.
  socket.on('mark-read', (data: { conversationId: string }) => {
    io.to(`conversation:${data.conversationId}`).emit('messages-read', {
      conversationId: data.conversationId,
      readBy: userId,
    });
  });

  // NOTE: the 'location-update' handler was intentionally REMOVED.
  // It let any connected client broadcast fake washer positions.
  // Washer location push will be done server-to-server (Next.js API →
  // /internal/emit) in a later task.

  // Join order tracking
  socket.on('join-order-tracking', (orderId: string) => {
    socket.join(`order:${orderId}`);
    console.log(`[Chat] Socket ${socket.id} joined order tracking ${orderId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Remove user from connected users
    for (const [connectedUserId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(connectedUserId);
        console.log(`[Chat] User ${connectedUserId} disconnected`);
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Chat Service] Running on port ${PORT}`);
});
