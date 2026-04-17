import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store connected users
const connectedUsers = new Map<string, string>(); // userId -> socketId

io.on('connection', (socket) => {
  console.log(`[Chat] Client connected: ${socket.id}`);

  // User joins with their ID
  socket.on('join', (userId: string) => {
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

  // Send message
  socket.on('send-message', (data: {
    conversationId: string;
    senderId: string;
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
      senderId: data.senderId,
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

  // Typing indicator
  socket.on('typing', (data: { conversationId: string; userId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId: data.userId,
    });
  });

  // Stop typing
  socket.on('stop-typing', (data: { conversationId: string; userId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('user-stop-typing', {
      userId: data.userId,
    });
  });

  // Mark messages as read
  socket.on('mark-read', (data: { conversationId: string; userId: string }) => {
    io.to(`conversation:${data.conversationId}`).emit('messages-read', {
      conversationId: data.conversationId,
      readBy: data.userId,
    });
  });

  // Washer location update (for live tracking)
  socket.on('location-update', (data: {
    orderId: string;
    washerId: string;
    latitude: number;
    longitude: number;
  }) => {
    // Emit to order tracking room
    io.to(`order:${data.orderId}`).emit('washer-location', {
      washerId: data.washerId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date().toISOString(),
    });
  });

  // Join order tracking
  socket.on('join-order-tracking', (orderId: string) => {
    socket.join(`order:${orderId}`);
    console.log(`[Chat] Socket ${socket.id} joined order tracking ${orderId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Remove user from connected users
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`[Chat] User ${userId} disconnected`);
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Chat Service] Running on port ${PORT}`);
});
