'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore, useChatStore } from '@/store';
import type { Message, Conversation } from '@/types';
import type { Socket } from 'socket.io-client';
import {
  ArrowLeft, Send, MapPin, Camera, Loader2,
  Check, CheckCheck, Navigation, Image as ImageIcon,
  Car, User, Clock
} from 'lucide-react';
import { parseJsonResponse } from '@/lib/json-helper';
import { isRealtimeEnabled } from '@/lib/realtime-flag';
import { toast } from 'sonner';

interface ChatViewProps {
  conversation: Conversation;
  onBack: () => void;
}

// Extended message type with isRead property for local updates
interface MessageWithRead extends Message {
  isRead: boolean;
  readAt?: string;
}

const QUICK_MESSAGES = [
  { id: 'ARRIVING', label: 'J\'arrive', icon: '🚗' },
  { id: 'ON_SITE', label: 'Je suis sur place', icon: '📍' },
  { id: 'DELAY', label: 'Petit retard', icon: '⏰' },
  { id: 'STARTING', label: 'Je commence le lavage', icon: '🧽' },
  { id: 'DONE', label: 'Lavage terminé!', icon: '✅' },
];

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuthStore();
  const { messages, setMessages, addMessage, isConnected, setConnected, updateMessageReadStatus } = useChatStore();
  
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get other participant info
  const isClient = user?.id === conversation.clientId;
  const otherUser = isClient 
    ? conversation.order.washer?.user 
    : conversation.order.client;

  // Connect to WebSocket
  useEffect(() => {
    // Guard against toast spam during reconnection attempts
    let unauthorizedToastShown = false;

    const initSocket = async () => {
      // Serverless demo (Vercel): realtime disabled, polling fallbacks only.
      if (!isRealtimeEnabled()) return;

      // Token from the auth store (NOT in the effect deps on purpose:
      // a re-render with a new token is handled by the reconnect logic).
      const token = useAuthStore.getState().token;
      if (!token) {
        console.error('[Chat] No auth token available, socket connection refused');
        setConnected(false);
        toast.error('Session expirée, veuillez vous reconnecter');
        return;
      }

      // Dynamic import to avoid SSR issues
      const { io } = await import('socket.io-client');
      
      const socket = io('/?XTransformPort=3003', {
        transports: ['websocket'],
        reconnection: true,
        auth: { token },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Chat] Connected to server');
        setConnected(true);
        unauthorizedToastShown = false;
        // Identity is enforced server-side from the JWT handshake;
        // 'join' just registers this socket in its personal room.
        socket.emit('join');
        socket.emit('join-conversation', conversation.id);
      });

      socket.on('disconnect', () => {
        console.log('[Chat] Disconnected from server');
        setConnected(false);
      });

      socket.on('connect_error', (error: Error) => {
        console.error('[Chat] Socket connection error:', error.message);
        setConnected(false);
        if (error.message === 'unauthorized' && !unauthorizedToastShown) {
          unauthorizedToastShown = true;
          toast.error('Session expirée, veuillez vous reconnecter');
        }
      });

      socket.on('new-message', (message: Message) => {
        addMessage(message);
      });

      socket.on('user-typing', ({ userId }: { userId: string }) => {
        if (userId !== user?.id) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3000);
        }
      });

      socket.on('user-stop-typing', () => {
        setIsTyping(false);
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-conversation', conversation.id);
        socketRef.current.disconnect();
      }
    };
  }, [conversation.id, user?.id, addMessage, setConnected]);

  // Load messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversation.id}/messages`);
        const data = await parseJsonResponse<any>(res);
        if (!data) return;
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    fetchMessages();
  }, [conversation.id, setMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTyping = useCallback(() => {
    if (socketRef.current && user?.id) {
      socketRef.current.emit('typing', {
        conversationId: conversation.id,
        userId: user.id,
      });

      // Stop typing after 2 seconds
      setTimeout(() => {
        socketRef.current?.emit('stop-typing', {
          conversationId: conversation.id,
          userId: user.id,
        });
      }, 2000);
    }
  }, [conversation.id, user?.id]);

  const sendMessage = async (type: 'TEXT' | 'QUICK_MESSAGE' | 'LOCATION' | 'IMAGE' = 'TEXT', content?: string, extra?: { latitude?: number; longitude?: number; quickType?: string }) => {
    if (!user || !otherUser) return;
    
    const messageContent = content || newMessage.trim();
    if (!messageContent && type === 'TEXT') return;

    setIsSending(true);

    try {
      // Send via API
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: otherUser.id,
          type,
          content: messageContent,
          ...extra,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        // Also emit via WebSocket for real-time
        if (socketRef.current) {
          socketRef.current.emit('send-message', {
            conversationId: conversation.id,
            senderId: user.id,
            receiverId: otherUser.id,
            type,
            content: messageContent,
            ...extra,
          });
        }

        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendQuickMessage = (quickMsg: typeof QUICK_MESSAGES[0]) => {
    sendMessage('QUICK_MESSAGE', quickMsg.label, { quickType: quickMsg.id });
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sendMessage('LOCATION', '📍 Position partagée', { latitude, longitude });
      },
      (error) => {
        console.error('Failed to get location:', error);
      }
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Mark messages as read when viewing
  const markMessagesAsRead = useCallback(async () => {
    if (!user?.id || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) => m.senderId !== user.id && !m.isRead
    );

    if (unreadMessages.length === 0) return;

    try {
      // Mark messages as read via API
      await fetch(`/api/conversations/${conversation.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      // Emit read event via socket
      if (socketRef.current) {
        socketRef.current.emit('mark-read', {
          conversationId: conversation.id,
          userId: user.id,
        });
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [conversation.id, messages, user?.id]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      markMessagesAsRead();
    }
  }, [messages, markMessagesAsRead, user?.id]);

  // Listen for messages-read event
  useEffect(() => {
    if (!socketRef.current) return;

    const handleMessagesRead = (data: { conversationId: string; readBy: string }) => {
      // Update local messages to show read status
      updateMessageReadStatus(data.conversationId, data.readBy);
    };

    socketRef.current.on('messages-read', handleMessagesRead);

    return () => {
      socketRef.current?.off('messages-read', handleMessagesRead);
    };
  }, [updateMessageReadStatus]);

  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0]">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#F5F5F5] flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#FF9800] font-medium hover:bg-[#FFF3E0] px-2 py-1 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Retour</span>
        </button>
        <div className="w-10 h-10 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white font-bold">
          {otherUser?.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-[#212121]">{otherUser?.name || 'Utilisateur'}</h2>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-xs text-[#757575]">
              {isTyping ? 'En train d\'écrire...' : isConnected ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        </div>
        {!isClient && (
          <div className="flex items-center gap-1 text-xs text-[#757575] bg-[#FFF3E0] px-2 py-1 rounded-lg">
            <Car className="w-3 h-3" />
            <span>{conversation.order.client.plateNumber}</span>
          </div>
        )}
      </header>

      {/* Order Info Banner */}
      <div className="bg-[#FFF3E0] px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-[#FF9800] font-medium">Commande #{conversation.order.orderNumber}</span>
        <span className="text-[#757575]">{conversation.order.service.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-3">
              <MapPin className="w-8 h-8 text-[#FF9800]" />
            </div>
            <p className="text-[#757575] text-sm">Commencez la conversation</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === user?.id;
            return (
              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                  {/* Quick message badge */}
                  {message.type === 'QUICK_MESSAGE' && (
                    <div className={`text-xs mb-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                      <span className="bg-[#FFF3E0] text-[#FF9800] px-2 py-0.5 rounded-full">
                        {QUICK_MESSAGES.find(q => q.id === message.quickType)?.icon} {message.content}
                      </span>
                    </div>
                  )}
                  
                  {/* Message bubble */}
                  {message.type !== 'QUICK_MESSAGE' && (
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-[#FF9800] text-white rounded-br-md'
                          : 'bg-white text-[#212121] rounded-bl-md shadow-sm'
                      }`}
                    >
                      {/* Location message */}
                      {message.type === 'LOCATION' && message.latitude && message.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 ${isOwn ? 'text-white' : 'text-[#FF9800]'}`}
                        >
                          <Navigation className="w-5 h-5" />
                          <span className="underline">Voir la position</span>
                        </a>
                      )}
                      
                      {/* Image message */}
                      {message.type === 'IMAGE' && message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt="Photo partagée"
                          className="max-w-full rounded-lg"
                        />
                      )}
                      
                      {/* Text message */}
                      {message.type === 'TEXT' && (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Time and status */}
                  <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-[#9E9E9E]">{formatTime(message.createdAt)}</span>
                    {isOwn && (
                      <span className="flex items-center">
                        {message.isRead ? (
                          <CheckCheck className="w-4 h-4 text-[#4FC3F7]" strokeWidth={2.5} />
                        ) : (
                          <Check className="w-4 h-4 text-[#BDBDBD]" strokeWidth={2} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Messages */}
      <div className="bg-white border-t border-[#F5F5F5] p-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_MESSAGES.map((qm) => (
            <button
              key={qm.id}
              onClick={() => handleSendQuickMessage(qm)}
              className="flex-shrink-0 min-h-[36px] px-4 py-2 bg-[#FFF3E0] rounded-full text-sm text-[#FF9800] font-medium whitespace-nowrap active:scale-95 transition-transform"
            >
              {qm.icon} {qm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area — safe-area basse pour la barre gestuelle iOS */}
      <div className="bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2 border-t border-[#F5F5F5]">
        <button
          onClick={handleShareLocation}
          className="w-11 h-11 flex items-center justify-center text-[#FF9800] hover:bg-[#FFF3E0] rounded-full active:scale-95 transition-transform"
        >
          <MapPin className="w-5 h-5" />
        </button>
        <button
          className="w-11 h-11 flex items-center justify-center text-[#757575] hover:bg-[#F5F5F5] rounded-full active:scale-95 transition-transform"
        >
          <Camera className="w-5 h-5" />
        </button>
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Votre message..."
            className="h-10 bg-[#F5F5F5] border-0 rounded-full pr-10"
          />
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={isSending || !newMessage.trim()}
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center bg-[#FF9800] text-white rounded-full disabled:opacity-50 active:scale-95 transition-transform"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
