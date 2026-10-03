'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell, CheckCircle, Clock, Car, AlertCircle, X, MessageCircle,
  Star, CreditCard, MapPin
} from 'lucide-react';
import { parseJsonResponse } from '@/lib/json-helper';
import { onSoclineNotification } from '@/components/RealtimeNotifications';

interface Notification {
  id: string;
  type: 'order' | 'message' | 'payment' | 'promo' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    orderId?: string;
    orderNumber?: string;
  };
}

export function NotificationCenter() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return;

      try {
        const res = await fetch(`/api/notifications?userId=${user.id}`);
        const data = await parseJsonResponse<any>(res);
        if (!data) return;
        if (data.success) {
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();

    // Poll for new notifications every 30 seconds (fallback safety net)
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Realtime: instantly prepend notifications pushed by the socket layer
  // (RealtimeNotifications re-broadcasts them on the window). The toast is
  // already shown there — this only updates the list + unread badge.
  useEffect(() => {
    const off = onSoclineNotification((payload) => {
      setNotifications((prev) =>
        prev.some((n) => n.id === payload.id)
          ? prev
          : [
              {
                id: payload.id,
                type: (payload.type as Notification['type']) ?? 'system',
                title: payload.title,
                message: payload.message,
                isRead: false,
                createdAt: payload.createdAt,
                data: (payload.data as Notification['data']) ?? undefined,
              },
              ...prev,
            ].slice(0, 50)
      );
    });
    return off;
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch(`/api/notifications/read-all?userId=${user?.id}`, {
        method: 'POST',
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
      case 'NEW_ORDER':
        return <Car className="w-5 h-5 text-[#FF9800]" />;
      case 'message':
        return <MessageCircle className="w-5 h-5 text-[#2196F3]" />;
      case 'payment':
        return <CreditCard className="w-5 h-5 text-[#4CAF50]" />;
      case 'promo':
        return <Star className="w-5 h-5 text-[#FFC107]" />;
      default:
        return <AlertCircle className="w-5 h-5 text-[#757575]" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="relative w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#FF9800]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b border-[#F5F5F5]">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold text-[#212121]">
                Notifications
              </SheetTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-[#FF9800] text-xs"
                >
                  Tout marquer lu
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="w-16 h-16 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-[#FF9800]" />
                </div>
                <p className="text-[#757575] text-center">
                  Aucune notification
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F5]">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 ${!notification.isRead ? 'bg-[#FFF8F0]' : 'bg-white'}`}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center flex-shrink-0">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.isRead ? 'font-semibold text-[#212121]' : 'text-[#424242]'}`}>
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-[#FF9800] rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-[#757575] mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-[#9E9E9E] mt-2">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#F5F5F5] bg-[#FFF8F0]">
            <p className="text-xs text-center text-[#757575]">
              Les notifications sont liées à vos commandes et paiements
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
