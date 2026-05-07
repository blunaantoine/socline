'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Car, Shield } from 'lucide-react';

interface RoleSelectorProps {
  onSelect: (view: 'client' | 'washer' | 'admin') => void;
}

export function RoleSelector({ onSelect }: RoleSelectorProps) {
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Choisissez votre mode
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-24 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => onSelect('client')}
          >
            <User className="w-8 h-8 text-blue-600" />
            <div className="text-center">
              <div className="font-semibold">Mode Client</div>
              <div className="text-xs text-gray-500">Commander un lavage</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex flex-col items-center gap-2 hover:bg-green-50 hover:border-green-300"
            onClick={() => onSelect('washer')}
          >
            <Car className="w-8 h-8 text-green-600" />
            <div className="text-center">
              <div className="font-semibold">Mode Laveur</div>
              <div className="text-xs text-gray-500">Gérer vos commandes</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
            onClick={() => onSelect('admin')}
          >
            <Shield className="w-8 h-8 text-purple-600" />
            <div className="text-center">
              <div className="font-semibold">Panel Admin</div>
              <div className="text-xs text-gray-500">Gérer la plateforme</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
