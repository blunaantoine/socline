'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useChatStore, useAppStore } from '@/store';
import type { Conversation } from '@/types';
import { ChatView } from './ChatView';
import {
  MessageCircle, Clock, Car, User, ChevronRight, Loader2, ArrowLeft
} from 'lucide-react';

export function ChatList() {
  const { user } = useAuthStore();
  const { setView } = useAppStore();
  const { conversations, setConversations, currentConversation, setCurrentConversation } = useChatStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        const res = await fetch(`/api/conversations?userId=${user.id}`);
        const data = await res.json();
        if (data.success) {
          setConversations(data.conversations);
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [user?.id, setConversations]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Hier';
    } else if (days < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  };

  if (currentConversation) {
    return (
      <ChatView 
        conversation={currentConversation} 
        onBack={() => setCurrentConversation(null)} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0]">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-[#F5F5F5] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-1 text-[#FF9800] font-medium hover:bg-[#FFF3E0] px-2 py-1 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Retour</span>
          </button>
        </div>
        <h1 className="text-xl font-bold text-[#212121] mt-2">Messages</h1>
        <p className="text-sm text-[#757575]">Vos conversations liées aux commandes</p>
      </header>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF9800]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-20 h-20 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-[#FF9800]" />
            </div>
            <h3 className="text-lg font-semibold text-[#212121] mb-2">Aucune conversation</h3>
            <p className="text-[#757575] text-center text-sm">
              Vos messages apparaîtront ici après avoir passé une commande
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {conversations.map((conv) => {
              const isClient = user?.id === conv.clientId;
              const otherUser = isClient ? conv.order.washer?.user : conv.order.client;
              const orderStatus = conv.order.status;

              return (
                <button
                  key={conv.id}
                  onClick={() => setCurrentConversation(conv)}
                  className="w-full bg-white p-4 flex items-center gap-3 hover:bg-[#FFF8F0] transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {otherUser?.name?.charAt(0) || '?'}
                    </div>
                    {!isClient && otherUser && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center border-2 border-[#FF9800]">
                        <Car className="w-3 h-3 text-[#FF9800]" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-[#212121] truncate">
                        {otherUser?.name || 'Utilisateur'}
                      </h3>
                      <span className="text-xs text-[#9E9E9E]">
                        {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}
                      </span>
                    </div>
                    
                    {/* Order info */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-[#757575] bg-[#FFF3E0] px-2 py-0.5 rounded">
                        #{conv.order.orderNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        orderStatus === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                        orderStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                        orderStatus === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        {orderStatus === 'PENDING' ? 'En attente' :
                         orderStatus === 'ACCEPTED' ? 'Acceptée' :
                         orderStatus === 'EN_ROUTE' ? 'En route' :
                         orderStatus === 'ARRIVED' ? 'Arrivé' :
                         orderStatus === 'IN_PROGRESS' ? 'En cours' :
                         orderStatus === 'COMPLETED' ? 'Terminée' :
                         orderStatus === 'CANCELLED' ? 'Annulée' : orderStatus}
                      </span>
                    </div>

                    {/* Last message */}
                    <p className="text-sm text-[#757575] truncate">
                      {conv.lastMessage || 'Aucun message'}
                    </p>

                    {/* Vehicle info for washer */}
                    {!isClient && conv.order.client.plateNumber && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-[#9E9E9E]">
                        <Car className="w-3 h-3" />
                        <span>{conv.order.client.plateNumber} • {conv.order.client.carColor}</span>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-[#9E9E9E]" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-[#FFF3E0] px-4 py-3 text-center">
        <p className="text-xs text-[#FF9800]">
          💬 Les conversations sont liées à vos commandes pour votre sécurité
        </p>
      </div>
    </div>
  );
}
