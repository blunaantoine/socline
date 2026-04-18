'use client';

import { useState } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  LayoutDashboard, Users, Car, MapPin, DollarSign, 
  TrendingUp, Clock, Star, Settings, Bell, Plus,
  CheckCircle, XCircle, AlertCircle, Search, Filter,
  ChevronDown, Download, Eye, Edit, Trash2, Tag
} from 'lucide-react';

export function AdminPanel() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex-shrink-0 hidden lg:block`}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-400 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            {sidebarOpen && <span className="font-bold text-xl">WashGo</span>}
          </div>
        </div>

        <nav className="mt-4 px-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'orders', icon: Clock, label: 'Commandes' },
            { id: 'users', icon: Users, label: 'Utilisateurs' },
            { id: 'washers', icon: Car, label: 'Laveurs' },
            { id: 'stations', icon: MapPin, label: 'Stations' },
            { id: 'promotions', icon: Tag, label: 'Promotions' },
            { id: 'finances', icon: DollarSign, label: 'Finances' },
            { id: 'settings', icon: Settings, label: 'Paramètres' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-white border-b px-6 py-4 sticky top-16 z-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'orders' && 'Commandes'}
                {activeTab === 'users' && 'Utilisateurs'}
                {activeTab === 'washers' && 'Laveurs'}
                {activeTab === 'stations' && 'Stations'}
                {activeTab === 'promotions' && 'Promotions'}
                {activeTab === 'finances' && 'Finances'}
                {activeTab === 'settings' && 'Paramètres'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Rechercher..." className="pl-10 w-64" />
              </div>
              <Button variant="outline" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'orders' && <AdminOrders />}
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'washers' && <AdminWashers />}
          {activeTab === 'stations' && <AdminStations />}
          {activeTab === 'promotions' && <AdminPromotions />}
          {activeTab === 'finances' && <AdminFinances />}
          {activeTab === 'settings' && <AdminSettings />}
        </div>
      </main>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const stats = [
    { label: 'Commandes aujourd\'hui', value: '156', change: '+12%', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Revenus aujourd\'hui', value: '1.2M FCFA', change: '+8%', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Laveurs actifs', value: '42', change: '+5', icon: Car, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Note moyenne', value: '4.8', change: '+0.2', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  ];

  const recentOrders = [
    { id: 'WG12345678', client: 'Amadou Fall', service: 'Lavage Premium', amount: 15000, status: 'COMPLETED', time: '14:30' },
    { id: 'WG12345679', client: 'Fatou Sow', service: 'Lavage Express', amount: 5000, status: 'IN_PROGRESS', time: '14:25' },
    { id: 'WG12345680', client: 'Ibrahima Diallo', service: 'Lavage Complet', amount: 10000, status: 'EN_ROUTE', time: '14:20' },
    { id: 'WG12345681', client: 'Awa Ndiaye', service: 'Lavage Deluxe', amount: 25000, status: 'PENDING', time: '14:15' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className={`text-sm mt-1 ${stat.color}`}>{stat.change}</p>
                </div>
                <div className={`w-12 h-12 ${stat.bg} rounded-full flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenus de la semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-2">
              {[65, 80, 45, 90, 75, 85, 95].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-gray-500">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Orders by Service */}
        <Card>
          <CardHeader>
            <CardTitle>Commandes par service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Lavage Express', count: 45, percent: 35 },
                { name: 'Lavage Complet', count: 62, percent: 48 },
                { name: 'Lavage Premium', count: 18, percent: 14 },
                { name: 'Lavage Deluxe', count: 5, percent: 4 },
              ].map((service, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{service.name}</span>
                    <span className="text-gray-500">{service.count} commandes</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${service.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Commandes récentes</CardTitle>
          <Button variant="outline" size="sm">Voir tout</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Heure</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.id}</TableCell>
                  <TableCell>{order.client}</TableCell>
                  <TableCell>{order.service}</TableCell>
                  <TableCell className="font-medium">{order.amount.toLocaleString()} FCFA</TableCell>
                  <TableCell>
                    <Badge className={
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                      order.status === 'EN_ROUTE' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }>
                      {order.status === 'COMPLETED' && 'Terminée'}
                      {order.status === 'IN_PROGRESS' && 'En cours'}
                      {order.status === 'EN_ROUTE' && 'En route'}
                      {order.status === 'PENDING' && 'En attente'}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Orders
function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState('all');

  const orders = [
    { id: 'WG12345678', client: 'Amadou Fall', washer: 'Mamadou Diop', service: 'Lavage Premium', amount: 15000, status: 'COMPLETED', date: '2024-01-15 14:30' },
    { id: 'WG12345679', client: 'Fatou Sow', washer: 'Ibrahima Sow', service: 'Lavage Express', amount: 5000, status: 'IN_PROGRESS', date: '2024-01-15 14:25' },
    { id: 'WG12345680', client: 'Ibrahima Diallo', washer: '-', service: 'Lavage Complet', amount: 10000, status: 'PENDING', date: '2024-01-15 14:20' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="PENDING">En attente</SelectItem>
            <SelectItem value="IN_PROGRESS">En cours</SelectItem>
            <SelectItem value="COMPLETED">Terminées</SelectItem>
            <SelectItem value="CANCELLED">Annulées</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Commande</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Laveur</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.id}</TableCell>
                  <TableCell>{order.client}</TableCell>
                  <TableCell>{order.washer}</TableCell>
                  <TableCell>{order.service}</TableCell>
                  <TableCell className="font-medium">{order.amount.toLocaleString()} FCFA</TableCell>
                  <TableCell>
                    <Badge className={
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                      order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{order.date}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost"><Eye className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost"><Edit className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Users
function AdminUsers() {
  const users = [
    { id: '1', name: 'Amadou Fall', phone: '77 123 45 67', email: 'amadou@email.com', orders: 12, status: 'active' },
    { id: '2', name: 'Fatou Sow', phone: '77 234 56 78', email: 'fatou@email.com', orders: 8, status: 'active' },
    { id: '3', name: 'Ibrahima Diallo', phone: '77 345 67 89', email: 'ibrahim@email.com', orders: 5, status: 'inactive' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Input placeholder="Rechercher un utilisateur..." className="max-w-sm" />
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Commandes</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.orders}</TableCell>
                  <TableCell>
                    <Badge className={user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {user.status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost"><Eye className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost"><Edit className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Washers
function AdminWashers() {
  const washers = [
    { id: '1', name: 'Mamadou Diop', phone: '77 123 45 67', rating: 4.9, jobs: 156, earnings: 156000, status: 'verified', available: true },
    { id: '2', name: 'Ibrahima Sow', phone: '77 234 56 78', rating: 4.7, jobs: 120, earnings: 120000, status: 'verified', available: false },
    { id: '3', name: 'Ousmane Ba', phone: '77 345 67 89', rating: 0, jobs: 0, earnings: 0, status: 'pending', available: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Input placeholder="Rechercher un laveur..." className="max-w-sm" />
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un laveur
        </Button>
      </div>

      {/* Pending Verifications */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-5 h-5" />
            En attente de vérification (1)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarFallback>O</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">Ousmane Ba</p>
                <p className="text-sm text-gray-500">77 345 67 89 • Nouveau laveur</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Voir dossier</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                Valider
              </Button>
              <Button size="sm" variant="destructive">
                <XCircle className="w-4 h-4 mr-1" />
                Refuser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Washers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Laveur</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Gains</TableHead>
                <TableHead>Disponibilité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {washers.filter(w => w.status === 'verified').map((washer) => (
                <TableRow key={washer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{washer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{washer.name}</span>
                        <p className="text-xs text-gray-500">{washer.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      {washer.rating}
                    </div>
                  </TableCell>
                  <TableCell>{washer.jobs}</TableCell>
                  <TableCell>{washer.earnings.toLocaleString()} FCFA</TableCell>
                  <TableCell>
                    <Badge className={washer.available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {washer.available ? 'En ligne' : 'Hors ligne'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-800">Vérifié</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost"><Eye className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost"><Edit className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Stations
function AdminStations() {
  const stations = [
    { id: '1', name: 'Auto Shine Dakar', address: 'Plateau, Dakar', washers: 8, rating: 4.8, status: 'active' },
    { id: '2', name: 'Car Wash Medina', address: 'Medina, Dakar', washers: 5, rating: 4.5, status: 'active' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Input placeholder="Rechercher une station..." className="max-w-sm" />
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une station
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {stations.map((station) => (
          <Card key={station.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{station.name}</h3>
                  <p className="text-gray-500">{station.address}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <Car className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{station.washers} laveurs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm">{station.rating}</span>
                    </div>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">Gérer</Button>
                <Button variant="outline" size="sm">Services</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Admin Promotions
function AdminPromotions() {
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  
  const promotions = [
    { id: '1', name: 'Nouvel An', code: 'WELCOME20', discount: '20%', uses: '45/100', status: 'active', endDate: '2024-02-01' },
    { id: '2', name: 'Weekend Special', code: 'WEEKEND15', discount: '15%', uses: '78/200', status: 'active', endDate: '2024-01-31' },
    { id: '3', name: 'Premier Lavage', code: 'FIRST10', discount: '10%', uses: '150/∞', status: 'expired', endDate: '2024-01-01' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h2 className="text-lg font-semibold">Promotions actives</h2>
          <p className="text-gray-500">Gérez vos codes promo et offres spéciales</p>
        </div>
        <Button onClick={() => setShowCreatePromo(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Créer une promotion
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <Card key={promo.id} className={promo.status === 'expired' ? 'opacity-60' : ''}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold">{promo.name}</h3>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{promo.code}</code>
                </div>
                <Badge className={promo.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {promo.status === 'active' ? 'Active' : 'Expirée'}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Réduction</span>
                  <span className="font-medium text-blue-600">{promo.discount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilisations</span>
                  <span>{promo.uses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expiration</span>
                  <span>{promo.endDate}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">Modifier</Button>
                <Button variant="outline" size="sm" className="text-red-600">Supprimer</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Promotion Dialog */}
      <Dialog open={showCreatePromo} onOpenChange={setShowCreatePromo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom de la promotion</Label>
              <Input placeholder="ex: Nouvel An" />
            </div>
            <div>
              <Label>Code promo</Label>
              <Input placeholder="ex: WELCOME20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de réduction</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Pourcentage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Pourcentage</SelectItem>
                    <SelectItem value="fixed">Montant fixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input placeholder="20" />
              </div>
            </div>
            <div>
              <Label>Date d&apos;expiration</Label>
              <Input type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePromo(false)}>Annuler</Button>
            <Button onClick={() => setShowCreatePromo(false)}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Admin Finances
function AdminFinances() {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Revenus totaux</p>
            <p className="text-3xl font-bold text-green-600">2.5M FCFA</p>
            <p className="text-sm text-green-600 mt-1">+12% ce mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Commissions</p>
            <p className="text-3xl font-bold text-blue-600">375K FCFA</p>
            <p className="text-sm text-gray-500 mt-1">15% de commission</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Paiements en attente</p>
            <p className="text-3xl font-bold text-yellow-600">45K FCFA</p>
            <p className="text-sm text-gray-500 mt-1">3 transactions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { id: 'TRX001', type: 'Paiement commande', amount: 15000, method: 'Mixx by Yas', status: 'completed', date: '2024-01-15 14:30' },
                { id: 'TRX002', type: 'Retrait laveur', amount: 50000, method: 'T-Money', status: 'pending', date: '2024-01-15 12:00' },
              ].map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono">{tx.id}</TableCell>
                  <TableCell>{tx.type}</TableCell>
                  <TableCell className="font-medium">{tx.amount.toLocaleString()} FCFA</TableCell>
                  <TableCell>{tx.method}</TableCell>
                  <TableCell>
                    <Badge className={tx.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {tx.status === 'completed' ? 'Complété' : 'En attente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{tx.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Settings
function AdminSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres généraux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Nom de l&apos;entreprise</Label>
            <Input defaultValue="WashGo" />
          </div>
          <div>
            <Label>Email de contact</Label>
            <Input defaultValue="contact@washgo.tg" />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input defaultValue="+228 90 12 34 56" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Taux de commission</p>
              <p className="text-sm text-gray-500">Pourcentage prélevé sur chaque commande</p>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" defaultValue="15" className="w-20" />
              <span>%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Nouvelles commandes', desc: 'Recevoir une notification pour chaque nouvelle commande' },
            { label: 'Nouveaux laveurs', desc: 'Recevoir une notification quand un laveur s\'inscrit' },
            { label: 'Rapports quotidiens', desc: 'Recevoir un résumé quotidien par email' },
          ].map((notif, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{notif.label}</p>
                <p className="text-sm text-gray-500">{notif.desc}</p>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button className="bg-blue-600 hover:bg-blue-700">Enregistrer les modifications</Button>
    </div>
  );
}
