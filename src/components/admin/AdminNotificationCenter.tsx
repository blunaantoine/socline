'use client';

// Admin notification bell — same realtime pipeline as the client
// NotificationCenter (DB + socket 'notification' events via the global
// RealtimeNotifications listener). Lets the admin see withdrawal requests,
// deposit events and modification requests instantly.

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, Banknote, Car, AlertCircle, MessageCircle, Star, Wrench } from 'lucide-react';
import { parseJsonResponse } from '@/lib/json-helper';
import { onSoclineNotification } from '@/components/RealtimeNotifications';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function AdminNotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Initial fetch + light polling fallback (30s).
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        const data = await parseJsonResponse<any>(res);
        if (data?.success) setNotifications(data.notifications);
      } catch (error) {
        console.error('Failed to fetch admin notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isOpen]); // refetch when the sheet closes/opens

  // Realtime prepend (toast is shown by RealtimeNotifications).
  useEffect(() => {
    const off = onSoclineNotification((payload) => {
      setNotifications((prev) =>
        prev.some((n) => n.id === payload.id)
          ? prev
          : [
              {
                id: payload.id,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                isRead: false,
                createdAt: payload.createdAt,
              },
              ...prev,
            ].slice(0, 50)
      );
    });
    return off;
  }, []);

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <Banknote className="w-5 h-5 text-success" />;
      case 'order':
      case 'NEW_ORDER':
        return <Car className="w-5 h-5 text-brand-ink" />;
      case 'message':
        return <MessageCircle className="w-5 h-5 text-soft" />;
      case 'promo':
        return <Star className="w-5 h-5 text-[#FFC107]" />;
      case 'system':
        return <Wrench className="w-5 h-5 text-soft" />;
      default:
        return <AlertCircle className="w-5 h-5 text-soft" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative w-10 h-10 bg-white border border-line rounded-md flex items-center justify-center hover:bg-app transition-colors"
        >
          <Bell className="w-5 h-5 text-ink" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 border-b border-line">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold text-ink">
                Notifications admin
              </SheetTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-brand-ink text-xs">
                  Tout marquer lu
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto max-h-[80vh]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="w-16 h-16 bg-brand-wash rounded-full flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-brand-ink" />
                </div>
                <p className="text-soft text-center">Aucune notification</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F5]">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 cursor-pointer ${!n.isRead ? 'bg-brand-wash' : 'bg-white'}`}
                    onClick={() => !n.isRead && markAsRead(n.id)}
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-brand-wash rounded-full flex items-center justify-center flex-shrink-0">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!n.isRead ? 'font-semibold text-ink' : 'text-ink'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && <div className="w-2 h-2 bg-brand-ink rounded-full flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-soft mt-1">{n.message}</p>
                        <p className="text-xs text-soft mt-2">{formatTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications system footer (in-app + realtime + SMS) */}
          <div className="p-4 border-t border-line bg-brand-wash">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                <BellRing className="w-5 h-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-ink text-sm">
                  Notifications temps réel actives ✅
                </p>
                <p className="text-xs text-soft">
                  Retraits, dépôts et demandes — instantanés + SMS
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
