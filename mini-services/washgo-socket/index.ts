import { Server } from 'socket.io';
import http from 'http';

// NOTE: this is the legacy DEMO socket service (kept for reference/mobile
// demos). The production realtime service used by the Next.js app is
// mini-services/chat-service on port 3003 — this one MUST use another port
// to avoid a startup race where it steals 3003 and breaks JWT-authenticated
// notifications.
const PORT = 3005;

const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store connected users
const connectedUsers = new Map<string, { socketId: string; role: string; userId: string }>();
// Store active orders being tracked
const activeOrders = new Map<string, { clientId: string; washerId: string; status: string }>();

console.log(`🚿 WashGo Socket Server running on port ${PORT}`);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User authentication/join
  socket.on('join', (data: { userId: string; role: string }) => {
    console.log(`User joined: ${data.userId} as ${data.role}`);
    
    connectedUsers.set(socket.id, {
      socketId: socket.id,
      role: data.role,
      userId: data.userId,
    });

    // Join role-based rooms
    socket.join(`role:${data.role}`);
    socket.join(`user:${data.userId}`);

    socket.emit('joined', { success: true, socketId: socket.id });
  });

  // ============ ORDER EVENTS ============

  // New order created (client)
  socket.on('order:create', (data: { orderId: string; clientId: string; service: any; location: any }) => {
    console.log(`New order created: ${data.orderId}`);
    
    // Notify all available washers
    io.to('role:WASHER').emit('order:new', {
      orderId: data.orderId,
      clientId: data.clientId,
      service: data.service,
      location: data.location,
      timestamp: new Date().toISOString(),
    });

    // Track this order
    activeOrders.set(data.orderId, {
      clientId: data.clientId,
      washerId: '',
      status: 'PENDING',
    });
  });

  // Washer accepts order
  socket.on('order:accept', (data: { orderId: string; washerId: string; washerInfo: any }) => {
    console.log(`Order ${data.orderId} accepted by washer ${data.washerId}`);
    
    const order = activeOrders.get(data.orderId);
    if (order) {
      order.washerId = data.washerId;
      order.status = 'ACCEPTED';
      activeOrders.set(data.orderId, order);
    }

    // Notify the client
    io.to(`user:${order?.clientId}`).emit('order:accepted', {
      orderId: data.orderId,
      washerId: data.washerId,
      washerInfo: data.washerInfo,
      timestamp: new Date().toISOString(),
    });

    // Notify other washers that this order is taken
    socket.broadcast.to('role:WASHER').emit('order:taken', { orderId: data.orderId });
  });

  // Washer rejects order
  socket.on('order:reject', (data: { orderId: string; washerId: string }) => {
    console.log(`Order ${data.orderId} rejected by washer ${data.washerId}`);
    // Server will find another washer
  });

  // Order status update
  socket.on('order:status', (data: { orderId: string; status: string; washerId?: string; metadata?: any }) => {
    console.log(`Order ${data.orderId} status changed to ${data.status}`);
    
    const order = activeOrders.get(data.orderId);
    if (order) {
      order.status = data.status;
      activeOrders.set(data.orderId, order);
    }

    // Notify the client
    if (order?.clientId) {
      io.to(`user:${order.clientId}`).emit('order:status', {
        orderId: data.orderId,
        status: data.status,
        metadata: data.metadata,
        timestamp: new Date().toISOString(),
      });
    }

    // Notify admin
    io.to('role:ADMIN').emit('order:status', {
      orderId: data.orderId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
  });

  // ============ LOCATION TRACKING ============

  // Washer location update
  socket.on('location:update', (data: { orderId: string; washerId: string; latitude: number; longitude: number }) => {
    const order = activeOrders.get(data.orderId);
    if (order?.clientId) {
      io.to(`user:${order.clientId}`).emit('location:washer', {
        orderId: data.orderId,
        washerId: data.washerId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ============ WASHER EVENTS ============

  // Washer availability toggle
  socket.on('washer:availability', (data: { washerId: string; isAvailable: boolean }) => {
    console.log(`Washer ${data.washerId} availability: ${data.isAvailable}`);
    
    // Update washer status in connected users
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.to('role:ADMIN').emit('washer:availability', {
        washerId: data.washerId,
        isAvailable: data.isAvailable,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ============ CHAT EVENTS ============

  // Send message
  socket.on('chat:send', (data: { from: string; to: string; message: string; orderId?: string }) => {
    console.log(`Chat message from ${data.from} to ${data.to}`);
    
    io.to(`user:${data.to}`).emit('chat:receive', {
      from: data.from,
      message: data.message,
      orderId: data.orderId,
      timestamp: new Date().toISOString(),
    });
  });

  // ============ ADMIN EVENTS ============

  // Broadcast to all users
  socket.on('admin:broadcast', (data: { message: string; type: string }) => {
    io.emit('admin:notification', {
      message: data.message,
      type: data.type,
      timestamp: new Date().toISOString(),
    });
  });

  // ============ NOTIFICATION EVENTS ============

  // Push notification
  socket.on('notification:send', (data: { userId: string; title: string; message: string; type: string }) => {
    io.to(`user:${data.userId}`).emit('notification:receive', {
      title: data.title,
      message: data.message,
      type: data.type,
      timestamp: new Date().toISOString(),
    });
  });

  // ============ DISCONNECT ============

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    connectedUsers.delete(socket.id);
  });
});

// Health check endpoint (simple HTTP server for status)
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: connectedUsers.size,
      activeOrders: activeOrders.size,
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3006, () => {
  console.log('Health check server running on port 3006');
});
