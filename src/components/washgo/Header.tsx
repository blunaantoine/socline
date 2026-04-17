'use client';

import { useAuthStore, useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Menu, User, LogOut, Car, Settings, Shield } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuthStore();
  const { currentView, setView, toggleSidebar, notifications } = useAppStore();
  
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeColor = () => {
    switch (currentView) {
      case 'washer':
        return 'bg-green-100 text-green-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <span className="font-bold text-xl text-gray-900">WashGo</span>
          </div>

          {/* Role Switcher for admins */}
          {user?.role === 'ADMIN' && (
            <div className="hidden md:flex items-center gap-2 ml-4">
              <Button
                variant={currentView === 'client' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('client')}
                className={currentView === 'client' ? 'bg-blue-600' : ''}
              >
                <User className="w-4 h-4 mr-1" />
                Client
              </Button>
              <Button
                variant={currentView === 'washer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('washer')}
                className={currentView === 'washer' ? 'bg-green-600' : ''}
              >
                <Car className="w-4 h-4 mr-1" />
                Laveur
              </Button>
              <Button
                variant={currentView === 'admin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('admin')}
                className={currentView === 'admin' ? 'bg-purple-600' : ''}
              >
                <Shield className="w-4 h-4 mr-1" />
                Admin
              </Button>
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Current Role Badge */}
          <Badge className={`${getRoleBadgeColor()} hidden sm:inline-flex`}>
            {currentView === 'client' && 'Client'}
            {currentView === 'washer' && 'Laveur'}
            {currentView === 'admin' && 'Admin'}
          </Badge>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-gray-100">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline font-medium text-sm">
                  {user?.name || 'Utilisateur'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.name}</span>
                  <span className="text-xs text-gray-500">{user?.phone}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView('client')}>
                <User className="w-4 h-4 mr-2" />
                Mode Client
              </DropdownMenuItem>
              {(user?.role === 'WASHER' || user?.role === 'ADMIN') && (
                <DropdownMenuItem onClick={() => setView('washer')}>
                  <Car className="w-4 h-4 mr-2" />
                  Mode Laveur
                </DropdownMenuItem>
              )}
              {user?.role === 'ADMIN' && (
                <DropdownMenuItem onClick={() => setView('admin')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Panel Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
