import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Washer, Order, Station, Service, Notification, Location, MapMarker } from '@/types';

// Auth Store
interface AuthState {
  user: User | null;
  washer: Washer | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  setWasher: (washer: Washer) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      washer: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      setWasher: (washer) => set({ washer }),
      logout: () => set({ user: null, washer: null, token: null, isAuthenticated: false }),
      updateUser: (userData) => set((state) => ({ 
        user: state.user ? { ...state.user, ...userData } : null 
      })),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'washgo-auth',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

// App View Store (Client/Washer/Admin)
type AppView = 'client' | 'washer' | 'admin';

interface AppState {
  currentView: AppView;
  setView: (view: AppView) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  // Location
  userLocation: Location | null;
  setUserLocation: (location: Location) => void;
  // Map markers
  markers: MapMarker[];
  setMarkers: (markers: MapMarker[]) => void;
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  currentView: 'client',
  setView: (view) => set({ currentView: view }),
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  userLocation: null,
  setUserLocation: (location) => set({ userLocation: location }),
  markers: [],
  setMarkers: (markers) => set({ markers }),
  notifications: [],
  addNotification: (notification) => set((state) => ({ 
    notifications: [notification, ...state.notifications] 
  })),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => 
      n.id === id ? { ...n, isRead: true } : n
    )
  })),
}));

// Orders Store
interface OrdersState {
  currentOrder: Order | null;
  orders: Order[];
  pendingOrders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  setCurrentOrder: (order: Order | null) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Partial<Order>) => void;
}

export const useOrdersStore = create<OrdersState>()((set) => ({
  currentOrder: null,
  orders: [],
  pendingOrders: [],
  activeOrders: [],
  completedOrders: [],
  setCurrentOrder: (order) => set({ currentOrder: order }),
  setOrders: (orders) => set({ 
    orders,
    pendingOrders: orders.filter((o) => o.status === 'PENDING'),
    activeOrders: orders.filter((o) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)),
    completedOrders: orders.filter((o) => o.status === 'COMPLETED'),
  }),
  addOrder: (order) => set((state) => ({ 
    orders: [order, ...state.orders] 
  })),
  updateOrder: (orderData) => set((state) => ({
    currentOrder: state.currentOrder?.id === orderData.id 
      ? { ...state.currentOrder, ...orderData } as Order
      : state.currentOrder,
    orders: state.orders.map((o) => 
      o.id === orderData.id ? { ...o, ...orderData } as Order : o
    ),
  })),
}));

// Services Store
interface ServicesState {
  services: Service[];
  selectedService: Service | null;
  setServices: (services: Service[]) => void;
  selectService: (service: Service | null) => void;
}

export const useServicesStore = create<ServicesState>()((set) => ({
  services: [],
  selectedService: null,
  setServices: (services) => set({ services }),
  selectService: (service) => set({ selectedService: service }),
}));

// Stations Store
interface StationsState {
  stations: Station[];
  selectedStation: Station | null;
  setStations: (stations: Station[]) => void;
  selectStation: (station: Station | null) => void;
}

export const useStationsStore = create<StationsState>()((set) => ({
  stations: [],
  selectedStation: null,
  setStations: (stations) => set({ stations }),
  selectStation: (station) => set({ selectedStation: station }),
}));

// Washers Store (for admin and client)
interface WashersState {
  washers: Washer[];
  nearbyWashers: Washer[];
  setWashers: (washers: Washer[]) => void;
  setNearbyWashers: (washers: Washer[]) => void;
}

export const useWashersStore = create<WashersState>()((set) => ({
  washers: [],
  nearbyWashers: [],
  setWashers: (washers) => set({ washers }),
  setNearbyWashers: (washers) => set({ nearbyWashers: washers }),
}));
